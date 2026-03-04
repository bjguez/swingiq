import { Activity, Zap, Target, TrendingUp, ChevronRight } from "lucide-react";
import sprayChartImg from "@/assets/images/spray-chart.png";
import heatmapImg from "@/assets/images/heatmap.png";
import { Button } from "./ui/button";

export default function DataDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Key Metrics */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <h3 className="font-display font-bold text-xl uppercase text-muted-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Kinematic Metrics
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="Bat Speed" value="74.2" unit="mph" diff="+2.1" pro="78.5" />
          <MetricCard title="Attack Angle" value="8.5" unit="deg" diff="-1.2" pro="10.2" />
          <MetricCard title="Time to Contact" value="142" unit="ms" diff="+8" pro="130" negative />
          <MetricCard title="Rotational Accel" value="18.4" unit="g" diff="+0.5" pro="22.1" />
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 mt-2 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-sm text-muted-foreground">Swing Path Efficiency</h4>
            <span className="text-primary font-bold">82%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[82%] rounded-full relative">
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Your bat spends 15% less time in the zone compared to the pro model. Focus on keeping the barrel through the plane longer.
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
              Expected Outcomes
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative flex-1 bg-[#0a1128] min-h-[250px]">
             <img src={sprayChartImg} alt="Spray Chart Data" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
             <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-white/70 bg-black/40 px-3 py-1.5 rounded backdrop-blur-sm">
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Optimal</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Acceptable</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Sub-optimal</div>
             </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-card border border-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm relative group">
          <div className="p-4 border-b border-border bg-card/80 backdrop-blur z-10 flex justify-between items-center absolute top-0 left-0 right-0">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Damage Zones
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative flex-1 bg-[#0a1128] min-h-[250px]">
             <img src={heatmapImg} alt="Damage Zone Heatmap" className="w-full h-full object-cover opacity-90 mix-blend-screen" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
             
             <div className="absolute bottom-4 left-4">
               <div className="text-2xl font-bold font-display text-white">Middle-In</div>
               <div className="text-xs text-white/70">Highest Exit Velo Zone</div>
             </div>
          </div>
        </div>
        
      </div>

    </div>
  );
}

function MetricCard({ title, value, unit, diff, pro, negative = false }: any) {
  const isPositiveDiff = diff.startsWith('+');
  const diffColor = negative 
    ? (isPositiveDiff ? 'text-destructive' : 'text-primary') 
    : (isPositiveDiff ? 'text-primary' : 'text-destructive');

  return (
    <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors">
      <div className="text-xs text-muted-foreground font-medium mb-1 truncate">{title}</div>
      <div className="flex items-end gap-1 mb-2">
        <div className="text-2xl font-bold font-display">{value}</div>
        <div className="text-xs text-muted-foreground mb-1">{unit}</div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border/50 text-[10px]">
        <div className="text-muted-foreground">Pro: <span className="font-mono text-foreground">{pro}</span></div>
        <div className={`font-mono flex items-center ${diffColor}`}>
          {isPositiveDiff ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingUp className="w-3 h-3 mr-0.5 rotate-180" />}
          {diff}
        </div>
      </div>
    </div>
  );
}