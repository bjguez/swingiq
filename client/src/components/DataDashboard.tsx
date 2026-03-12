import { useState } from "react";
import { Zap, Target, BarChart, Info, ExternalLink, Box, Upload, ChevronRight, ChevronDown, ChevronUp, Film } from "lucide-react";
import { Link } from "wouter";
import { UserVideoCard } from "./UserVideoCard";
import { useQuery } from "@tanstack/react-query";
import sprayChartImg from "@/assets/images/savant-spray.png";
import heatmapImg from "@/assets/images/savant-heatmap.png";
import swingPathImg from "@/assets/images/swing-path.png";
import { Button } from "./ui/button";
import type { MlbPlayer, Video } from "@shared/schema";
import { fetchVideos } from "@/lib/api";

interface DataDashboardProps {
  player: MlbPlayer | null;
  onSelectVideo?: (videoUrl: string, label: string) => void;
}

interface HittingStat {
  gamesPlayed?: number;
  atBats?: number;
  runs?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  avg?: string;
  obp?: string;
  slg?: string;
  ops?: string;
  stolenBases?: number;
}

interface SeasonSplit {
  season: string;
  team?: { name: string };
  stat: HittingStat;
}

interface MlbStatsData {
  seasons: SeasonSplit[];
  career: HittingStat | null;
}

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
        {userVideos.length > 0 && (
          <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerHeader player={player} />
      <StatsAndClipsSection player={player} allVideos={allVideos} onSelectVideo={onSelectVideo} />
      {player.savantId && <SavantSection player={player} />}
      {userVideos.length > 0 && (
        <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />
      )}
    </div>
  );
}

// ─── Player Header ────────────────────────────────────────────────────────────

function PlayerHeader({ player }: { player: MlbPlayer }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-5">
      <div className="w-16 h-16 rounded-full bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {player.imageUrl ? (
          <img src={player.imageUrl} alt={player.name} className="w-full h-full object-cover" />
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
          Baseball Savant
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ─── Stats + Season Clips ─────────────────────────────────────────────────────

function StatsAndClipsSection({
  player,
  allVideos,
  onSelectVideo,
}: {
  player: MlbPlayer;
  allVideos: Video[];
  onSelectVideo?: (url: string, label: string) => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState<string>("career");

  const { data: mlbData, isLoading } = useQuery<MlbStatsData>({
    queryKey: ["/api/mlb/stats", player.savantId],
    queryFn: () =>
      fetch(`/api/mlb/players/${player.savantId}/stats`).then(r => r.json()),
    enabled: !!player.savantId,
  });

  const seasonYears: string[] = mlbData
    ? [...new Set(mlbData.seasons.map(s => s.season))].sort((a, b) => b.localeCompare(a))
    : [];

  const activeStat: HittingStat | null =
    selectedSeason === "career"
      ? mlbData?.career ?? null
      : mlbData?.seasons.find(s => s.season === selectedSeason)?.stat ?? null;

  const activeTeam =
    selectedSeason !== "career"
      ? mlbData?.seasons.find(s => s.season === selectedSeason)?.team?.name
      : undefined;

  // Pro clips for this player, filtered by selected season
  const playerClips = allVideos.filter(
    v =>
      v.isProVideo &&
      v.sourceUrl &&
      (v.playerId === player.id || v.playerName?.toLowerCase() === player.name.toLowerCase())
  );
  const seasonClips =
    selectedSeason === "career"
      ? playerClips
      : playerClips.filter(v => (v as any).season === parseInt(selectedSeason));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Section header + season tabs */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Career Stats</h3>
          {!player.savantId && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded ml-2">
              Live stats require Savant ID
            </span>
          )}
        </div>

        {player.savantId && (
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
            <SeasonTab
              label="Career"
              active={selectedSeason === "career"}
              onClick={() => setSelectedSeason("career")}
            />
            {seasonYears.map(year => (
              <SeasonTab
                key={year}
                label={year}
                active={selectedSeason === year}
                onClick={() => setSelectedSeason(year)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stat display */}
      <div className="p-5">
        {!player.savantId ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Add a Savant ID to this player to enable live stat fetching from the MLB Stats API.
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activeStat ? (
          <>
            {activeTeam && (
              <p className="text-xs text-muted-foreground mb-3">{activeTeam} · {selectedSeason} season</p>
            )}
            <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-7 gap-3">
              <StatBox label="AVG" value={activeStat.avg ?? "—"} highlight />
              <StatBox label="OBP" value={activeStat.obp ?? "—"} highlight />
              <StatBox label="SLG" value={activeStat.slg ?? "—"} highlight />
              <StatBox label="OPS" value={activeStat.ops ?? "—"} highlight />
              <StatBox label="HR" value={activeStat.homeRuns?.toString() ?? "—"} />
              <StatBox label="RBI" value={activeStat.rbi?.toString() ?? "—"} />
              <StatBox label="R" value={activeStat.runs?.toString() ?? "—"} />
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mt-3">
              <StatBox label="G" value={activeStat.gamesPlayed?.toString() ?? "—"} />
              <StatBox label="AB" value={activeStat.atBats?.toString() ?? "—"} />
              <StatBox label="H" value={activeStat.hits?.toString() ?? "—"} />
              <StatBox label="2B" value={activeStat.doubles?.toString() ?? "—"} />
              <StatBox label="3B" value={activeStat.triples?.toString() ?? "—"} />
              <StatBox label="BB" value={activeStat.baseOnBalls?.toString() ?? "—"} />
              <StatBox label="K" value={activeStat.strikeOuts?.toString() ?? "—"} />
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No stats available for {selectedSeason === "career" ? "career" : `the ${selectedSeason} season`}.
          </div>
        )}
      </div>

      {/* Season clips */}
      {playerClips.length > 0 && (
        <div className="border-t border-border px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {selectedSeason === "career" ? "All Pro Clips" : `${selectedSeason} Clips`}
            </h4>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">
              {seasonClips.length}
            </span>
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
              No clips tagged to {selectedSeason}. Clips can be tagged by season in the Admin panel.
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
      <div className={`text-lg font-bold font-mono leading-none ${highlight ? "text-foreground" : "text-foreground/80"}`}>
        {value}
      </div>
    </div>
  );
}

// ─── Savant Analytics ─────────────────────────────────────────────────────────

function SavantSection({ player }: { player: MlbPlayer }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Savant Analytics</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">2024</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5">
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SavantMetricCard title="Avg Exit Velo" value={player.avgExitVelo?.toFixed(1) ?? "—"} unit="mph" percentile={player.avgExitVeloPercentile ?? 50} />
            <SavantMetricCard title="Max Exit Velo" value={player.maxExitVelo?.toFixed(1) ?? "—"} unit="mph" percentile={player.maxExitVeloPercentile ?? 50} />
            <SavantMetricCard title="Barrel %" value={player.barrelPct?.toFixed(1) ?? "—"} unit="%" percentile={player.barrelPctPercentile ?? 50} />
            <SavantMetricCard title="Hard Hit %" value={player.hardHitPct?.toFixed(1) ?? "—"} unit="%" percentile={player.hardHitPctPercentile ?? 50} />
          </div>

          {/* Biomechanics */}
          {(player.batSpeed || player.attackAngle || player.rotationalAccel) && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/40 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Bat Speed</div>
                <div className="text-lg font-bold font-mono">{player.batSpeed?.toFixed(1) ?? "—"} <span className="text-xs font-normal text-muted-foreground">mph</span></div>
              </div>
              <div className="bg-secondary/40 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Attack Angle</div>
                <div className="text-lg font-bold font-mono">{player.attackAngle?.toFixed(1) ?? "—"}<span className="text-xs font-normal text-muted-foreground">°</span></div>
              </div>
              <div className="bg-secondary/40 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Rot. Accel</div>
                <div className="text-lg font-bold font-mono">{player.rotationalAccel?.toFixed(1) ?? "—"} <span className="text-xs font-normal text-muted-foreground">g</span></div>
              </div>
            </div>
          )}

          {/* Visualizations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SavantChart
              title="Spray Chart"
              icon={<Target className="w-4 h-4 text-primary" />}
              href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`}
              img={sprayChartImg}
              caption={`*${player.name}, 2024 Season`}
            />
            <SavantChart
              title={`SLG Heatmap (vs ${player.bats === "R" ? "RHP" : "LHP"})`}
              icon={<Zap className="w-4 h-4 text-primary" />}
              href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`}
              img={heatmapImg}
              caption="*Slugging Percentage"
            />
          </div>
          <SavantChart
            title="3D Swing Path & Attack Angle"
            icon={<Box className="w-4 h-4 text-primary" />}
            href="https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle"
            img={swingPathImg}
            caption={`*Attack Angle: ${player.attackAngle?.toFixed(1) ?? "—"}°`}
            wide
          />
        </div>
      )}
    </div>
  );
}

function SavantChart({
  title,
  icon,
  href,
  img,
  caption,
  wide = false,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  img: string;
  caption: string;
  wide?: boolean;
}) {
  return (
    <div className={`bg-[#1A1C20] border border-border rounded-xl overflow-hidden relative ${wide ? "" : ""}`}>
      <div className="px-4 py-3 flex items-center justify-between bg-card/80 backdrop-blur">
        <h4 className="font-bold text-sm flex items-center gap-2">
          {icon}
          {title}
        </h4>
        <a href={href} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </a>
      </div>
      <div className={`relative flex items-center justify-center p-4 ${wide ? "min-h-[220px]" : "min-h-[200px]"}`}>
        <img src={img} alt={title} className="w-full h-full object-contain mix-blend-screen opacity-90" />
        <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50">
          <span>{caption}</span>
          <span>via baseballsavant.mlb.com</span>
        </div>
      </div>
    </div>
  );
}

function SavantMetricCard({ title, value, unit, percentile }: { title: string; value: string; unit: string; percentile: number }) {
  const getColor = (p: number) => {
    if (p >= 90) return "bg-[#d73027]";
    if (p >= 75) return "bg-[#fc8d59]";
    if (p >= 50) return "bg-[#fee090]";
    if (p >= 25) return "bg-[#91bfdb]";
    return "bg-[#4575b4]";
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col">
      <div className="text-xs text-muted-foreground font-medium mb-1 truncate">{title}</div>
      <div className="flex items-end gap-1 mb-3">
        <div className="text-2xl font-bold font-display leading-none">{value}</div>
        <div className="text-xs text-muted-foreground leading-none mb-0.5">{unit}</div>
      </div>
      <div className="mt-auto">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">MLB Percentile</span>
          <span className="font-mono">{percentile}th</span>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div className={`h-full ${getColor(percentile)}`} style={{ width: `${percentile}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Recent User Swings ───────────────────────────────────────────────────────

function UserVideosSection({
  videos,
  onSelectVideo,
}: {
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
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">
            {videos.length}
          </span>
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
