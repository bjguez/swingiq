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
        `/v1/schedule?sportId=1&date=${date}&hydrate=linescore`
      );
      const games = (data.dates?.[0]?.games ?? []).map((g: any) => ({
        gamePk: g.gamePk,
        status: g.status?.abstractGameState, // Preview | Live | Final
        detailedState: g.status?.detailedState,
        inning: g.linescore?.currentInningOrdinal ?? null,
        inningState: g.linescore?.inningState ?? null,
        away: {
          team: g.teams.away.team.name,
          abbrev: g.teams.away.team.abbreviation ?? g.teams.away.team.name.substring(0, 3).toUpperCase(),
          score: g.teams.away.score ?? 0,
          wins: g.teams.away.leagueRecord?.wins,
          losses: g.teams.away.leagueRecord?.losses,
        },
        home: {
          team: g.teams.home.team.name,
          abbrev: g.teams.home.team.abbreviation ?? g.teams.home.team.name.substring(0, 3).toUpperCase(),
          score: g.teams.home.score ?? 0,
          wins: g.teams.home.leagueRecord?.wins,
          losses: g.teams.home.leagueRecord?.losses,
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

  // ── Season batting leaders ────────────────────────────────────────────────
  app.get("/api/mlb/leaders", async (req, res) => {
    try {
      const season = new Date().getFullYear();
      const data = await mlbFetch(
        `/v1/stats/leaders?leaderCategories=battingAverage,homeRuns,onBasePlusSlugging,hits,runsBattedIn&season=${season}&sportId=1&limit=10&playerPool=Qualified`
      );
      const result: Record<string, any[]> = {};
      for (const cat of (data.leagueLeaders ?? [])) {
        result[cat.leaderCategory] = (cat.leaders ?? []).map((l: any) => ({
          rank: l.rank,
          value: l.value,
          name: l.person?.fullName,
          team: l.team?.name,
          teamAbbrev: l.team?.abbreviation,
          personId: l.person?.id,
        }));
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
