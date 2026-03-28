/**
 * Backfill teams for Statdle players using year-by-year stats.
 * Fetches all teams each player appeared with and stores abbreviations.
 *
 * Usage: npx tsx server/statdle-update-teams.ts
 */

import { db } from "./db";
import { statlePlayers } from "../shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";

const DELAY_MS = 120;
const BASE = "https://statsapi.mlb.com/api/v1";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchTeamsForPlayer(mlbId: string): Promise<string[]> {
  try {
    const data = await fetchJson(
      `${BASE}/people/${mlbId}?hydrate=stats(group=[hitting,pitching],type=yearByYear)`
    );
    const person = data.people?.[0];
    if (!person) return [];

    const seen = new Set<string>();
    const teams: string[] = [];

    for (const statGroup of person.stats ?? []) {
      for (const split of statGroup.splits ?? []) {
        const abbr = split.team?.abbreviation;
        if (abbr && !seen.has(abbr)) {
          seen.add(abbr);
          teams.push(abbr);
        }
      }
    }

    return teams;
  } catch {
    return [];
  }
}

async function main() {
  // Only backfill players in the active game pool
  const allPlayers = await db
    .select()
    .from(statlePlayers)
    .where(and(eq(statlePlayers.active, true), isNotNull(statlePlayers.careerStats)));

  // Apply same games filter as the game
  const players = allPlayers.filter(p => {
    const stats = (p.careerStats ?? {}) as Record<string, any>;
    const games = stats.games ?? 0;
    return stats.type === "pitcher" ? games >= 100 : games >= 300;
  });

  console.log(`Updating teams for ${players.length} players in game pool...`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (i % 50 === 0) console.log(`  ${i}/${players.length}...`);

    const teams = await fetchTeamsForPlayer(p.mlbId);
    await sleep(DELAY_MS);

    if (!teams.length) {
      failed++;
      continue;
    }

    await db
      .update(statlePlayers)
      .set({ teams })
      .where(eq(statlePlayers.mlbId, p.mlbId));

    updated++;
  }

  console.log(`\nDone. Updated: ${updated}  Failed: ${failed}  Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
