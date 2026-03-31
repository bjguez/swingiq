import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Eye, Trophy, RotateCcw, Play, Lock, Share2, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CognitionSession } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const NUM_SPHERES = 8;
const NUM_TARGETS = 4;
const SPHERE_RADIUS = 0.25;
const BOX_HALF_XY = 2.8;
const BOX_HALF_Z  = 1.2;
const SAFE_XY = BOX_HALF_XY - SPHERE_RADIUS;
const SAFE_Z  = BOX_HALF_Z  - SPHERE_RADIUS;
const HIGHLIGHT_SECS = 3;
const TRACKING_SECS = 5;
const TOTAL_ROUNDS = 10;
const SPEED_UP   = 1.1;  // +10% on correct
const SPEED_DOWN = 0.85; // -15% on miss
const INITIAL_SPEED = 2.0;

type Phase = "intro" | "highlight" | "tracking" | "selection" | "result" | "complete";

// ── Physics helpers ────────────────────────────────────────────────────────────

function randomVelocity(speed: number) {
  return new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5,
  ).normalize().multiplyScalar(speed * (0.7 + Math.random() * 0.6));
}

function initRound(speed: number) {
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < NUM_SPHERES; i++) {
    let pos: THREE.Vector3;
    let tries = 0;
    do {
      pos = new THREE.Vector3(
        (Math.random() - 0.5) * SAFE_XY * 1.4,
        (Math.random() - 0.5) * SAFE_XY * 1.4,
        (Math.random() - 0.5) * SAFE_Z  * 1.4,
      );
      tries++;
    } while (tries < 50 && positions.some(p => p.distanceTo(pos) < SPHERE_RADIUS * 5));
    positions.push(pos);
  }
  const velocities = Array.from({ length: NUM_SPHERES }, () => randomVelocity(speed));
  const targSet = new Set<number>();
  while (targSet.size < NUM_TARGETS) targSet.add(Math.floor(Math.random() * NUM_SPHERES));
  return { positions, velocities, targets: [...targSet] };
}

// ── 3D Scene ──────────────────────────────────────────────────────────────────

function Scene({
  phase, colors, posRef, velRef, onSphereClick,
}: {
  phase: Phase;
  colors: string[];
  posRef: React.MutableRefObject<THREE.Vector3[]>;
  velRef: React.MutableRefObject<THREE.Vector3[]>;
  onSphereClick: (id: number) => void;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(NUM_SPHERES).fill(null));
  const tempN = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const pos = posRef.current;
    const vel = velRef.current;
    if (!pos.length) return;

    if (phase === "tracking") {
      const dt = Math.min(delta, 0.05);
      const MIN_DIST = SPHERE_RADIUS * 2;

      for (let i = 0; i < NUM_SPHERES; i++) pos[i].addScaledVector(vel[i], dt);

      for (let i = 0; i < NUM_SPHERES; i++) {
        const p = pos[i]; const v = vel[i];
        if (p.x >  SAFE_XY) { p.x =  SAFE_XY; v.x = -Math.abs(v.x); }
        if (p.x < -SAFE_XY) { p.x = -SAFE_XY; v.x =  Math.abs(v.x); }
        if (p.y >  SAFE_XY) { p.y =  SAFE_XY; v.y = -Math.abs(v.y); }
        if (p.y < -SAFE_XY) { p.y = -SAFE_XY; v.y =  Math.abs(v.y); }
        if (p.z >  SAFE_Z)  { p.z =  SAFE_Z;  v.z = -Math.abs(v.z); }
        if (p.z < -SAFE_Z)  { p.z = -SAFE_Z;  v.z =  Math.abs(v.z); }
      }

      for (let i = 0; i < NUM_SPHERES; i++) {
        for (let j = i + 1; j < NUM_SPHERES; j++) {
          tempN.current.subVectors(pos[j], pos[i]);
          const dist = tempN.current.length();
          if (dist < MIN_DIST && dist > 0.001) {
            tempN.current.normalize();
            const overlap = (MIN_DIST - dist) / 2;
            pos[i].addScaledVector(tempN.current, -overlap);
            pos[j].addScaledVector(tempN.current,  overlap);
            const vin = vel[i].dot(tempN.current);
            const vjn = vel[j].dot(tempN.current);
            if (vin - vjn > 0) {
              vel[i].addScaledVector(tempN.current, vjn - vin);
              vel[j].addScaledVector(tempN.current, vin - vjn);
            }
          }
        }
      }
    }

    for (let i = 0; i < NUM_SPHERES; i++) {
      if (meshRefs.current[i] && pos[i]) meshRefs.current[i]!.position.copy(pos[i]);
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <pointLight position={[-4, -4, 4]} intensity={0.4} color="#6366f1" />

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX_HALF_XY * 2, BOX_HALF_XY * 2, BOX_HALF_Z * 2)]} />
        <lineBasicMaterial color="#334155" transparent opacity={0.5} />
      </lineSegments>

      {Array.from({ length: NUM_SPHERES }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          onClick={phase === "selection" ? (e) => { e.stopPropagation(); onSphereClick(i); } : undefined}
        >
          <sphereGeometry args={[SPHERE_RADIUS, 20, 14]} />
          <meshStandardMaterial
            color={colors[i]}
            roughness={0.35}
            metalness={0.25}
            emissive={colors[i]}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </>
  );
}

// ── History sparkline ─────────────────────────────────────────────────────────

function Sparkline({ history }: { history: number[] }) {
  if (!history.length) return null;
  const maxS = Math.max(...history, 0.001);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {history.map((s, i) => {
        const h = Math.round((s / maxS) * 36) + 4;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm bg-primary/50"
            style={{ height: h }}
            title={`Round ${i + 1}: ${s.toFixed(2)}`}
          />
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VisionTraining() {
  usePageMeta({ title: "Cognition", description: "Train your visual attention and processing speed with 3D Multiple Object Tracking — the same cognitive drill used by elite athletes.", path: "/cognition" });
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const isPro = user?.isAdmin || ["pro", "coach"].includes(user?.subscriptionTier ?? "");

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [sessionFloor, setSessionFloor] = useState(INITIAL_SPEED); // floor = user's chosen start speed
  const [targets, setTargets] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);

  const posRef = useRef<THREE.Vector3[]>(initRound(INITIAL_SPEED).positions);
  const velRef = useRef<THREE.Vector3[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session history
  const { data: pastSessions } = useQuery<CognitionSession[]>({
    queryKey: ["/api/cognition/sessions"],
    queryFn: async () => {
      const res = await fetch("/api/cognition/sessions");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && isPro,
  });

  const saveSession = useMutation({
    mutationFn: async (payload: {
      threshold: number; accuracy: number;
      correctRounds: number; totalRounds: number; speedHistory: number[];
    }) => {
      const res = await fetch("/api/cognition/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cognition/sessions"] });
    },
  });

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function startRound(currentSpeed: number) {
    const { positions, velocities, targets: newTargets } = initRound(currentSpeed);
    posRef.current = positions;
    velRef.current = velocities;
    setTargets(newTargets);
    setSelectedIds([]);
    setLastCorrect(null);
    setTimeLeft(HIGHLIGHT_SECS);
    setPhase("highlight");

    timerRef.current = setTimeout(() => {
      setPhase("tracking");
      setTimeLeft(TRACKING_SECS);
      timerRef.current = setTimeout(() => {
        setPhase("selection");
        setTimeLeft(0);
      }, TRACKING_SECS * 1000);
    }, HIGHLIGHT_SECS * 1000);
  }

  useEffect(() => {
    if (phase !== "highlight" && phase !== "tracking") return;
    const interval = setInterval(() => {
      setTimeLeft(t => Math.max(0, parseFloat((t - 0.1).toFixed(1))));
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  // Auto-submit when all 4 selected
  useEffect(() => {
    if (phase !== "selection" || selectedIds.length !== NUM_TARGETS) return;
    const t = setTimeout(() => {
      const correct = selectedIds.every(id => targets.includes(id));
      const rawNext = correct ? speed * SPEED_UP : speed * SPEED_DOWN;
      const newSpeed = Math.max(sessionFloor, rawNext);
      setLastCorrect(correct);
      if (correct) setCorrectCount(c => c + 1);
      setSpeed(newSpeed);
      setSpeedHistory(prev => [...prev, speed]);
      setPhase("result");
    }, 350);
    return () => clearTimeout(t);
  }, [selectedIds, phase, targets, speed]);

  function handleStart() {
    const chosenSpeed = speed;
    setRound(1);
    setSessionFloor(chosenSpeed);
    setSpeedHistory([]);
    setCorrectCount(0);
    setShareText(null);
    startRound(chosenSpeed);
  }

  function handleNext() {
    clearTimer();
    if (round >= TOTAL_ROUNDS) {
      // compute final stats and save
      const finalHistory = [...speedHistory, speed];
      const finalCorrect = correctCount;
      const threshold = parseFloat(
        (finalHistory.reduce((a, b) => a + b, 0) / finalHistory.length).toFixed(2)
      );
      const accuracy = Math.round((finalCorrect / TOTAL_ROUNDS) * 100);
      if (user) {
        saveSession.mutate({
          threshold,
          accuracy,
          correctRounds: finalCorrect,
          totalRounds: TOTAL_ROUNDS,
          speedHistory: finalHistory,
        });
      }
      setPhase("complete");
    } else {
      const nextRound = round + 1;
      setRound(nextRound);
      startRound(speed);
    }
  }

  function handleRestart() {
    clearTimer();
    posRef.current = initRound(INITIAL_SPEED).positions;
    velRef.current = [];
    setPhase("intro");
    setRound(0);
    setSpeed(INITIAL_SPEED);
    setSessionFloor(INITIAL_SPEED);
    setTargets([]);
    setSelectedIds([]);
    setSpeedHistory([]);
    setCorrectCount(0);
    setLastCorrect(null);
    setShareText(null);
  }

  function handleSphereClick(id: number) {
    if (phase !== "selection") return;
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= NUM_TARGETS) return prev;
      return [...prev, id];
    });
  }

  useEffect(() => () => clearTimer(), []);

  const finalHistory = phase === "complete" ? [...speedHistory, speed] : speedHistory;
  const threshold = finalHistory.length > 0
    ? (finalHistory.reduce((a, b) => a + b, 0) / finalHistory.length).toFixed(2)
    : null;
  const accuracyPct = Math.round((correctCount / TOTAL_ROUNDS) * 100);

  async function handleShare() {
    const text = `🧠 Swing Studio Cognition\nThreshold speed: ${threshold} u/s\nAccuracy: ${accuracyPct}%\nRounds: ${correctCount}/${TOTAL_ROUNDS}\n\nTrain your 3D object tracking at swingstudio.ai/cognition`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Swing Studio Cognition", text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareText("Copied to clipboard!");
        setTimeout(() => setShareText(null), 3000);
      }
    } catch {
      // user cancelled share
    }
  }

  const colors = Array.from({ length: NUM_SPHERES }, (_, i) => {
    if (phase === "result") {
      if (targets.includes(i)) return "#22c55e";
      if (selectedIds.includes(i)) return "#ef4444";
      return "#3b82f6";
    }
    if (phase === "highlight") return targets.includes(i) ? "#f97316" : "#3b82f6";
    if (phase === "selection") return selectedIds.includes(i) ? "#a855f7" : "#3b82f6";
    return "#3b82f6";
  });

  if (!isPro) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Cognition is a Pro feature</h1>
            <p className="text-muted-foreground">
              3D Multiple Object Tracking is available on the Pro and Coach plans.
              Train your visual attention and processing speed the way professional athletes do.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/pricing")} size="lg">
              Upgrade to Pro
            </Button>
            {!user && (
              <Button variant="outline" size="lg" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Eye size={20} className="text-primary" /> Cognition
            </h1>
            <p className="text-xs text-muted-foreground">3D Multiple Object Tracking</p>
          </div>
          {phase !== "intro" && phase !== "complete" && (
            <div className="text-right text-sm text-muted-foreground">
              Round <span className="font-bold text-foreground">{round}</span> / {TOTAL_ROUNDS}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="relative rounded-xl overflow-hidden border border-border bg-[#0a0f1a]" style={{ height: 520 }}>
          <Canvas>
            <PerspectiveCamera makeDefault position={[0, 1, 11]} fov={42} />
            <Scene
              phase={phase}
              colors={colors}
              posRef={posRef}
              velRef={velRef}
              onSphereClick={handleSphereClick}
            />
          </Canvas>

          <AnimatePresence>

            {/* Intro */}
            {phase === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center"
              >
                <div className="space-y-2">
                  <p className="text-4xl">👁️</p>
                  <h2 className="text-lg font-bold">3D Object Tracking</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    <span className="text-orange-400 font-semibold">4 orange spheres</span> will be highlighted,
                    then all spheres turn blue and start moving. When they stop,
                    tap the 4 you were tracking.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground w-full max-w-xs">
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <div className="text-base font-bold text-foreground">{TOTAL_ROUNDS}</div>
                    <div>rounds</div>
                  </div>
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <div className="text-base font-bold text-foreground">{NUM_TARGETS}/{NUM_SPHERES}</div>
                    <div>targets</div>
                  </div>
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <div className="text-base font-bold text-foreground">~{Math.round((HIGHLIGHT_SECS + TRACKING_SECS) * TOTAL_ROUNDS / 60)}m</div>
                    <div>total</div>
                  </div>
                </div>
                {/* Manual speed controls */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Starting speed</span>
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                    <button
                      onClick={() => setSpeed(s => Math.max(1.0, parseFloat((s - 0.5).toFixed(1))))}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-mono font-bold w-10 text-center">{speed.toFixed(1)}</span>
                    <button
                      onClick={() => setSpeed(s => Math.min(6.0, parseFloat((s + 0.5).toFixed(1))))}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <Button onClick={handleStart} size="lg" className="gap-2">
                  <Play size={16} /> Start Session
                </Button>
              </motion.div>
            )}

            {/* Highlight */}
            {phase === "highlight" && (
              <motion.div
                key="highlight"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute top-3 inset-x-0 flex justify-center pointer-events-none"
              >
                <div className="bg-orange-500/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow">
                  Memorize the orange spheres — {Math.ceil(timeLeft)}s
                </div>
              </motion.div>
            )}

            {/* Tracking */}
            {phase === "tracking" && (
              <motion.div
                key="tracking"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute top-3 inset-x-0 flex justify-center gap-2 pointer-events-none"
              >
                <div className="bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2 rounded-full shadow">
                  Track them… {timeLeft.toFixed(1)}s
                </div>
                <div className="bg-black/60 text-white/80 text-xs font-mono px-3 py-2 rounded-full shadow">
                  {speed.toFixed(1)} u/s
                </div>
              </motion.div>
            )}

            {/* Selection */}
            {phase === "selection" && (
              <motion.div
                key="selection"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute top-3 inset-x-0 flex justify-center gap-2 pointer-events-none"
              >
                <div className="bg-purple-500/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow">
                  Tap your 4 spheres ({selectedIds.length}/{NUM_TARGETS} selected)
                </div>
                <div className="bg-black/60 text-white/80 text-xs font-mono px-3 py-2 rounded-full shadow">
                  {speed.toFixed(1)} u/s
                </div>
              </motion.div>
            )}

            {/* Result */}
            {phase === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="absolute bottom-4 inset-x-4 flex flex-col items-center gap-3 pointer-events-auto"
              >
                <div className={`w-full rounded-xl border p-4 text-center ${lastCorrect
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"}`}
                >
                  <p className={`font-bold text-base ${lastCorrect ? "text-green-400" : "text-red-400"}`}>
                    {lastCorrect ? "✓ All correct!" : "✗ Missed some"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Speed: {speed.toFixed(2)} u/s
                    {lastCorrect ? " ↑" : " ↓"}
                  </p>
                  <Button size="sm" className="mt-3" onClick={handleNext}>
                    {round >= TOTAL_ROUNDS ? "See Results" : `Round ${round + 1}`}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Complete */}
            {phase === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-background/90 overflow-y-auto"
              >
                <Trophy size={36} className="text-yellow-400 shrink-0" />
                <div>
                  <h2 className="text-xl font-bold">Session Complete</h2>
                  <p className="text-sm text-muted-foreground mt-1">Here's how you did</p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  <div className="bg-card rounded-xl border border-border p-4">
                    <div className="text-2xl font-bold text-primary">{threshold}</div>
                    <div className="text-xs text-muted-foreground">Threshold speed</div>
                    <div className="text-[10px] text-muted-foreground">(units / sec)</div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4">
                    <div className="text-2xl font-bold text-primary">{correctCount}/{TOTAL_ROUNDS}</div>
                    <div className="text-xs text-muted-foreground">Rounds correct</div>
                    <div className="text-[10px] text-muted-foreground">
                      {accuracyPct}% accuracy
                    </div>
                  </div>
                </div>

                {/* Speed history sparkline */}
                <div className="w-full max-w-xs">
                  <p className="text-xs text-muted-foreground mb-1 text-left">Speed per round</p>
                  <Sparkline history={finalHistory} />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleRestart} variant="outline" className="gap-2">
                    <RotateCcw size={14} /> Play Again
                  </Button>
                  <Button onClick={handleShare} variant="outline" className="gap-2">
                    <Share2 size={14} /> {shareText ?? "Share"}
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Instructions */}
        {(phase === "intro" || phase === "complete") && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground text-xs uppercase tracking-widest">How it works</p>
            <p>Multi-object tracking (MOT) is a core visual-cognitive skill, representing your brain's ability to simultaneously tag and follow multiple moving targets in 3D space. Research shows it directly underlies the kind of attention, working memory, and processing speed that separate elite hitters from average ones.</p>
            <p>The adaptive difficulty automatically adjusts speed: faster when you're correct, slower when you miss. Your <span className="text-foreground font-medium">threshold speed</span> is the average across all rounds, a measurable benchmark you can track over time.</p>
          </div>
        )}

        {/* Past sessions history */}
        {pastSessions && pastSessions.length > 0 && phase === "intro" && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="font-semibold text-foreground text-xs uppercase tracking-widest">Your History</p>
            <div className="space-y-2">
              {pastSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <Sparkline history={(s.speedHistory as number[]) ?? []} />
                    <div>
                      <span className="font-medium text-foreground">{Number(s.threshold).toFixed(2)} u/s</span>
                      <span className="text-muted-foreground ml-1.5">{s.correctRounds}/{s.totalRounds} correct</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
