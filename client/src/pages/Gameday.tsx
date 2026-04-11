import { useState } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trophy, TrendingUp, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

// ── Types ─────────────────────────────────────────────────────────────────────

type GameSummary = {
  gamePk: number;
  status: string; // Preview | Live | Final
  detailedState: string;
  inning: string | null;
  inningState: string | null;
  away: { team: string; abbrev: string; score: number; wins: number; losses: number };
  home: { team: string; abbrev: string; score: number; wins: number; losses: number };
  gameTime: string;
};

type Batter = {
  id: number; name: string; position: string;
  atBats: number; hits: number; runs: number; rbi: number;
  homeRuns: number; strikeOuts: number; baseOnBalls: number;
  avg: string; ops: string;
};

type BoxScore = {
  away: { team: string; abbrev: string; batters: Batter[] };
  home: { team: string; abbrev: string; batters: Batter[] };
  linescore: {
    innings: { num: number; away: { runs: number }; home: { runs: number } }[];
    away: { runs: number; hits: number; errors: number };
    home: { runs: number; hits: number; errors: number };
  };
};

type Leader = { rank: number; value: string; name: string; team: string; teamAbbrev: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatGameTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  } catch { return ""; }
}

// ── Scoreboard ────────────────────────────────────────────────────────────────

function ScoreboardTab() {
  const [date, setDate] = useState(dateStr(new Date()));
  const [selectedGame, setSelectedGame] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ date: string; games: GameSummary[] }>({
    queryKey: ["/api/mlb/schedule", date],
    queryFn: () => fetch(`/api/mlb/schedule?date=${date}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: boxScore, isLoading: boxLoading } = useQuery<BoxScore>({
    queryKey: ["/api/mlb/boxscore", selectedGame],
    queryFn: () => fetch(`/api/mlb/boxscore/${selectedGame}`).then(r => r.json()),
    enabled: !!selectedGame,
  });

  function shiftDate(days: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + days);
    setDate(dateStr(d));
    setSelectedGame(null);
  }

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (selectedGame && boxScore) {
    return <BoxScoreView box={boxScore} loading={boxLoading} onBack={() => setSelectedGame(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-sm font-semibold">{displayDate}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && data?.games.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">No games scheduled for this date.</p>
      )}

      <div className="space-y-2">
        {data?.games.map(game => (
          <button
            key={game.gamePk}
            onClick={() => setSelectedGame(game.gamePk)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-4 hover:border-primary/40 transition-colors text-left"
          >
            {/* Status */}
            <div className="w-20 shrink-0 text-center">
              {game.status === "Live" ? (
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-green-400 block">LIVE</span>
                  <span className="text-[10px] text-muted-foreground">{game.inning} {game.inningState}</span>
                </div>
              ) : game.status === "Final" ? (
                <span className="text-xs font-semibold text-muted-foreground">Final</span>
              ) : (
                <span className="text-xs text-muted-foreground">{formatGameTime(game.gameTime)}</span>
              )}
            </div>

            {/* Away */}
            <div className="flex-1 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-8 ${game.status === "Final" && game.away.score > game.home.score ? "text-foreground" : "text-muted-foreground"}`}>
                    {game.away.abbrev}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({game.away.wins}-{game.away.losses})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-8 ${game.status === "Final" && game.home.score > game.away.score ? "text-foreground" : "text-muted-foreground"}`}>
                    {game.home.abbrev}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({game.home.wins}-{game.home.losses})</span>
                </div>
              </div>
              {game.status !== "Preview" && (
                <div className="space-y-1.5 text-right">
                  <div className={`text-sm font-bold ${game.status === "Final" && game.away.score > game.home.score ? "text-foreground" : "text-muted-foreground"}`}>
                    {game.away.score}
                  </div>
                  <div className={`text-sm font-bold ${game.status === "Final" && game.home.score > game.away.score ? "text-foreground" : "text-muted-foreground"}`}>
                    {game.home.score}
                  </div>
                </div>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Box Score ─────────────────────────────────────────────────────────────────

function BoxScoreView({ box, loading, onBack }: { box: BoxScore; loading: boolean; onBack: () => void }) {
  const [side, setSide] = useState<"away" | "home">("away");
  const team = box[side];
  const ls = box.linescore;

  if (loading) return <div className="h-40 bg-card border border-border rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>

      {/* Linescore */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-16">Team</th>
              {ls.innings.map(inn => (
                <th key={inn.num} className="px-2 py-2 text-muted-foreground font-medium text-center w-7">{inn.num}</th>
              ))}
              <th className="px-2 py-2 text-muted-foreground font-medium text-center w-8 border-l border-border">R</th>
              <th className="px-2 py-2 text-muted-foreground font-medium text-center w-8">H</th>
              <th className="px-2 py-2 text-muted-foreground font-medium text-center w-8">E</th>
            </tr>
          </thead>
          <tbody>
            {(["away", "home"] as const).map(s => (
              <tr key={s} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-bold">{box[s].abbrev}</td>
                {ls.innings.map(inn => (
                  <td key={inn.num} className="px-2 py-2 text-center text-muted-foreground">
                    {(inn as any)[s]?.runs ?? "-"}
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-bold border-l border-border">{ls[s].runs}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{ls[s].hits}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{ls[s].errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team toggle */}
      <div className="flex gap-2">
        {(["away", "home"] as const).map(s => (
          <Button key={s} size="sm" variant={side === s ? "default" : "outline"} onClick={() => setSide(s)} className="flex-1">
            {box[s].abbrev}
          </Button>
        ))}
      </div>

      {/* Batting box */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Batter</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">AB</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">H</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">R</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">RBI</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">HR</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">K</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">BB</th>
              <th className="px-2 py-2 text-center text-muted-foreground font-medium">AVG</th>
            </tr>
          </thead>
          <tbody>
            {team.batters.map(b => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-muted-foreground ml-1">{b.position}</span>
                  {b.hits >= 2 && <span className="ml-1.5 text-[9px] font-bold text-yellow-400 bg-yellow-400/10 px-1 py-0.5 rounded">🔥 {b.hits}H</span>}
                </td>
                <td className="px-2 py-2 text-center">{b.atBats}</td>
                <td className={`px-2 py-2 text-center font-semibold ${b.hits > 0 ? "text-primary" : ""}`}>{b.hits}</td>
                <td className="px-2 py-2 text-center">{b.runs}</td>
                <td className={`px-2 py-2 text-center ${b.rbi > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{b.rbi}</td>
                <td className={`px-2 py-2 text-center ${b.homeRuns > 0 ? "text-red-400 font-bold" : "text-muted-foreground"}`}>{b.homeRuns || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{b.strikeOuts || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{b.baseOnBalls || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{b.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Hot Hitters ───────────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  battingAverage: "AVG",
  homeRuns: "HR",
  onBasePlusSlugging: "OPS",
  hits: "H",
  runsBattedIn: "RBI",
};

function HotHittersTab() {
  const [activeStat, setActiveStat] = useState("battingAverage");

  const { data, isLoading } = useQuery<Record<string, Leader[]>>({
    queryKey: ["/api/mlb/leaders"],
    queryFn: () => fetch("/api/mlb/leaders").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const stats = Object.keys(STAT_LABELS);
  const leaders = data?.[activeStat] ?? [];

  return (
    <div className="space-y-4">
      {/* Stat tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {stats.map(stat => (
          <button
            key={stat}
            onClick={() => setActiveStat(stat)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeStat === stat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {STAT_LABELS[stat]}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {leaders.map((l, i) => (
          <div key={i} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <span className={`text-sm font-bold w-5 shrink-0 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
              {l.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{l.name}</p>
              <p className="text-xs text-muted-foreground">{l.team}</p>
            </div>
            <span className="text-lg font-bold text-primary shrink-0">{l.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "scoreboard" | "hitters";

export default function GamedayPage() {
  usePageMeta({ title: "Gameday" });
  const [tab, setTab] = useState<Tab>("scoreboard");

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Tv2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold font-display">Gameday</h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 border-b border-border pb-0">
          <button
            onClick={() => setTab("scoreboard")}
            className={`pb-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${tab === "scoreboard" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Scoreboard
          </button>
          <button
            onClick={() => setTab("hitters")}
            className={`pb-2 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${tab === "hitters" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Hot Hitters
          </button>
        </div>

        {tab === "scoreboard" && <ScoreboardTab />}
        {tab === "hitters" && <HotHittersTab />}
      </div>
    </Layout>
  );
}
