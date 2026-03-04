import { Activity, Zap, Target, BarChart, ChevronRight, Info } from "lucide-react";
import sprayChartImg from "@/assets/images/spray-chart.png";
import heatmapImg from "@/assets/images/heatmap.png";
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
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">Savant Data</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <SavantMetricCard title="Avg Exit Velo" value="91.9" unit="mph" percentile={94} />
          <SavantMetricCard title="Max Exit Velo" value="114.4" unit="mph" percentile={96} />
          <SavantMetricCard title="Barrel %" value="15.3" unit="%" percentile={98} />
          <SavantMetricCard title="Hard Hit %" value="51.0" unit="%" percentile={92} />
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 mt-2 shadow-sm">
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
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed pt-3 border-t border-border/50">
            Trout generates elite bat speed with a steep attack angle, optimized for elevating the ball in the lower third of the zone.
          </p>
        </div>
      </div>

      {/* Visualizations */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Spray Chart */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Pro Spray Chart
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative flex-1 bg-[#0a1128] min-h-[250px]">
             <img src={sprayChartImg} alt="Spray Chart Data" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-white/70 bg-black/40 px-3 py-1.5 rounded backdrop-blur-sm">
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> HR</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> XBH</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> 1B</div>
             </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Damage Zones (SLG)
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative flex-1 bg-[#0a1128] min-h-[250px]">
             <img src={heatmapImg} alt="Damage Zone Heatmap" className="w-full h-full object-cover opacity-90 mix-blend-screen" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
             
             <div className="absolute bottom-4 left-4">
               <div className="text-2xl font-bold font-display text-white">Middle-Low</div>
               <div className="text-xs text-white/70">Highest Slugging % Zone</div>
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
    if (p >= 90) return 'bg-red-500';
    if (p >= 75) return 'bg-red-400';
    if (p >= 50) return 'bg-neutral-500';
    if (p >= 25) return 'bg-blue-400';
    return 'bg-blue-500';
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