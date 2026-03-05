import { Activity, Zap, Target, BarChart, ChevronRight, Info, ExternalLink, Box } from "lucide-react";
import sprayChartImg from "@/assets/images/savant-spray.png";
import heatmapImg from "@/assets/images/savant-heatmap.png";
import swingPathImg from "@/assets/images/swing-path.png";
import { Button } from "./ui/button";

export default function DataDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Key Metrics - Savant Style */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground flex items-center gap-2">
            <BarChart className="w-5 h-5 text-primary" />
            Pro Profile: Mike Trout
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
            Savant Data
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <SavantMetricCard title="Avg Exit Velo" value="91.9" unit="mph" percentile={94} />
          <SavantMetricCard title="Max Exit Velo" value="114.4" unit="mph" percentile={96} />
          <SavantMetricCard title="Barrel %" value="15.3" unit="%" percentile={98} />
          <SavantMetricCard title="Hard Hit %" value="51.0" unit="%" percentile={92} />
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
              <span className="font-mono text-foreground">12.5°</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bat Speed</span>
              <span className="font-mono text-foreground">76.2 mph</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rotational Accel</span>
              <span className="font-mono text-foreground">18.4 g</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-auto leading-relaxed pt-4 border-t border-border/50">
            Trout generates elite bat speed with a steep attack angle, optimized for elevating the ball in the lower third of the zone.
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
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="relative flex-1 bg-[#1A1C20] min-h-[250px] flex items-center justify-center p-4 pt-16">
             <img src={sprayChartImg} alt="Baseball Savant Spray Chart" className="w-full h-full object-contain mix-blend-screen opacity-90" />
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50 px-2">
               <span>*Filtered by Fastballs, 2023 Season</span>
               <span>via baseballsavant.mlb.com</span>
             </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              SLG Heatmap (RHP)
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
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
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="relative flex-1 bg-[#1A1C20] min-h-[250px] md:min-h-[300px] flex items-center justify-center p-4 pt-16">
             <img src={swingPathImg} alt="Baseball Savant 3D Swing Path" className="w-full h-full object-cover mix-blend-screen opacity-90" />
             
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-white/50 px-2">
               <span>*Attack Angle: 12.5°</span>
               <span>via baseballsavant.mlb.com</span>
             </div>
          </div>
        </div>
        
      </div>

    </div>
  );
}

function SavantMetricCard({ title, value, unit, percentile }: any) {
  // Color based on percentile (Savant red/blue scale)
  const getPercentileColor = (p: number) => {
    if (p >= 90) return 'bg-[#d73027]'; // Savant Red
    if (p >= 75) return 'bg-[#fc8d59]'; // Savant Light Red/Orange
    if (p >= 50) return 'bg-[#fee090]'; // Savant Yellow/Neutral
    if (p >= 25) return 'bg-[#91bfdb]'; // Savant Light Blue
    return 'bg-[#4575b4]'; // Savant Blue
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