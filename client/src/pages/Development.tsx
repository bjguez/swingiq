import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PlayCircle, Target, ArrowRight, CheckCircle2, Dumbbell } from "lucide-react";
import mechanicHandsImg from "@/assets/images/mechanic-hands.png";
import mechanicLowerHalfImg from "@/assets/images/mechanic-lower-half.png";
import drillTeeImg from "@/assets/images/drill-tee.png";

export default function Development() {
  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Training Plan</span>
            <span className="text-sm text-muted-foreground">Based on AI Analysis</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Development Blueprint</h1>
          <p className="text-muted-foreground">Mastering the swing in isolated chunks. Based on your comps: Trout, Bregman, Altuve.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border">Print Workout</Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Start Session</Button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <PhaseCard title="Phase 1: Load & Stride" status="in-progress" progress={65} />
        <PhaseCard title="Phase 2: Launch Position" status="locked" progress={0} />
        <PhaseCard title="Phase 3: Connection" status="locked" progress={0} />
        <PhaseCard title="Phase 4: Extension" status="locked" progress={0} />
      </div>

      {/* Current Focus Area */}
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-2xl font-bold font-display flex items-center gap-2">
            <Target className="text-primary w-6 h-6" />
            Current Focus: Lower Half Engagement
          </h2>
          <Button variant="ghost" className="text-primary hover:text-primary/80">View Full Path <ArrowRight className="w-4 h-4 ml-1" /></Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Theory / Pro Models */}
          <div className="space-y-4">
            <h3 className="font-display text-xl uppercase tracking-wider text-muted-foreground mb-4">1. The Standard (Pro Models)</h3>
            
            <div className="bg-card border border-border rounded-xl p-4 space-y-4 hover:border-primary/30 transition-colors">
              <div className="relative rounded-lg overflow-hidden aspect-video bg-black group cursor-pointer">
                <img src={mechanicLowerHalfImg} alt="Lower half mechanics" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <PlayCircle className="w-6 h-6 ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono border border-white/10">
                  0:15 / Bregman Hip Hinge
                </div>
              </div>
              <div>
                <h4 className="font-bold text-lg">The "Gather" and Hip Hinge</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Notice how Bregman and Trout sit into their back glute (hinge) rather than just swaying backward. This creates tension in the rear leg that can be fired efficiently during the stride.
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge>Coiling</Badge>
                  <Badge>Tension</Badge>
                  <Badge>Ground Force</Badge>
                </div>
              </div>
            </div>

             <div className="bg-card border border-border rounded-xl p-4 space-y-4 hover:border-primary/30 transition-colors">
              <div className="relative rounded-lg overflow-hidden aspect-video bg-black group cursor-pointer">
                <img src={mechanicHandsImg} alt="Hand path" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <PlayCircle className="w-6 h-6 ml-0.5" />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-lg">Separation (Hands vs Hips)</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  As the front foot strikes the ground, the hips begin to open while the hands stay back. This creates the "rubber band effect" needed for high bat speed.
                </p>
              </div>
            </div>

          </div>

          {/* Drills / Execution */}
          <div className="space-y-4">
            <h3 className="font-display text-xl uppercase tracking-wider text-muted-foreground mb-4">2. Execution (Drills)</h3>
            
            <div className="bg-secondary/30 border border-border rounded-xl p-0 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border flex justify-between items-center bg-card">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  <h4 className="font-bold text-lg">Step-Back Tee Drill</h4>
                </div>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold">15 Reps</span>
              </div>
              
              <div className="p-4 flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/3 aspect-square rounded-lg overflow-hidden bg-black relative shrink-0">
                  <img src={drillTeeImg} alt="Tee Drill" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <PlayCircle className="w-8 h-8 text-white opacity-80" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      Start with feet together, slightly wider than shoulder width.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      Step your back foot backward, feeling the weight load into the inside of your back thigh.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      Without pausing, take your normal stride forward and swing.
                    </li>
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="w-full">Log Set</Button>
                    <Button variant="secondary" size="sm" className="w-full">Upload Attempt</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary/30 border border-border rounded-xl p-0 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border flex justify-between items-center bg-card">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  <h4 className="font-bold text-lg">Med Ball Rotational Throws</h4>
                </div>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold">3x8 Reps</span>
              </div>
              <div className="p-4 flex flex-col justify-between">
                <p className="text-sm text-muted-foreground mb-4">
                  Using a 4-6lb medicine ball, mimic your load and stride, then throw the ball explosively into a wall. Focus purely on sequencing your hips before your shoulders.
                </p>
                <Button variant="outline" size="sm" className="w-full">Log Set</Button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </Layout>
  );
}

function PhaseCard({ title, status, progress }: any) {
  const isLocked = status === 'locked';
  return (
    <div className={`border rounded-xl p-4 ${isLocked ? 'bg-secondary/10 border-border/50 opacity-60' : 'bg-card border-primary/50 shadow-[0_0_15px_rgba(20,184,102,0.1)]'}`}>
      <div className="text-xs uppercase tracking-wider font-bold mb-2 flex justify-between items-center">
        <span className={isLocked ? 'text-muted-foreground' : 'text-primary'}>{title}</span>
      </div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mb-2">
        <div className="h-full bg-primary" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="text-right text-[10px] font-mono text-muted-foreground">
        {isLocked ? 'LOCKED' : `${progress}% MASTERY`}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground uppercase tracking-wider">
      {children}
    </span>
  );
}