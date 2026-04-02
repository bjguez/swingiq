import { useState, useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Eye, Lock, Play, RotateCcw, CheckCircle2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AcuityCompletion } from "@shared/schema";

// ── Exercise definitions ──────────────────────────────────────────────────────

const EXERCISES = [
  {
    id: "pursuit",
    name: "Pursuit",
    tagline: "Track the ball as it accelerates through space",
    description: "A single ball moves smoothly through the frame. Follow it with your eyes as it gradually speeds up. Your goal is to keep it in focus as long as possible.",
    metric: "Max speed reached",
    free: true,
    duration: 30,
    color: "#22c55e",
  },
  {
    id: "peripheral_lock",
    name: "Peripheral Lock",
    tagline: "Hold the crosshair — feel the ball in your periphery",
    description: "Fix your gaze on the center crosshair. A ball moves around the screen — don't look at it directly. Train your peripheral vision to track motion while your focus stays centered.",
    metric: "Peripheral accuracy",
    free: false,
    duration: 30,
    color: "#3b82f6",
  },
  {
    id: "peripheral_flash",
    name: "Peripheral Flash",
    tagline: "Peripheral awareness with instant position jumps",
    description: "Same as Peripheral Lock, but the ball jumps to a new position instead of moving continuously. Forces faster peripheral acquisition.",
    metric: "Peripheral accuracy",
    free: false,
    duration: 30,
    color: "#a78bfa",
  },
  {
    id: "ghost_ball",
    name: "Ghost Ball",
    tagline: "Find it the instant it appears",
    description: "The ball hides, then flashes somewhere on screen. Lock onto it the moment it appears before it vanishes. Starts with long flashes, gets shorter and faster. Trains rapid visual acquisition.",
    metric: "Completion",
    free: false,
    duration: 30,
    color: "#f97316",
  },
  {
    id: "color_filter",
    name: "Color Filter",
    tagline: "Two balls appear — track only the green one",
    description: "Two balls flash at different locations simultaneously. One is your target color, one is a distractor. Tap only the target. Trains selective attention and color-based visual filtering.",
    metric: "Accuracy under distraction",
    free: false,
    duration: 30,
    color: "#22c55e",
  },
] as const;

type ExerciseId = typeof EXERCISES[number]["id"];

// ── Shared 3D constants ───────────────────────────────────────────────────────

const BOX_X = 5.0;
const BOX_Y = 2.8;

function randPos() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * BOX_X * 1.6,
    (Math.random() - 0.5) * BOX_Y * 1.6,
    0,
  );
}

// ── Exercise 1: Pursuit ───────────────────────────────────────────────────────

function PursuitScene({ running, onUpdate }: { running: boolean; onUpdate: (speed: number) => void }) {
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const vel = useRef(new THREE.Vector3(1.2, 0.9, 0).normalize().multiplyScalar(2.5));
  const meshRef = useRef<THREE.Mesh>(null);
  const speedRef = useRef(2.5);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!running || !meshRef.current) return;
    elapsed.current += delta;
    // Starts at 2.5 u/s, hits ~9 u/s by 30s
    speedRef.current = 2.5 + elapsed.current * 0.22;
    vel.current.normalize().multiplyScalar(speedRef.current);

    pos.current.addScaledVector(vel.current, delta);

    if (Math.abs(pos.current.x) > BOX_X) { vel.current.x *= -1; pos.current.x = Math.sign(pos.current.x) * BOX_X; }
    if (Math.abs(pos.current.y) > BOX_Y) { vel.current.y *= -1; pos.current.y = Math.sign(pos.current.y) * BOX_Y; }

    // Randomly nudge direction every ~2s
    if (Math.random() < delta * 0.5) {
      vel.current.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0));
      vel.current.normalize().multiplyScalar(speedRef.current);
    }

    meshRef.current.position.copy(pos.current);
    onUpdate(parseFloat(speedRef.current.toFixed(2)));
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.4} />
    </mesh>
  );
}

// ── Exercise 2: Peripheral Lock ───────────────────────────────────────────────

function PeripheralLockScene({ running }: { running: boolean }) {
  const pos = useRef(new THREE.Vector3(2, 0.5, 0));
  const vel = useRef(new THREE.Vector3(-0.9, 0.7, 0).normalize().multiplyScalar(2.5));
  const meshRef = useRef<THREE.Mesh>(null);
  const speedRef = useRef(2.5);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!running || !meshRef.current) return;
    elapsed.current += delta;
    // Starts at 2.5 u/s, hits ~8 u/s by 30s
    speedRef.current = 2.5 + elapsed.current * 0.18;

    pos.current.addScaledVector(vel.current.normalize().multiplyScalar(speedRef.current), delta);

    if (Math.abs(pos.current.x) > BOX_X) { vel.current.x *= -1; pos.current.x = Math.sign(pos.current.x) * BOX_X; }
    if (Math.abs(pos.current.y) > BOX_Y) { vel.current.y *= -1; pos.current.y = Math.sign(pos.current.y) * BOX_Y; }

    if (Math.random() < delta * 0.4) {
      vel.current.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0));
    }
    meshRef.current.position.copy(pos.current);
  });

  return (
    <>
      {/* Crosshair */}
      <mesh position={[0, 0, 0]}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.4, 0.02]} />
        <meshBasicMaterial color="#ef4444" opacity={0.7} transparent />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.02, 0.4]} />
        <meshBasicMaterial color="#ef4444" opacity={0.7} transparent />
      </mesh>
      {/* Ball */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

// ── Exercise 3: Peripheral Flash ──────────────────────────────────────────────

function PeripheralFlashScene({ running }: { running: boolean }) {
  const pos = useRef(new THREE.Vector3(2.2, 0.8, 0));
  const meshRef = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const interval = useRef(1.8);

  useFrame((_, delta) => {
    if (!running || !meshRef.current) return;
    timer.current += delta;
    if (timer.current >= interval.current) {
      timer.current = 0;
      interval.current = Math.max(0.4, interval.current * 0.92);
      // Jump to random position, avoid center
      let newPos: THREE.Vector3;
      do {
        newPos = randPos();
      } while (newPos.length() < 0.8);
      pos.current.copy(newPos);
    }
    meshRef.current.position.copy(pos.current);
  });

  return (
    <>
      <mesh position={[0, 0, 0]}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.4, 0.02]} />
        <meshBasicMaterial color="#ef4444" opacity={0.7} transparent />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.02, 0.4]} />
        <meshBasicMaterial color="#ef4444" opacity={0.7} transparent />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

// ── Exercise 4: Ghost Ball ────────────────────────────────────────────────────

function GhostBallScene({ running }: { running: boolean }) {
  const [ballPos, setBallPos] = useState<THREE.Vector3 | null>(null);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef(1.6);
  const timerRef = useRef(0);
  const visibleTimer = useRef(0);
  // Visible duration shrinks over time for increasing challenge
  const VISIBLE_SECS = useRef(0.55);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!running) return;
    elapsed.current += delta;
    // Speed up flash cadence over time
    if (visible) {
      visibleTimer.current += delta;
      if (visibleTimer.current >= VISIBLE_SECS.current) {
        setVisible(false);
        visibleTimer.current = 0;
      }
    } else {
      timerRef.current += delta;
      if (timerRef.current >= intervalRef.current) {
        timerRef.current = 0;
        intervalRef.current = Math.max(0.35, intervalRef.current * 0.88);
        VISIBLE_SECS.current = Math.max(0.25, 0.55 - elapsed.current * 0.008);
        setBallPos(randPos());
        setVisible(true);
        visibleTimer.current = 0;
      }
    }
  });

  if (!ballPos || !visible) return null;

  return (
    <mesh position={ballPos}>
      <sphereGeometry args={[0.26, 24, 24]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.5} />
    </mesh>
  );
}

// ── Exercise 5: Color Filter ──────────────────────────────────────────────────

function ColorFilterScene({
  running, onTap,
}: {
  running: boolean;
  onTap: (correct: boolean) => void;
}) {
  const [balls, setBalls] = useState<{ pos: THREE.Vector3; isTarget: boolean; id: number }[]>([]);
  const [showing, setShowing] = useState(false);
  const intervalRef = useRef(2.0);
  const timerRef = useRef(0);
  const showTimer = useRef(0);
  const SHOW_SECS = 0.7;
  const idRef = useRef(0);

  useFrame((_, delta) => {
    if (!running) return;
    if (showing) {
      showTimer.current += delta;
      if (showTimer.current >= SHOW_SECS) {
        setShowing(false);
        showTimer.current = 0;
        setBalls([]);
        onTap(false); // missed
      }
    } else {
      timerRef.current += delta;
      if (timerRef.current >= intervalRef.current) {
        timerRef.current = 0;
        intervalRef.current = Math.max(0.5, intervalRef.current * 0.9);
        const posA = randPos();
        let posB: THREE.Vector3;
        do { posB = randPos(); } while (posB.distanceTo(posA) < 1.0);
        const targetFirst = Math.random() > 0.5;
        setBalls([
          { pos: posA, isTarget: targetFirst, id: idRef.current++ },
          { pos: posB, isTarget: !targetFirst, id: idRef.current++ },
        ]);
        setShowing(true);
        showTimer.current = 0;
      }
    }
  });

  return (
    <>
      {showing && balls.map(b => (
        <mesh
          key={b.id}
          position={b.pos}
          onClick={(e) => {
            e.stopPropagation();
            if (!showing) return;
            setShowing(false);
            setBalls([]);
            onTap(b.isTarget);
          }}
        >
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial
            color={b.isTarget ? "#22c55e" : "#ef4444"}
            emissive={b.isTarget ? "#22c55e" : "#ef4444"}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Drill runner ──────────────────────────────────────────────────────────────

function DrillRunner({
  exerciseId,
  onComplete,
}: {
  exerciseId: ExerciseId;
  onComplete: (stats: { maxSpeed?: number; accuracy?: number; durationSecs: number }) => void;
}) {
  const ex = EXERCISES.find(e => e.id === exerciseId)!;
  const [phase, setPhase] = useState<"countdown" | "running" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState<number>(ex.duration);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const maxSpeedRef = useRef(0);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("running"); startTimeRef.current = Date.now(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // Timer
  useEffect(() => {
    if (phase !== "running") return;
    if (timeLeft <= 0) {
      const durationSecs = Math.round((Date.now() - startTimeRef.current) / 1000);
      // ghost_ball is a pure observation drill — no accuracy metric
      const accuracy = exerciseId !== "ghost_ball" && (hits + misses) > 0
        ? Math.round((hits / (hits + misses)) * 100)
        : undefined;
      setPhase("done");
      onComplete({ maxSpeed: maxSpeedRef.current || undefined, accuracy, durationSecs });
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  const handleSpeedUpdate = useCallback((s: number) => {
    setCurrentSpeed(s);
    if (s > maxSpeedRef.current) maxSpeedRef.current = s;
  }, []);

  const handleTap = useCallback((correct: boolean) => {
    if (correct) setHits(h => h + 1);
    else setMisses(m => m + 1);
  }, []);

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-[#050a14] w-full" style={{ height: "min(60vw, 560px)", minHeight: 300 }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={60} />
          <ambientLight intensity={0.6} />
          <pointLight position={[5, 5, 5]} intensity={0.8} />
          {phase === "running" && exerciseId === "pursuit" && (
            <PursuitScene running={true} onUpdate={handleSpeedUpdate} />
          )}
          {phase === "running" && exerciseId === "peripheral_lock" && (
            <PeripheralLockScene running={true} />
          )}
          {phase === "running" && exerciseId === "peripheral_flash" && (
            <PeripheralFlashScene running={true} />
          )}
          {phase === "running" && exerciseId === "ghost_ball" && (
            <GhostBallScene running={true} />
          )}
          {phase === "running" && exerciseId === "color_filter" && (
            <ColorFilterScene running={true} onTap={handleTap} />
          )}
        </Canvas>

        <AnimatePresence>
          {phase === "countdown" && countdown > 0 && (
            <motion.div
              key="cd"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="text-8xl font-bold font-display text-primary">{countdown}</span>
            </motion.div>
          )}
          {phase === "running" && (
            <motion.div
              key="hud"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none"
            >
              <div className="bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full">
                {timeLeft}s
              </div>
              {(exerciseId === "pursuit" || exerciseId === "peripheral_lock" || exerciseId === "peripheral_flash") && (
                <div className="bg-black/60 text-primary text-xs font-mono px-3 py-1.5 rounded-full">
                  {currentSpeed.toFixed(1)} u/s
                </div>
              )}
              {exerciseId === "color_filter" && (
                <div className="bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full">
                  {hits} hits · {misses} miss
                </div>
              )}
            </motion.div>
          )}
          {phase === "running" && exerciseId === "peripheral_lock" && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none"
            >
              <div className="bg-red-500/80 text-white text-xs font-semibold px-4 py-2 rounded-full">
                Keep your eyes on the crosshair
              </div>
            </motion.div>
          )}
          {phase === "running" && exerciseId === "peripheral_flash" && (
            <motion.div
              key="hint2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none"
            >
              <div className="bg-red-500/80 text-white text-xs font-semibold px-4 py-2 rounded-full">
                Eyes on the crosshair — feel it jump
              </div>
            </motion.div>
          )}
          {phase === "running" && exerciseId === "color_filter" && (
            <motion.div
              key="hint3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none"
            >
              <div className="bg-black/60 text-white text-xs font-semibold px-4 py-2 rounded-full">
                Tap the <span className="text-green-400">green</span> ball only
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Completion card ───────────────────────────────────────────────────────────

function CompletionCard({
  exerciseId,
  stats,
  onReplay,
  onBack,
}: {
  exerciseId: ExerciseId;
  stats: { maxSpeed?: number; accuracy?: number; durationSecs: number };
  onReplay: () => void;
  onBack: () => void;
}) {
  const ex = EXERCISES.find(e => e.id === exerciseId)!;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6 space-y-5 text-center max-w-sm mx-auto"
    >
      <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
      <div>
        <h2 className="text-xl font-bold font-display uppercase">{ex.name} Complete</h2>
        <p className="text-sm text-muted-foreground mt-1">{stats.durationSecs}s session</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.maxSpeed != null && (
          <div className="bg-secondary/40 rounded-xl p-3">
            <p className="text-2xl font-bold text-primary">{stats.maxSpeed.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">max speed (u/s)</p>
          </div>
        )}
        {stats.accuracy != null && (
          <div className="bg-secondary/40 rounded-xl p-3">
            <p className="text-2xl font-bold text-primary">{stats.accuracy}%</p>
            <p className="text-xs text-muted-foreground">accuracy</p>
          </div>
        )}
        <div className={`bg-secondary/40 rounded-xl p-3 ${!stats.maxSpeed && !stats.accuracy ? "col-span-2" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{stats.durationSecs}s</p>
          <p className="text-xs text-muted-foreground">duration</p>
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={onReplay} className="gap-2">
          <RotateCcw className="w-3.5 h-3.5" /> Play Again
        </Button>
        <Button onClick={onBack}>Back to Drills</Button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Acuity() {
  usePageMeta({ title: "Visual Acuity", description: "Eye training drills for hitters — smooth pursuit, peripheral awareness, and reaction speed.", path: "/acuity" });
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const isPaid = user?.isAdmin || ["player", "pro", "coach"].includes(user?.subscriptionTier ?? "");
  const isFree = !!user && !isPaid;

  const [activeExercise, setActiveExercise] = useState<ExerciseId | null>(null);
  const [phase, setPhase] = useState<"picker" | "running" | "complete">("picker");
  const [completionStats, setCompletionStats] = useState<{ maxSpeed?: number; accuracy?: number; durationSecs: number } | null>(null);

  const { data: completionsData } = useQuery({
    queryKey: ["/api/acuity/completions"],
    queryFn: () => fetch("/api/acuity/completions").then(r => r.json()),
    enabled: !!user,
  });

  const completions: AcuityCompletion[] = completionsData?.completions ?? [];
  const freeCompletionCount: number = completionsData?.freeCompletionCount ?? 0;
  const FREE_LIMIT = 3;
  const freeAtLimit = isFree && freeCompletionCount >= FREE_LIMIT;

  // Count completions per exercise
  const countByExercise = (id: string) => completions.filter(c => c.exerciseId === id).length;
  const lastByExercise = (id: string) => {
    const matches = completions.filter(c => c.exerciseId === id);
    return matches.length > 0 ? matches[0].completedAt : null;
  };

  const saveCompletion = useMutation({
    mutationFn: (payload: { exerciseId: string; durationSecs: number; maxSpeed?: number; accuracy?: number }) =>
      fetch("/api/acuity/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(r => { if (r.status === 403) return null; return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/acuity/completions"] }),
  });

  function handleExerciseComplete(stats: { maxSpeed?: number; accuracy?: number; durationSecs: number }) {
    setCompletionStats(stats);
    setPhase("complete");
    if (activeExercise) {
      saveCompletion.mutate({ exerciseId: activeExercise, ...stats });
    }
  }

  function startExercise(id: ExerciseId) {
    setActiveExercise(id);
    setPhase("running");
    setCompletionStats(null);
  }

  function backToPicker() {
    setActiveExercise(null);
    setPhase("picker");
    setCompletionStats(null);
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 text-center space-y-5">
          <Eye className="w-12 h-12 text-primary/40 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold mb-2">Sign in to train</h1>
            <p className="text-muted-foreground">Visual acuity drills for hitters.</p>
          </div>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </Layout>
    );
  }

  const activeEx = EXERCISES.find(e => e.id === activeExercise);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Enhancements</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase flex items-center gap-3">
            <Eye className="w-7 h-7 text-primary" /> Visual Acuity
          </h1>
          <p className="text-muted-foreground mt-1">Eye training drills — pursuit, peripheral awareness, and reaction speed.</p>
        </div>

        {/* ── Drill picker ── */}
        {phase === "picker" && (
          <div className="space-y-3">
            {isFree && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-yellow-500 shrink-0" />
                  <span className="text-yellow-400 font-medium">Free plan — Pursuit only.</span>
                  <span className="text-muted-foreground hidden sm:inline">
                    {freeAtLimit ? "Session limit reached." : `${FREE_LIMIT - freeCompletionCount} free sessions remaining.`}
                  </span>
                </div>
                <button onClick={() => navigate("/pricing")} className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 underline shrink-0">
                  Upgrade
                </button>
              </div>
            )}

            {EXERCISES.map((ex, i) => {
              const locked = isFree && !ex.free;
              const atFreeLimit = isFree && ex.free && freeAtLimit;
              const count = countByExercise(ex.id);
              const last = lastByExercise(ex.id);

              return (
                <motion.div
                  key={ex.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-card border rounded-xl p-5 flex items-center gap-4 transition-colors ${
                    locked || atFreeLimit
                      ? "border-border opacity-50 cursor-not-allowed"
                      : "border-border hover:border-primary/40 cursor-pointer"
                  }`}
                  onClick={() => !locked && !atFreeLimit && startExercise(ex.id)}
                >
                  {/* Number */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: locked ? "hsl(var(--secondary))" : `${ex.color}20`, color: locked ? "hsl(var(--muted-foreground))" : ex.color }}
                  >
                    {locked ? <Lock className="w-4 h-4" /> : i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold">{ex.name}</p>
                      {locked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500 font-semibold">Pro</span>
                      )}
                      {!locked && count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">{count}× done</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{ex.tagline}</p>
                    {!locked && last && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Last: {new Date(last).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                    {atFreeLimit && (
                      <p className="text-[10px] text-yellow-500 mt-0.5">Session limit reached — upgrade to continue</p>
                    )}
                  </div>

                  {!locked && !atFreeLimit && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Running ── */}
        {phase === "running" && activeEx && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-display uppercase">{activeEx.name}</h2>
                <p className="text-xs text-muted-foreground">{activeEx.tagline}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={backToPicker} className="text-muted-foreground">
                ✕ Exit
              </Button>
            </div>
            <DrillRunner exerciseId={activeExercise!} onComplete={handleExerciseComplete} />
          </div>
        )}

        {/* ── Complete ── */}
        {phase === "complete" && completionStats && activeExercise && (
          <CompletionCard
            exerciseId={activeExercise}
            stats={completionStats}
            onReplay={() => startExercise(activeExercise)}
            onBack={backToPicker}
          />
        )}

        {/* ── Instructions (picker view) ── */}
        {phase === "picker" && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground text-xs uppercase tracking-widest">Why visual acuity matters</p>
            <p>Elite hitters don't just have faster swings — they have faster eyes. The ability to smoothly track a moving ball, maintain peripheral awareness, and react to sudden changes in location are trainable skills that directly affect your ability to pick up spin and location early.</p>
            <p>These drills isolate specific visual systems: smooth pursuit (tracking continuous motion), peripheral awareness (monitoring without direct focus), and visual reaction (responding to sudden appearances). Work through them in order for best results.</p>
          </div>
        )}

      </div>
    </Layout>
  );
}
