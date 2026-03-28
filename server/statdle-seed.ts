/**
 * StudioStatdle seed script
 * Fetches historical MLB players from the Stats API and populates statdle_players.
 *
 * Usage: npx tsx server/statdle-seed.ts
 *
 * Fetches players from several seasons, deduplicates, then pulls career stats
 * for each unique player. Runs with a small delay between requests to be
 * respectful of the public API.
 */

import { db } from "./db";
import { statlePlayers } from "../shared/schema";
import { eq } from "drizzle-orm";

const START_SEASON = 2015;
const END_SEASON = 2024;
const SEASONS = Array.from({ length: END_SEASON - START_SEASON + 1 }, (_, i) => START_SEASON + i);
const DELAY_MS = 100;
const BASE = "https://statsapi.mlb.com/api/v1";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchSeasonPlayers(season: number): Promise<any[]> {
  try {
    const data = await fetchJson(`${BASE}/sports/1/players?season=${season}&gameType=R`);
    return data.people ?? [];
  } catch (e) {
    console.warn(`  Season ${season} failed:`, e);
    return [];
  }
}

async function fetchPersonDetail(mlbId: number): Promise<any> {
  try {
    const data = await fetchJson(
      `${BASE}/people/${mlbId}?hydrate=stats(group=[hitting,pitching],type=career)`
    );
    return data.people?.[0] ?? null;
  } catch {
    return null;
  }
}

function extractCareerStats(person: any): { type: "hitter" | "pitcher"; [key: string]: any } | null {
  const statsArr: any[] = person.stats ?? [];

  const hitting = statsArr.find((s: any) => s.group?.displayName === "hitting" && s.type?.displayName === "career");
  const pitching = statsArr.find((s: any) => s.group?.displayName === "pitching" && s.type?.displayName === "career");

  if (hitting?.splits?.[0]) {
    const s = hitting.splits[0].stat;
    return {
      type: "hitter",
      games: s.gamesPlayed,
      avg: parseFloat(s.avg) || 0,
      hr: s.homeRuns,
      rbi: s.rbi,
      sb: s.stolenBases,
      ops: parseFloat(s.ops) || 0,
      hits: s.hits,
    };
  }

  if (pitching?.splits?.[0]) {
    const s = pitching.splits[0].stat;
    return {
      type: "pitcher",
      games: s.gamesPitched,
      wins: s.wins,
      losses: s.losses,
      era: parseFloat(s.era) || 0,
      so: s.strikeOuts,
      whip: parseFloat(s.whip) || 0,
      saves: s.saves,
    };
  }

  return null;
}

async function main() {
  console.log("Fetching player lists across seasons...");

  // Collect unique players by mlbId
  const playerMap = new Map<number, any>();

  for (const season of SEASONS) {
    console.log(`  Season ${season}...`);
    const players = await fetchSeasonPlayers(season);
    for (const p of players) {
      if (!playerMap.has(p.id)) {
        playerMap.set(p.id, p);
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(`Found ${playerMap.size} unique players. Fetching career details...`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const total = playerMap.size;
  let i = 0;

  for (const [mlbId, basic] of Array.from(playerMap.entries())) {
    i++;
    if (i % 100 === 0) console.log(`  ${i}/${total}...`);

    // Skip if already in DB
    const existing = await db
      .select({ id: statlePlayers.id })
      .from(statlePlayers)
      .where(eq(statlePlayers.mlbId, String(mlbId)));

    if (existing.length) {
      skipped++;
      continue;
    }

    const person = await fetchPersonDetail(mlbId);
    await sleep(DELAY_MS);

    if (!person) {
      failed++;
      continue;
    }

    const stats = extractCareerStats(person);

    // Parse career dates from debut and last game
    const debutYear = person.mlbDebutDate ? parseInt(person.mlbDebutDate.split("-")[0]) : null;
    const lastYear = person.lastGameDate ? parseInt(person.lastGameDate.split("-")[0]) : null;

    // Build teams list from currentTeam + historical (API only gives current, so we use basic info)
    const teams: string[] = [];
    if (basic.currentTeam?.name) teams.push(basic.currentTeam.name);

    try {
      await db.insert(statlePlayers).values({
        mlbId: String(mlbId),
        name: person.fullName ?? basic.fullName,
        position: person.primaryPosition?.abbreviation ?? basic.primaryPosition?.abbreviation ?? "?",
        bats: person.batSide?.code ?? basic.batSide?.code ?? null,
        throwsHand: person.pitchHand?.code ?? basic.pitchHand?.code ?? null,
        birthCountry: person.birthCountry ?? basic.birthCountry ?? null,
        careerStart: debutYear,
        careerEnd: lastYear,
        teams: teams.length ? teams : null,
        careerWar: null,
        careerStats: stats ?? null,
        active: true,
      });
      inserted++;
    } catch (e: any) {
      // Duplicate or constraint error — skip
      if (!e.message?.includes("duplicate")) {
        console.warn(`  Failed to insert ${person.fullName}:`, e.message);
      }
      failed++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}  Skipped (existing): ${skipped}  Failed: ${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
