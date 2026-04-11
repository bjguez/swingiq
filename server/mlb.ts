import { Express } from "express";

const MLB_API = "https://statsapi.mlb.com/api";

async function mlbFetch(path: string) {
  const res = await fetch(`${MLB_API}${path}`);
  if (!res.ok) throw new Error(`MLB API error: ${res.status}`);
  return res.json();
}

export function setupMlbRoutes(app: Express) {

  // ── Today's scoreboard ───────────────────────────────────────────────────
  app.get("/api/mlb/schedule", async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const data = await mlbFetch(
        `/v1/schedule?sportId=1&date=${date}&hydrate=linescore,probablePitcher`
      );
      const games = (data.dates?.[0]?.games ?? []).map((g: any) => ({
        gamePk: g.gamePk,
        status: g.status?.abstractGameState, // Preview | Live | Final
        detailedState: g.status?.detailedState,
        inning: g.linescore?.currentInningOrdinal ?? null,
        inningState: g.linescore?.inningState ?? null,
        isTopInning: g.linescore?.isTopInning ?? null,
        away: {
          teamId: g.teams.away.team.id,
          team: g.teams.away.team.name,
          abbrev: g.teams.away.team.abbreviation ?? g.teams.away.team.name.substring(0, 3).toUpperCase(),
          score: g.teams.away.score ?? 0,
          wins: g.teams.away.leagueRecord?.wins,
          losses: g.teams.away.leagueRecord?.losses,
          isWinner: g.teams.away.isWinner ?? false,
          pitcher: g.teams.away.probablePitcher?.fullName ?? null,
        },
        home: {
          teamId: g.teams.home.team.id,
          team: g.teams.home.team.name,
          abbrev: g.teams.home.team.abbreviation ?? g.teams.home.team.name.substring(0, 3).toUpperCase(),
          score: g.teams.home.score ?? 0,
          wins: g.teams.home.leagueRecord?.wins,
          losses: g.teams.home.leagueRecord?.losses,
          isWinner: g.teams.home.isWinner ?? false,
          pitcher: g.teams.home.probablePitcher?.fullName ?? null,
        },
        gameTime: g.gameDate,
      }));
      res.json({ date, games });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Box score for a single game ──────────────────────────────────────────
  app.get("/api/mlb/boxscore/:gamePk", async (req, res) => {
    try {
      const data = await mlbFetch(`/v1.1/game/${req.params.gamePk}/feed/live`);
      const box = data.liveData?.boxscore;
      const linescore = data.liveData?.linescore;
      if (!box) return res.status(404).json({ message: "No boxscore" });

      function extractBatters(side: any) {
        return (side.batters ?? []).map((id: number) => {
          const p = side.players?.[`ID${id}`];
          if (!p) return null;
          const s = p.stats?.batting ?? {};
          return {
            id,
            name: p.person?.fullName,
            position: p.position?.abbreviation,
            atBats: s.atBats ?? 0,
            hits: s.hits ?? 0,
            runs: s.runs ?? 0,
            rbi: s.rbi ?? 0,
            homeRuns: s.homeRuns ?? 0,
            strikeOuts: s.strikeOuts ?? 0,
            baseOnBalls: s.baseOnBalls ?? 0,
            avg: p.seasonStats?.batting?.avg ?? ".---",
            ops: p.seasonStats?.batting?.ops ?? ".---",
          };
        }).filter(Boolean);
      }

      res.json({
        away: {
          team: data.gameData?.teams?.away?.name,
          abbrev: data.gameData?.teams?.away?.abbreviation,
          batters: extractBatters(box.teams.away),
        },
        home: {
          team: data.gameData?.teams?.home?.name,
          abbrev: data.gameData?.teams?.home?.abbreviation,
          batters: extractBatters(box.teams.home),
        },
        linescore: {
          innings: linescore?.innings ?? [],
          away: { runs: linescore?.teams?.away?.runs ?? 0, hits: linescore?.teams?.away?.hits ?? 0, errors: linescore?.teams?.away?.errors ?? 0 },
          home: { runs: linescore?.teams?.home?.runs ?? 0, hits: linescore?.teams?.home?.hits ?? 0, errors: linescore?.teams?.home?.errors ?? 0 },
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Hot hitters — recent counting stats (no sample-size issues) ──────────
  app.get("/api/mlb/leaders/recent", async (req, res) => {
    try {
      const days = Math.min(parseInt((req.query.days as string) || "7", 10), 30);
      const season = new Date().getFullYear();
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const data = await mlbFetch(
        `/v1/stats/leaders?leaderCategories=hits,homeRuns,runsBattedIn,stolenBases` +
        `&season=${season}&sportId=1&limit=10&playerPool=All&statGroup=hitting` +
        `&startDate=${fmt(start)}&endDate=${fmt(end)}`
      );
      const result: Record<string, any[]> = {};
      for (const cat of (data.leagueLeaders ?? [])) {
        result[cat.leaderCategory] = (cat.leaders ?? []).slice(0, 10).map((l: any) => ({
          rank: l.rank, value: l.value,
          name: l.person?.fullName, team: l.team?.name, teamAbbrev: l.team?.abbreviation,
        }));
      }
      res.json({ days, result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Today's top performers — aggregate box scores for live/final games ──────
  app.get("/api/mlb/performers/today", async (req, res) => {
    try {
      // Use Eastern time — MLB schedules games by ET
      const etParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date());
      const et = Object.fromEntries(etParts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
      const date = `${et.year}-${et.month}-${et.day}`;
      const schedule = await mlbFetch(`/v1/schedule?sportId=1&date=${date}&hydrate=linescore`);
      const games: any[] = schedule.dates?.[0]?.games ?? [];

      // Only pull box scores for games that have started
      const active = games.filter(g => g.status?.abstractGameState !== "Preview");
      if (active.length === 0) return res.json({ date, performers: [] });

      const feeds = await Promise.all(
        active.map(g => mlbFetch(`/v1.1/game/${g.gamePk}/feed/live`).catch(() => null))
      );

      const performers: any[] = [];

      for (let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        if (!feed) continue;
        const box = feed.liveData?.boxscore;
        if (!box) continue;
        const gameData = feed.gameData;
        const gameStatus = gameData?.status?.abstractGameState;
        const inning = feed.liveData?.linescore?.currentInningOrdinal ?? null;
        const inningState = feed.liveData?.linescore?.inningState ?? null;

        for (const side of ["away", "home"] as const) {
          const teamInfo = gameData?.teams?.[side];
          const teamName = teamInfo?.name ?? "";
          const teamAbbrev = teamInfo?.abbreviation ?? "";
          const teamId = teamInfo?.id ?? 0;
          const opponent = gameData?.teams?.[side === "away" ? "home" : "away"];
          const opponentAbbrev = opponent?.abbreviation ?? "";

          (box.teams[side].batters ?? []).forEach((id: number) => {
            const p = box.teams[side].players?.[`ID${id}`];
            if (!p) return;
            const s = p.stats?.batting ?? {};
            const hits = s.hits ?? 0;
            const hr = s.homeRuns ?? 0;
            const rbi = s.rbi ?? 0;
            const ab = s.atBats ?? 0;
            // Skip players with nothing to show
            if (hits === 0 && hr === 0 && rbi === 0) return;
            performers.push({
              id,
              name: p.person?.fullName,
              position: p.position?.abbreviation,
              teamId,
              team: teamName,
              teamAbbrev,
              opponentAbbrev,
              hits, hr, rbi, ab,
              runs: s.runs ?? 0,
              bb: s.baseOnBalls ?? 0,
              k: s.strikeOuts ?? 0,
              avg: p.seasonStats?.batting?.avg ?? ".---",
              gameStatus,
              inning,
              inningState,
              // composite sort score
              score: hits * 2 + hr * 5 + rbi * 1.5,
            });
          });
        }
      }

      // Dedupe by player id (can appear if somehow in two feeds), sort best first
      const seen = new Set<number>();
      const unique = performers.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      unique.sort((a, b) => b.score - a.score);

      res.json({ date, performers: unique.slice(0, 20) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Season leaders — rate stats with qualified pool ───────────────────────
  app.get("/api/mlb/leaders/season", async (req, res) => {
    try {
      const season = new Date().getFullYear();
      const data = await mlbFetch(
        `/v1/stats/leaders?leaderCategories=battingAverage,homeRuns,onBasePlusSlugging,hits,runsBattedIn` +
        `&season=${season}&sportId=1&limit=10&playerPool=Qualified`
      );
      const result: Record<string, any[]> = {};
      for (const cat of (data.leagueLeaders ?? [])) {
        if (cat.statGroup !== "hitting") continue;
        result[cat.leaderCategory] = (cat.leaders ?? []).slice(0, 10).map((l: any) => ({
          rank: l.rank, value: l.value,
          name: l.person?.fullName, team: l.team?.name, teamAbbrev: l.team?.abbreviation,
        }));
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
