import { useState } from "react";
import { Zap, Target, BarChart, ExternalLink, Upload, ChevronRight, ChevronDown, ChevronUp, Film } from "lucide-react";
import { Link } from "wouter";
import { UserVideoCard } from "./UserVideoCard";
import { useQuery } from "@tanstack/react-query";
import heatmapImg from "@/assets/images/savant-heatmap.png";
import { Button } from "./ui/button";
import type { MlbPlayer, Video } from "@shared/schema";
import { fetchVideos } from "@/lib/api";

interface DataDashboardProps {
  player: MlbPlayer | null;
  onSelectVideo?: (videoUrl: string, label: string) => void;
}

interface HittingStat {
  gamesPlayed?: number; atBats?: number; runs?: number; hits?: number;
  doubles?: number; triples?: number; homeRuns?: number; rbi?: number;
  baseOnBalls?: number; strikeOuts?: number;
  avg?: string; obp?: string; slg?: string; ops?: string;
}
interface SeasonSplit { season: string; team?: { name: string }; stat: HittingStat; }
interface MlbStatsData { seasons: SeasonSplit[]; career: HittingStat | null; }
interface SprayPoint { x: number; y: number; event: string; exitVelo: number | null; distance: number | null; }
interface SprayData { points: SprayPoint[]; year: string; total: number; }

// ─── Event colours ─────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  home_run: "#ef4444",
  triple: "#f97316",
  double: "#eab308",
  single: "#22c55e",
};
const getEventColor = (e: string) => EVENT_COLORS[e] ?? "rgba(255,255,255,0.18)";
const getEventRadius = (e: string) => e === "home_run" ? 3.5 : e === "triple" || e === "double" ? 3 : 2.5;

// ─── Root ────────────────────────────────────────────────────────────────────

export default function DataDashboard({ player, onSelectVideo }: DataDashboardProps) {
  const { data: allVideos = [] } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
    queryFn: fetchVideos,
  });
  const userVideos = allVideos.filter(v => !v.isProVideo && v.sourceUrl);

  if (!player) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          Select an MLB player to view their profile and swing data.
        </div>
        {userVideos.length > 0 && <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerHeader player={player} />
      <StatsAndClipsSection player={player} allVideos={allVideos} onSelectVideo={onSelectVideo} />
      {player.savantId && <SavantSection player={player} />}
      {userVideos.length > 0 && <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />}
    </div>
  );
}

// ─── Player Header ────────────────────────────────────────────────────────────

function PlayerHeader({ player }: { player: MlbPlayer }) {
  const headshotUrl = player.savantId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.savantId}/headshot/67/current`
    : player.imageUrl ?? null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-5">
      <div className="w-16 h-16 rounded-full bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {headshotUrl ? (
          <img
            src={headshotUrl}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">
            {player.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold font-display">{player.name}</h2>
        <p className="text-muted-foreground text-sm">
          {player.team} · {player.position} · Bats {player.bats === "R" ? "Right" : player.bats === "L" ? "Left" : "Switch"}
          {player.height && ` · ${player.height}`}
          {player.weight && `, ${player.weight} lbs`}
        </p>
      </div>
      {player.savantId && (
        <a
          href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg hover:text-foreground transition-colors"
        >
          Baseball Savant <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ─── Stats + Season Clips ─────────────────────────────────────────────────────

function StatsAndClipsSection({
  player, allVideos, onSelectVideo,
}: {
  player: MlbPlayer;
  allVideos: Video[];
  onSelectVideo?: (url: string, label: string) => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState<string>("career");

  const { data: mlbData, isLoading } = useQuery<MlbStatsData>({
    queryKey: ["/api/mlb/stats", player.savantId],
    queryFn: () => fetch(`/api/mlb/players/${player.savantId}/stats`).then(r => r.json()),
    enabled: !!player.savantId,
  });

  const seasonYears = mlbData
    ? [...new Set(mlbData.seasons.map(s => s.season))].sort((a, b) => b.localeCompare(a))
    : [];

  const activeStat =
    selectedSeason === "career"
      ? mlbData?.career ?? null
      : mlbData?.seasons.find(s => s.season === selectedSeason)?.stat ?? null;

  const activeTeam =
    selectedSeason !== "career"
      ? mlbData?.seasons.find(s => s.season === selectedSeason)?.team?.name
      : undefined;

  const playerClips = allVideos.filter(
    v => v.isProVideo && v.sourceUrl &&
      (v.playerId === player.id || v.playerName?.toLowerCase() === player.name.toLowerCase())
  );
  const seasonClips = selectedSeason === "career"
    ? playerClips
    : playerClips.filter(v => (v as any).season === parseInt(selectedSeason));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Career Stats</h3>
          {!player.savantId && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded ml-2">
              Requires Savant ID
            </span>
          )}
        </div>
        {player.savantId && (
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
            <SeasonTab label="Career" active={selectedSeason === "career"} onClick={() => setSelectedSeason("career")} />
            {seasonYears.map(year => (
              <SeasonTab key={year} label={year} active={selectedSeason === year} onClick={() => setSelectedSeason(year)} />
            ))}
          </div>
        )}
      </div>

      <div className="p-5">
        {!player.savantId ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Add a Savant ID to this player to enable live MLB Stats.
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />)}
          </div>
        ) : activeStat ? (
          <>
            {activeTeam && <p className="text-xs text-muted-foreground mb-3">{activeTeam} · {selectedSeason} season</p>}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
              <StatBox label="AVG" value={activeStat.avg ?? "—"} highlight />
              <StatBox label="OBP" value={activeStat.obp ?? "—"} highlight />
              <StatBox label="SLG" value={activeStat.slg ?? "—"} highlight />
              <StatBox label="OPS" value={activeStat.ops ?? "—"} highlight />
              <StatBox label="HR"  value={activeStat.homeRuns?.toString() ?? "—"} />
              <StatBox label="RBI" value={activeStat.rbi?.toString() ?? "—"} />
              <StatBox label="R"   value={activeStat.runs?.toString() ?? "—"} />
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mt-3">
              <StatBox label="G"   value={activeStat.gamesPlayed?.toString() ?? "—"} />
              <StatBox label="AB"  value={activeStat.atBats?.toString() ?? "—"} />
              <StatBox label="H"   value={activeStat.hits?.toString() ?? "—"} />
              <StatBox label="2B"  value={activeStat.doubles?.toString() ?? "—"} />
              <StatBox label="3B"  value={activeStat.triples?.toString() ?? "—"} />
              <StatBox label="BB"  value={activeStat.baseOnBalls?.toString() ?? "—"} />
              <StatBox label="K"   value={activeStat.strikeOuts?.toString() ?? "—"} />
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No stats available for {selectedSeason === "career" ? "career" : `the ${selectedSeason} season`}.
          </div>
        )}
      </div>

      {playerClips.length > 0 && (
        <div className="border-t border-border px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {selectedSeason === "career" ? "All Pro Clips" : `${selectedSeason} Clips`}
            </h4>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">{seasonClips.length}</span>
          </div>
          {seasonClips.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {seasonClips.map(video => (
                <UserVideoCard
                  key={video.id}
                  video={video}
                  onSelect={onSelectVideo ? (v) => onSelectVideo(v.sourceUrl!, v.title) : undefined}
                  showDelete={false}
                  showTrim={false}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No clips tagged to {selectedSeason}. Tag clips by season in the Admin panel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SeasonTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground bg-primary/10"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {label}
    </button>
  );
}

function StatBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center ${highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"}`}>
      <div className={`text-xs font-medium mb-1 ${highlight ? "text-primary" : "text-muted-foreground"}`}>{label}</div>
      <div className={`text-lg font-bold font-mono leading-none ${highlight ? "text-foreground" : "text-foreground/80"}`}>{value}</div>
    </div>
  );
}

// ─── Savant Analytics ─────────────────────────────────────────────────────────

const SAVANT_YEARS = ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015"];

function SavantSection({ player }: { player: MlbPlayer }) {
  const [open, setOpen] = useState(true);
  const [sprayYear, setSprayYear] = useState("2024");

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Savant Analytics</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5">
          {/* Percentile Rankings */}
          <PercentileRankings player={player} />

          {/* Year selector for spray chart */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Spray chart season:</span>
            <select
              value={sprayYear}
              onChange={e => setSprayYear(e.target.value)}
              className="bg-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
            >
              {SAVANT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SprayChartPanel mlbId={player.savantId!} year={sprayYear} player={player} />
            {/* SLG Heatmap — placeholder */}
            <div className="bg-[#1A1C20] border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-card/80">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  SLG Heatmap ({player.bats === "R" ? "vs RHP" : "vs LHP"})
                </h4>
                <a href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </a>
              </div>
              <div className="relative min-h-65 flex items-center justify-center p-4">
                <img src={heatmapImg} alt="SLG Heatmap" className="w-full h-full object-contain mix-blend-screen opacity-90" />
                <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50">
                  <span>*Slugging Percentage</span>
                  <span>via baseballsavant.mlb.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Percentile Rankings ──────────────────────────────────────────────────────

function PercentileRankings({ player }: { player: MlbPlayer }) {
  const metrics = [
    { label: "Avg Exit Velocity", value: player.avgExitVelo, unit: "mph", pct: player.avgExitVeloPercentile },
    { label: "Max Exit Velocity", value: player.maxExitVelo, unit: "mph", pct: player.maxExitVeloPercentile },
    { label: "Barrel %", value: player.barrelPct, unit: "%", pct: player.barrelPctPercentile },
    { label: "Hard Hit %", value: player.hardHitPct, unit: "%", pct: player.hardHitPctPercentile },
    ...(player.batSpeed ? [{ label: "Bat Speed", value: player.batSpeed, unit: "mph", pct: null }] : []),
    ...(player.attackAngle != null ? [{ label: "Attack Angle", value: player.attackAngle, unit: "°", pct: null }] : []),
    ...(player.rotationalAccel != null ? [{ label: "Rot. Acceleration", value: player.rotationalAccel, unit: "g", pct: null }] : []),
  ];

  const getColor = (p: number) => {
    if (p >= 90) return "#d73027";
    if (p >= 67) return "#fc8d59";
    if (p >= 34) return "#fee090";
    if (p >= 11) return "#91bfdb";
    return "#4575b4";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {metrics.map(m => (
        <div key={m.label} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2.5">
          {m.pct != null ? (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-black"
              style={{ background: getColor(m.pct) }}
            >
              {m.pct}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-secondary border border-border text-xs font-mono text-muted-foreground">
              —
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">{m.label}</div>
            <div className="text-sm font-bold font-mono">
              {m.value != null ? `${m.value.toFixed(1)}${m.unit}` : "—"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live Spray Chart ─────────────────────────────────────────────────────────

function SprayChartPanel({ mlbId, year, player }: { mlbId: string; year: string; player: MlbPlayer }) {
  const { data, isLoading, isError } = useQuery<SprayData>({
    queryKey: ["/api/mlb/spray-chart", mlbId, year],
    queryFn: () => fetch(`/api/mlb/players/${mlbId}/spray-chart?year=${year}`).then(r => r.json()),
    staleTime: 1000 * 60 * 60,
  });

  return (
    <div className="bg-[#1A1C20] border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between bg-card/80">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Spray Chart · {year}
        </h4>
        <a
          href={`https://baseballsavant.mlb.com/savant-player/${mlbId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </a>
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="aspect-square flex items-center justify-center text-muted-foreground text-sm animate-pulse">
            Loading batted ball data…
          </div>
        ) : isError || !data?.points?.length ? (
          <div className="aspect-square flex items-center justify-center text-muted-foreground text-sm text-center px-4">
            {isError ? "Could not load spray chart." : `No batted ball data for ${year}.`}
          </div>
        ) : (
          <>
            <svg viewBox="0 0 250 250" className="w-full" style={{ maxHeight: 300 }}>
              <BaseballField />
              {data.points.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={getEventRadius(pt.event)}
                  fill={getEventColor(pt.event)}
                  opacity={pt.event in EVENT_COLORS ? 0.82 : 0.2}
                />
              ))}
            </svg>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs px-1">
              {[["HR", "#ef4444"], ["3B", "#f97316"], ["2B", "#eab308"], ["1B", "#22c55e"], ["Out", "rgba(255,255,255,0.35)"]].map(
                ([label, color]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: color as string }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                )
              )}
              <span className="text-muted-foreground ml-auto">{data.total} balls in play</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BaseballField() {
  return (
    <>
      {/* Foul territory background */}
      <rect width="250" height="250" fill="#111a11" />
      {/* Fair territory grass */}
      <path d="M 125 202 L 8 65 A 162 162 0 0 1 242 65 Z" fill="#1f4a1f" />
      {/* Warning track */}
      <path d="M 125 202 L 15 70 A 153 153 0 0 1 235 70 Z" fill="none" stroke="#7a5c10" strokeWidth="10" strokeOpacity="0.5" />
      {/* Infield dirt */}
      <ellipse cx="125" cy="163" rx="47" ry="43" fill="#7a5c10" opacity="0.4" />
      {/* Foul lines */}
      <line x1="125" y1="202" x2="0" y2="0" stroke="white" strokeWidth="0.7" strokeOpacity="0.45" />
      <line x1="125" y1="202" x2="250" y2="0" stroke="white" strokeWidth="0.7" strokeOpacity="0.45" />
      {/* Base paths */}
      <line x1="125" y1="202" x2="172" y2="163" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="172" y1="163" x2="125" y2="124" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="125" y1="124" x2="78" y2="163" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="78" y1="163" x2="125" y2="202" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
      {/* Pitcher mound */}
      <circle cx="125" cy="160" r="5" fill="#7a5c10" opacity="0.9" />
      {/* Bases */}
      <rect x="121" y="120" width="8" height="8" transform="rotate(45 125 124)" fill="white" opacity="0.9" />
      <rect x="168" y="159" width="8" height="8" transform="rotate(45 172 163)" fill="white" opacity="0.9" />
      <rect x="74" y="159" width="8" height="8" transform="rotate(45 78 163)" fill="white" opacity="0.9" />
      {/* Home plate */}
      <polygon points="125,207 121,203 121,199 129,199 129,203" fill="white" opacity="0.9" />
    </>
  );
}

// ─── Recent User Swings ───────────────────────────────────────────────────────

function UserVideosSection({ videos, onSelectVideo }: {
  videos: Video[];
  onSelectVideo?: (videoUrl: string, label: string) => void;
}) {
  const recent = videos.slice(0, 4);
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Recent Swings</h3>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">{videos.length}</span>
        </div>
        <Link href="/my-swings">
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {recent.map(video => (
          <UserVideoCard
            key={video.id}
            video={video}
            onSelect={onSelectVideo ? (v) => onSelectVideo(v.sourceUrl!, v.title) : undefined}
            showDelete={false}
            showTrim={true}
          />
        ))}
      </div>
    </div>
  );
}
