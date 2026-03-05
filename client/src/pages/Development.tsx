import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PlayCircle, Target, ArrowRight, CheckCircle2, Dumbbell, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDrills, fetchVideos } from "@/lib/api";
import { useState } from "react";
import type { Drill, Video } from "@shared/schema";

const corePhases = ["Gather", "Touchdown", "Thrust", "Contact", "Post-Contact"];
const detailPhases = ["Hand Path", "Head Position", "Scissor Kick"];

export default function Development() {
  const [focusPhase, setFocusPhase] = useState("Gather");
  
  const { data: allDrills = [], isLoading: drillsLoading } = useQuery({
    queryKey: ["/api/drills"],
    queryFn: () => fetchDrills(),
  });

  const { data: allVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });

  const phaseDrills = allDrills.filter((d: Drill) => d.phase === focusPhase);
  const phaseVideos = allVideos.filter((v: Video) => v.category === focusPhase);

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Training Plan</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Development Blueprint</h1>
          <p className="text-muted-foreground">Mastering the swing in isolated chunks. Select a phase to explore.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border">Print Workout</Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Start Session</Button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mt-4">
        <h3 className="font-display font-bold text-xl mb-3">Core Phases</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {corePhases.map(phase => (
            <PhaseCard 
              key={phase} 
              title={phase} 
              active={focusPhase === phase}
              onClick={() => setFocusPhase(phase)} 
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-display font-bold text-xl mb-3">Swing Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {detailPhases.map(phase => (
            <PhaseCard 
              key={phase} 
              title={phase} 
              active={focusPhase === phase}
              onClick={() => setFocusPhase(phase)} 
            />
          ))}
        </div>
      </div>

      {/* Current Focus Area */}
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-2xl font-bold font-display flex items-center gap-2">
            <Target className="text-primary w-6 h-6" />
            Current Focus: {focusPhase}
          </h2>
        </div>

        {(drillsLoading || videosLoading) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Pro Models */}
            <div className="space-y-4">
              <h3 className="font-display text-xl uppercase tracking-wider text-muted-foreground mb-4">1. The Standard (Pro Models)</h3>
              
              {phaseVideos.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  No pro video clips available for this phase yet.
                </div>
              )}

              {phaseVideos.map((video: Video) => (
                <div key={video.id} className="bg-card border border-border rounded-xl p-4 space-y-4 hover:border-primary/30 transition-colors">
                  <div className="relative rounded-lg overflow-hidden aspect-video bg-black group cursor-pointer">
                    <div className="w-full h-full bg-gradient-to-br from-secondary/60 to-background flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-6 h-6 ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono border border-white/10">
                      {video.duration} / {video.playerName}
                    </div>
                    {video.fps && (
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono border border-white/10">
                        {video.fps}fps
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{video.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{video.playerName} • {video.source}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Drills */}
            <div className="space-y-4">
              <h3 className="font-display text-xl uppercase tracking-wider text-muted-foreground mb-4">2. Execution (Drills)</h3>
              
              {phaseDrills.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  No drills available for this phase yet.
                </div>
              )}

              {phaseDrills.map((drill: Drill) => (
                <div key={drill.id} className="bg-secondary/30 border border-border rounded-xl p-0 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-border flex justify-between items-center bg-card">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-lg">{drill.name}</h4>
                    </div>
                    {drill.reps && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold">{drill.reps}</span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col justify-between">
                    {drill.description && (
                      <p className="text-sm text-muted-foreground mb-4">{drill.description}</p>
                    )}
                    {drill.steps && drill.steps.length > 0 && (
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        {drill.steps.map((step: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="w-full">Log Set</Button>
                      <Button variant="secondary" size="sm" className="w-full">Upload Attempt</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}

function PhaseCard({ title, active, onClick }: { title: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        active 
          ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(20,184,102,0.1)]' 
          : 'bg-card border-border hover:border-primary/30'
      }`}
      data-testid={`phase-${title}`}
    >
      <div className="text-sm uppercase tracking-wider font-bold flex justify-between items-center">
        <span className={active ? 'text-primary' : 'text-muted-foreground'}>{title}</span>
        {active && <Target className="w-4 h-4 text-primary" />}
      </div>
    </div>
  );
}