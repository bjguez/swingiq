import { useState } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, TrendingUp, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSearch } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamInfo = {
  teamId: number;
  team: string;
  abbrev: string;
  score: number;
  wins: number;
  losses: number;
  isWinner: boolean;
  pitcher: string | null;
};

type GameSummary = {
  gamePk: number;
  status: string; // Preview | Live | Final
  detailedState: string;
  inning: string | null;
  inningState: string | null;
  isTopInning: boolean | null;
  away: TeamInfo;
  home: TeamInfo;
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

type Performer = {
  id: number; name: string; position: string;
  teamId: number; team: string; teamAbbrev: string; opponentAbbrev: string;
  hits: number; hr: number; rbi: number; ab: number;
  runs: number; bb: number; k: number; avg: string;
  gameStatus: string; inning: string | null; inningState: string | null;
};

// ── ESPN logo CDN — maps MLB team ID to ESPN slug ─────────────────────────────

const ESPN_SLUG: Record<number, string> = {
  108: "laa", 109: "ari", 110: "bal", 111: "bos", 112: "chc",
  113: "cin", 114: "cle", 115: "col", 116: "det", 117: "hou",
  118: "kc",  119: "lad", 120: "wsh", 121: "nym", 133: "oak",
  134: "pit",  135: "sd",  136: "sea", 137: "sf",  138: "stl",
  139: "tb",  140: "tex", 141: "tor", 142: "min", 143: "phi",
  144: "atl", 145: "cws", 146: "mia", 147: "nyy", 158: "mil",
};

function teamLogo(teamId: number) {
  const slug = ESPN_SLUG[teamId];
  if (!slug) return null;
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`;
}

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

// ── Game Card ─────────────────────────────────────────────────────────────────

function GameCard({ game, onClick }: { game: GameSummary; onClick: () => void }) {
  const isLive = game.status === "Live";
  const isFinal = game.status === "Final";
  const isPreview = game.status === "Preview";

  function TeamRow({ t, opponent, isTop }: { t: TeamInfo; opponent: TeamInfo; isTop: boolean }) {
    const logoUrl = teamLogo(t.teamId);
    const winning = isFinal ? t.isWinner : (isLive && t.score > opponent.score);
    return (
      <div className={`flex items-center gap-3 py-2.5 px-4 ${isTop ? "border-b border-border/50" : ""}`}>
        {/* Logo */}
        <div className="w-8 h-8 shrink-0 flex items-center justify-center">
          {logoUrl
            ? <img src={logoUrl} alt={t.abbrev} className="w-8 h-8 object-contain" />
            : <span className="text-xs font-bold text-muted-foreground">{t.abbrev}</span>
          }
        </div>
        {/* Name + record */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${winning ? "text-foreground" : "text-muted-foreground"}`}>
            {t.abbrev}
          </p>
          <p className="text-[10px] text-muted-foreground">{t.wins}-{t.losses}</p>
        </div>
        {/* Score */}
        {!isPreview && (
          <span className={`text-xl font-bold tabular-nums w-7 text-right ${winning ? "text-foreground" : "text-muted-foreground"}`}>
            {t.score}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors text-left w-full flex flex-col"
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-green-400">
              {game.isTopInning ? "▲" : "▼"} {game.inning}
            </span>
          </div>
        ) : isFinal ? (
          <span className="text-xs font-semibold text-muted-foreground">Final</span>
        ) : (
          <span className="text-xs text-muted-foreground">{formatGameTime(game.gameTime)}</span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
      </div>

      {/* Teams */}
      <div className="flex-1">
        <TeamRow t={game.away} opponent={game.home} isTop={true} />
        <TeamRow t={game.home} opponent={game.away} isTop={false} />
      </div>

      {/* Pitcher line */}
      {(game.away.pitcher || game.home.pitcher) && (
        <div className="px-4 py-2 border-t border-border/50 flex gap-3 text-[10px] text-muted-foreground">
          <span className="truncate">{game.away.abbrev}: {game.away.pitcher ?? "TBD"}</span>
          <span className="text-border/80">·</span>
          <span className="truncate">{game.home.abbrev}: {game.home.pitcher ?? "TBD"}</span>
        </div>
      )}
    </button>
  );
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

  if (selectedGame) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && data?.games.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">No games scheduled for this date.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.games.map(game => (
          <GameCard key={game.gamePk} game={game} onClick={() => setSelectedGame(game.gamePk)} />
        ))}
      </div>
    </div>
  );
}

// ── Box Score ─────────────────────────────────────────────────────────────────

function BoxScoreView({ box, loading, onBack }: { box?: BoxScore; loading: boolean; onBack: () => void }) {
  const [side, setSide] = useState<"away" | "home">("away");

  if (loading || !box) return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>
      <div className="h-40 bg-card border border-border rounded-xl animate-pulse" />
    </div>
  );

  const team = box[side];
  const ls = box.linescore;

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

// ── Hot Hitters — today's top performers ─────────────────────────────────────

function PerformerCard({ p }: { p: Performer }) {
  const logoUrl = teamLogo(p.teamId);
  const isLive = p.gameStatus === "Live";
  const statLine = [
    `${p.hits}-${p.ab}`,
    p.hr > 0 && `${p.hr} HR`,
    p.rbi > 0 && `${p.rbi} RBI`,
    p.runs > 0 && `${p.runs} R`,
    p.bb > 0 && `${p.bb} BB`,
  ].filter(Boolean).join(", ");

  // Headline: pick the flashiest stat
  const headline = p.hr >= 2 ? `${p.hr} HR` : p.hr === 1 ? "HR" : p.hits >= 3 ? `${p.hits}-${p.ab}` : p.rbi >= 3 ? `${p.rbi} RBI` : `${p.hits}-${p.ab}`;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Team color bar + live indicator */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5">
          {logoUrl
            ? <img src={logoUrl} alt={p.teamAbbrev} className="w-5 h-5 object-contain" />
            : <span className="text-[10px] font-bold text-muted-foreground">{p.teamAbbrev}</span>
          }
          <span className="text-[10px] font-semibold text-muted-foreground">{p.teamAbbrev} vs {p.opponentAbbrev}</span>
        </div>
        {isLive ? (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400">
              {p.inningState === "Top" ? "▲" : "▼"} {p.inning}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">Final</span>
        )}
      </div>

      {/* Player info + headline stat */}
      <div className="px-3 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight truncate">{p.name}</p>
          <p className="text-[10px] text-muted-foreground">{p.position} · {p.avg} AVG</p>
          <p className="text-xs text-muted-foreground mt-1.5">{statLine}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-black text-primary leading-none">{headline}</p>
        </div>
      </div>
    </div>
  );
}

function HotHittersTab() {
  const { data, isLoading } = useQuery<{ date: string; performers: Performer[] }>({
    queryKey: ["/api/mlb/performers/today"],
    queryFn: () => fetch("/api/mlb/performers/today").then(r => r.json()),
    refetchInterval: 60000,
  });

  const performers = data?.performers ?? [];

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />)}
    </div>
  );

  if (performers.length === 0) return (
    <div className="text-center py-16 space-y-2">
      <TrendingUp className="w-8 h-8 text-muted-foreground/40 mx-auto" />
      <p className="text-sm font-semibold text-muted-foreground">No games in progress yet</p>
      <p className="text-xs text-muted-foreground">Top performers will appear here once today's games begin.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Top performers from today's games</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {performers.map(p => <PerformerCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

// ── Season Leaders ────────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  battingAverage: "AVG",
  homeRuns: "HR",
  onBasePlusSlugging: "OPS",
  hits: "H",
  runsBattedIn: "RBI",
};

function LeaderList({ leaders, isLoading }: { leaders: Leader[]; isLoading: boolean }) {
  if (isLoading) return (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}
    </div>
  );
  return (
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
  );
}

function SeasonLeadersTab() {
  const [activeStat, setActiveStat] = useState("battingAverage");

  const { data, isLoading } = useQuery<Record<string, Leader[]>>({
    queryKey: ["/api/mlb/leaders/season"],
    queryFn: () => fetch("/api/mlb/leaders/season").then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Qualified batters — {new Date().getFullYear()} season</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {Object.entries(STAT_LABELS).map(([stat, label]) => (
          <button key={stat} onClick={() => setActiveStat(stat)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeStat === stat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <LeaderList leaders={(data as any)?.[activeStat] ?? []} isLoading={isLoading} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "scoreboard" | "hitters" | "leaders";

export default function GamedayPage() {
  usePageMeta({ title: "Gameday" });
  const search = useSearch();
  const qTab = new URLSearchParams(search).get("tab");
  const initialTab: Tab = qTab === "hitters" ? "hitters" : qTab === "leaders" ? "leaders" : "scoreboard";
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabClass = (t: Tab) =>
    `pb-2 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Tv2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold font-display">Gameday</h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-4 border-b border-border">
          <button onClick={() => setTab("scoreboard")} className={tabClass("scoreboard")}>
            Scoreboard
          </button>
          <button onClick={() => setTab("hitters")} className={tabClass("hitters")}>
            <TrendingUp className="w-3.5 h-3.5" />
            Hot Hitters
          </button>
          <button onClick={() => setTab("leaders")} className={tabClass("leaders")}>
            Season Leaders
          </button>
        </div>

        {tab === "scoreboard" && <ScoreboardTab />}
        {tab === "hitters" && <HotHittersTab />}
        {tab === "leaders" && <SeasonLeadersTab />}
      </div>
    </Layout>
  );
}
