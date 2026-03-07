import { Zap, Target, BarChart, Info, ExternalLink, Box, Upload, Play, Film } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import sprayChartImg from "@/assets/images/savant-spray.png";
import heatmapImg from "@/assets/images/savant-heatmap.png";
import swingPathImg from "@/assets/images/swing-path.png";
import { Button } from "./ui/button";
import type { MlbPlayer, Video } from "@shared/schema";

interface DataDashboardProps {
  player: MlbPlayer | null;
  onSelectVideo?: (videoUrl: string, label: string) => void;
}

export default function DataDashboard({ player, onSelectVideo }: DataDashboardProps) {
  const { data: allVideos = [] } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
    queryFn: () => fetch("/api/videos").then(r => r.json()),
  });

  const userVideos = allVideos.filter(v => !v.isProVideo && v.sourceUrl);

  if (!player) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          Select an MLB player to view their Savant profile and swing data.
        </div>
        {userVideos.length > 0 && (
          <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Key Metrics - Savant Style */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground flex items-center gap-2">
            <BarChart className="w-5 h-5 text-primary" />
            Pro Profile: {player.name}
          </h3>
          <a 
            href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`}
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Savant Data
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <SavantMetricCard title="Avg Exit Velo" value={player.avgExitVelo?.toFixed(1) ?? "—"} unit="mph" percentile={player.avgExitVeloPercentile ?? 50} />
          <SavantMetricCard title="Max Exit Velo" value={player.maxExitVelo?.toFixed(1) ?? "—"} unit="mph" percentile={player.maxExitVeloPercentile ?? 50} />
          <SavantMetricCard title="Barrel %" value={player.barrelPct?.toFixed(1) ?? "—"} unit="%" percentile={player.barrelPctPercentile ?? 50} />
          <SavantMetricCard title="Hard Hit %" value={player.hardHitPct?.toFixed(1) ?? "—"} unit="%" percentile={player.hardHitPctPercentile ?? 50} />
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 mt-2 shadow-sm flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-sm text-muted-foreground flex items-center gap-1">
              Swing Biomechanics
              <Info className="w-3 h-3 text-muted-foreground" />
            </h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attack Angle</span>
              <span className="font-mono text-foreground">{player.attackAngle?.toFixed(1) ?? "—"}°</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bat Speed</span>
              <span className="font-mono text-foreground">{player.batSpeed?.toFixed(1) ?? "—"} mph</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rotational Accel</span>
              <span className="font-mono text-foreground">{player.rotationalAccel?.toFixed(1) ?? "—"} g</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-auto leading-relaxed pt-4 border-t border-border/50">
            {player.name} ({player.height}, {player.weight}lbs) bats {player.bats === "R" ? "right-handed" : "left-handed"} for the {player.team}.
          </p>
        </div>
      </div>

      {/* Visualizations - Savant Imports */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Spray Chart */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Savant Spray Chart
            </h3>
            <a href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Button>
            </a>
          </div>
          <div className="relative flex-1 bg-[#1A1C20] min-h-[250px] flex items-center justify-center p-4 pt-16">
             <img src={sprayChartImg} alt="Baseball Savant Spray Chart" className="w-full h-full object-contain mix-blend-screen opacity-90" />
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50 px-2">
               <span>*{player.name}, 2024 Season</span>
               <span>via baseballsavant.mlb.com</span>
             </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              SLG Heatmap ({player.bats === "R" ? "vs RHP" : "vs LHP"})
            </h3>
            <a href={`https://baseballsavant.mlb.com/savant-player/${player.savantId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Button>
            </a>
          </div>
          <div className="relative flex-1 bg-[#1A1C20] min-h-[250px] flex items-center justify-center p-4 pt-16">
             <img src={heatmapImg} alt="Baseball Savant Damage Zone Heatmap" className="w-full h-full object-contain mix-blend-screen opacity-90" />
             
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50 px-2">
               <span>*Slugging Percentage</span>
               <span>via baseballsavant.mlb.com</span>
             </div>
          </div>
        </div>

        {/* Swing Path 3D */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group md:col-span-2">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Box className="w-4 h-4 text-primary" />
              3D Swing Path & Attack Angle
            </h3>
            <a href="https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Button>
            </a>
          </div>
          <div className="relative flex-1 bg-[#1A1C20] min-h-[250px] md:min-h-[300px] flex items-center justify-center p-4 pt-16">
             <img src={swingPathImg} alt="Baseball Savant 3D Swing Path" className="w-full h-full object-cover mix-blend-screen opacity-90" />
             
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50 px-2">
               <span>*Attack Angle: {player.attackAngle?.toFixed(1) ?? "—"}°</span>
               <span>via baseballsavant.mlb.com</span>
             </div>
          </div>
        </div>
        
      </div>

    </div>

    {userVideos.length > 0 && (
      <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />
    )}
    </div>
  );
}

function UserVideosSection({ videos, onSelectVideo }: { videos: Video[], onSelectVideo?: (videoUrl: string, label: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Upload className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">
          My Uploaded Swings
        </h3>
        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">
          {videos.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {videos.map(video => (
          <div
            key={video.id}
            data-testid={`user-video-card-${video.id}`}
            className="bg-secondary/30 border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group"
          >
            <div className="aspect-video bg-black relative flex items-center justify-center">
              <video
                src={video.sourceUrl ?? undefined}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  v.currentTime = 0.5;
                }}
              />
              {onSelectVideo && video.sourceUrl && (
                <button
                  data-testid={`load-user-video-${video.id}`}
                  onClick={() => onSelectVideo(video.sourceUrl!, video.title)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="bg-primary rounded-full p-2">
                    <Play className="w-5 h-5 text-primary-foreground fill-current" />
                  </div>
                </button>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium truncate" data-testid={`user-video-title-${video.id}`}>
                {video.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Film className="w-3 h-3" />
                <span>{video.category}</span>
                {video.duration && <span>· {video.duration}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavantMetricCard({ title, value, unit, percentile }: any) {
  const getPercentileColor = (p: number) => {
    if (p >= 90) return 'bg-[#d73027]';
    if (p >= 75) return 'bg-[#fc8d59]';
    if (p >= 50) return 'bg-[#fee090]';
    if (p >= 25) return 'bg-[#91bfdb]';
    return 'bg-[#4575b4]';
  };

  const pColor = getPercentileColor(percentile);

  return (
    <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors flex flex-col">
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
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex">
          <div className={`h-full ${pColor}`} style={{ width: `${percentile}%` }}></div>
        </div>
      </div>
    </div>
  );
}