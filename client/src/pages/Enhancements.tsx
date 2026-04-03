import { useState, useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Eye, Brain, Lock, Play, RotateCcw, CheckCircle2, ChevronRight,
  Trophy, Share2, Minus, Plus, Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AcuityCompletion, CognitionSession, DisciplineSession } from "@shared/schema";

type Tab = "cognition" | "acuity" | "discipline";

// ═══════════════════════════════════════════════════════════════
// COGNITION — 3D Multiple Object Tracking
// ═══════════════════════════════════════════════════════════════

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
const SPEED_UP   = 1.1;
const SPEED_DOWN = 0.85;
const INITIAL_SPEED = 2.0;

type CogPhase = "intro" | "highlight" | "tracking" | "selection" | "result" | "complete";

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
  return { positions, velocities, targets: Array.from(targSet) };
}

function CogScene({
  phase, colors, posRef, velRef, onSphereClick,
}: {
  phase: CogPhase;
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
          <meshStandardMaterial color={colors[i]} roughness={0.35} metalness={0.25} emissive={colors[i]} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </>
  );
}

function Sparkline({ history }: { history: number[] }) {
  if (!history.length) return null;
  const maxS = Math.max(...history, 0.001);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {history.map((s, i) => (
        <div key={i} className="flex-1 rounded-sm bg-primary/50" style={{ height: Math.round((s / maxS) * 36) + 4 }} title={`Round ${i + 1}: ${s.toFixed(2)}`} />
      ))}
    </div>
  );
}

function CognitionTab({ isPaid, isFree }: { isPaid: boolean; isFree: boolean }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<CogPhase>("intro");
  const [round, setRound] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [sessionFloor, setSessionFloor] = useState(INITIAL_SPEED);
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

  const { data: sessionsData } = useQuery({
    queryKey: ["/api/cognition/sessions"],
    enabled: !!user,
  });

  const pastSessions: CognitionSession[] | null = Array.isArray(sessionsData) ? sessionsData : null;
  const freeSessionCount: number = (!Array.isArray(sessionsData) && (sessionsData as any)?.freeSessionCount) ?? 0;
  const FREE_LIMIT = 3;
  const freeAtLimit = isFree && freeSessionCount >= FREE_LIMIT;

  const saveSession = useMutation({
    mutationFn: (payload: { threshold: number; accuracy: number; correctRounds: number; totalRounds: number; speedHistory: number[] }) =>
      apiRequest("POST", "/api/cognition/sessions", payload).then(r => r.json()).catch(() => null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cognition/sessions"] }),
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
    setRound(1);
    setSessionFloor(speed);
    setSpeedHistory([]);
    setCorrectCount(0);
    setShareText(null);
    startRound(speed);
  }

  function handleNext() {
    clearTimer();
    if (round >= TOTAL_ROUNDS) {
      const finalHistory = [...speedHistory, speed];
      const threshold = parseFloat((finalHistory.reduce((a, b) => a + b, 0) / finalHistory.length).toFixed(2));
      const accuracy = Math.round((correctCount / TOTAL_ROUNDS) * 100);
      if (user) saveSession.mutate({ threshold, accuracy, correctRounds: correctCount, totalRounds: TOTAL_ROUNDS, speedHistory: finalHistory });
      setPhase("complete");
    } else {
      setRound(r => r + 1);
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
  const threshold = finalHistory.length > 0 ? (finalHistory.reduce((a, b) => a + b, 0) / finalHistory.length).toFixed(2) : null;
  const accuracyPct = Math.round((correctCount / TOTAL_ROUNDS) * 100);

  async function handleShare() {
    const text = `🧠 Swing Studio Cognition\nThreshold speed: ${threshold} u/s\nAccuracy: ${accuracyPct}%\nRounds: ${correctCount}/${TOTAL_ROUNDS}\n\nTrain your 3D object tracking at swingstudio.ai/enhance`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Swing Studio Cognition", text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareText("Copied to clipboard!");
        setTimeout(() => setShareText(null), 3000);
      }
    } catch { /* user cancelled */ }
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

  if (freeAtLimit) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock size={28} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">You've used your {FREE_LIMIT} free sessions</h2>
          <p className="text-muted-foreground">Upgrade to unlock unlimited sessions, save your history, and track your threshold over time.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-left space-y-2 text-sm">
          <p className="font-semibold text-foreground">What you get with Player+</p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> Unlimited cognition sessions</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> Full session history & threshold trend</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> All Blueprint phases unlocked</li>
            <li className="flex items-center gap-2"><span className="text-primary">✓</span> Biometrics & MLB comps</li>
          </ul>
        </div>
        <Button onClick={() => navigate("/pricing")} size="lg">Upgrade Plan</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain size={20} className="text-primary" /> Cognition
          </h2>
          <p className="text-xs text-muted-foreground">3D Multiple Object Tracking</p>
        </div>
        {phase !== "intro" && phase !== "complete" && (
          <div className="text-right text-sm text-muted-foreground">
            Round <span className="font-bold text-foreground">{round}</span> / {TOTAL_ROUNDS}
          </div>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-border bg-[#0a0f1a]" style={{ height: 520 }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 1, 11]} fov={42} />
          <CogScene phase={phase} colors={colors} posRef={posRef} velRef={velRef} onSphereClick={handleSphereClick} />
        </Canvas>
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
              <div className="space-y-2">
                <p className="text-4xl">👁️</p>
                <h2 className="text-lg font-bold">3D Object Tracking</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  <span className="text-orange-400 font-semibold">4 orange spheres</span> will be highlighted,
                  then all spheres turn blue and start moving. When they stop, tap the 4 you were tracking.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground w-full max-w-xs">
                <div className="bg-card rounded-lg p-3 border border-border"><div className="text-base font-bold text-foreground">{TOTAL_ROUNDS}</div><div>rounds</div></div>
                <div className="bg-card rounded-lg p-3 border border-border"><div className="text-base font-bold text-foreground">{NUM_TARGETS}/{NUM_SPHERES}</div><div>targets</div></div>
                <div className="bg-card rounded-lg p-3 border border-border"><div className="text-base font-bold text-foreground">~{Math.round((HIGHLIGHT_SECS + TRACKING_SECS) * TOTAL_ROUNDS / 60)}m</div><div>total</div></div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Starting speed</span>
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                  <button onClick={() => setSpeed(s => Math.max(1.0, parseFloat((s - 0.5).toFixed(1))))} className="text-muted-foreground hover:text-foreground transition-colors"><Minus size={14} /></button>
                  <span className="font-mono font-bold w-10 text-center">{speed.toFixed(1)}</span>
                  <button onClick={() => setSpeed(s => Math.min(6.0, parseFloat((s + 0.5).toFixed(1))))} className="text-muted-foreground hover:text-foreground transition-colors"><Plus size={14} /></button>
                </div>
              </div>
              {isFree && (
                <div className="w-full max-w-xs bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-3 py-2 text-xs text-yellow-400 text-left space-y-0.5">
                  <p className="font-semibold">Free plan — {FREE_LIMIT - freeSessionCount} session{FREE_LIMIT - freeSessionCount !== 1 ? "s" : ""} remaining</p>
                  <p className="text-yellow-400/70">Session results won't be saved. <button onClick={() => navigate("/pricing")} className="underline hover:text-yellow-300">Upgrade</button> to track your history.</p>
                </div>
              )}
              <Button onClick={handleStart} size="lg" className="gap-2"><Play size={16} /> Start Session</Button>
            </motion.div>
          )}
          {phase === "highlight" && (
            <motion.div key="highlight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
              <div className="bg-orange-500/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow">
                Memorize the orange spheres — {Math.ceil(timeLeft)}s
              </div>
            </motion.div>
          )}
          {phase === "tracking" && (
            <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute top-3 inset-x-0 flex justify-center gap-2 pointer-events-none">
              <div className="bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2 rounded-full shadow">Track them… {timeLeft.toFixed(1)}s</div>
              <div className="bg-black/60 text-white/80 text-xs font-mono px-3 py-2 rounded-full shadow">{speed.toFixed(1)} u/s</div>
            </motion.div>
          )}
          {phase === "selection" && (
            <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute top-3 inset-x-0 flex justify-center gap-2 pointer-events-none">
              <div className="bg-purple-500/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow">Tap your 4 spheres ({selectedIds.length}/{NUM_TARGETS} selected)</div>
              <div className="bg-black/60 text-white/80 text-xs font-mono px-3 py-2 rounded-full shadow">{speed.toFixed(1)} u/s</div>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute bottom-4 inset-x-4 flex flex-col items-center gap-3 pointer-events-auto">
              <div className={`w-full rounded-xl border p-4 text-center ${lastCorrect ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                <p className={`font-bold text-base ${lastCorrect ? "text-green-400" : "text-red-400"}`}>{lastCorrect ? "✓ All correct!" : "✗ Missed some"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Speed: {speed.toFixed(2)} u/s {lastCorrect ? "↑" : "↓"}</p>
                <Button size="sm" className="mt-3" onClick={handleNext}>{round >= TOTAL_ROUNDS ? "See Results" : `Round ${round + 1}`}</Button>
              </div>
            </motion.div>
          )}
          {phase === "complete" && (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-background/90 overflow-y-auto">
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
                  <div className="text-[10px] text-muted-foreground">{accuracyPct}% accuracy</div>
                </div>
              </div>
              <div className="w-full max-w-xs">
                <p className="text-xs text-muted-foreground mb-1 text-left">Speed per round</p>
                <Sparkline history={finalHistory} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRestart} variant="outline" className="gap-2"><RotateCcw size={14} /> Play Again</Button>
                <Button onClick={handleShare} variant="outline" className="gap-2"><Share2 size={14} /> {shareText ?? "Share"}</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(phase === "intro" || phase === "complete") && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground text-xs uppercase tracking-widest">How it works</p>
          <p>Multi-object tracking (MOT) is a core visual-cognitive skill representing your brain's ability to simultaneously tag and follow multiple moving targets in 3D space. Research shows it directly underlies the attention, working memory, and processing speed that separate elite hitters from average ones.</p>
          <p>The adaptive difficulty automatically adjusts speed: faster when you're correct, slower when you miss. Your <span className="text-foreground font-medium">threshold speed</span> is the average across all rounds — a measurable benchmark you can track over time.</p>
        </div>
      )}

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
                <span className="text-xs text-muted-foreground">{s.completedAt ? new Date(s.completedAt).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISUAL ACUITY — Eye Training Drills
// ═══════════════════════════════════════════════════════════════

const EXERCISES = [
  { id: "pursuit",          name: "Pursuit",          tagline: "Track the ball as it accelerates through space",              free: true,  duration: 30, color: "#22c55e" },
  { id: "peripheral_lock",  name: "Peripheral Lock",  tagline: "Hold the crosshair — feel the ball in your periphery",       free: false, duration: 30, color: "#3b82f6" },
  { id: "peripheral_flash", name: "Peripheral Flash", tagline: "Peripheral awareness with instant position jumps",            free: false, duration: 30, color: "#a78bfa" },
  { id: "ghost_ball",       name: "Ghost Ball",       tagline: "Find it the instant it appears",                             free: false, duration: 30, color: "#f97316" },
  { id: "color_filter",     name: "Color Filter",     tagline: "Two balls appear — track only the green one",                free: false, duration: 30, color: "#22c55e" },
] as const;

type ExerciseId = typeof EXERCISES[number]["id"];

const BOX_X = 5.0;
const BOX_Y = 2.8;

function randPos() {
  return new THREE.Vector3((Math.random() - 0.5) * BOX_X * 1.6, (Math.random() - 0.5) * BOX_Y * 1.6, 0);
}

function PursuitScene({ running, onUpdate }: { running: boolean; onUpdate: (speed: number) => void }) {
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const vel = useRef(new THREE.Vector3(1, 0.7, 0).normalize().multiplyScalar(2.5));
  const meshRef = useRef<THREE.Mesh>(null);
  const speedRef = useRef(2.5);
  const elapsed = useRef(0);
  const dirTimer = useRef(0);
  const nextDirChange = useRef(0.25 + Math.random() * 0.35);

  useFrame((_, delta) => {
    if (!running || !meshRef.current) return;
    elapsed.current += delta;
    speedRef.current = 3.0 * Math.pow(1.09, elapsed.current);
    dirTimer.current += delta;
    if (dirTimer.current >= nextDirChange.current) {
      dirTimer.current = 0;
      nextDirChange.current = 0.2 + Math.random() * 0.4;
      const angle = Math.random() * Math.PI * 2;
      vel.current.set(Math.cos(angle), Math.sin(angle), 0);
    }
    vel.current.normalize().multiplyScalar(speedRef.current);
    pos.current.addScaledVector(vel.current, delta);
    if (Math.abs(pos.current.x) > BOX_X) { vel.current.x *= -1; vel.current.y += (Math.random() - 0.5) * speedRef.current * 0.6; pos.current.x = Math.sign(pos.current.x) * BOX_X; }
    if (Math.abs(pos.current.y) > BOX_Y) { vel.current.y *= -1; vel.current.x += (Math.random() - 0.5) * speedRef.current * 0.6; pos.current.y = Math.sign(pos.current.y) * BOX_Y; }
    meshRef.current.position.copy(pos.current);
    onUpdate(parseFloat(speedRef.current.toFixed(2)));
  });

  return (<mesh ref={meshRef}><sphereGeometry args={[0.22, 24, 24]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.4} /></mesh>);
}

function PeripheralLockScene({ running }: { running: boolean }) {
  const pos = useRef(new THREE.Vector3(2.5, 1.0, 0));
  const vel = useRef(new THREE.Vector3(-1, 0.6, 0).normalize().multiplyScalar(2.5));
  const meshRef = useRef<THREE.Mesh>(null);
  const speedRef = useRef(2.5);
  const elapsed = useRef(0);
  const dirTimer = useRef(0);
  const nextDirChange = useRef(0.2 + Math.random() * 0.3);

  useFrame((_, delta) => {
    if (!running || !meshRef.current) return;
    elapsed.current += delta;
    speedRef.current = 3.0 * Math.pow(1.085, elapsed.current);
    dirTimer.current += delta;
    if (dirTimer.current >= nextDirChange.current) {
      dirTimer.current = 0;
      nextDirChange.current = 0.15 + Math.random() * 0.35;
      const angle = Math.random() * Math.PI * 2;
      vel.current.set(Math.cos(angle), Math.sin(angle), 0);
    }
    vel.current.normalize().multiplyScalar(speedRef.current);
    pos.current.addScaledVector(vel.current, delta);
    if (Math.abs(pos.current.x) > BOX_X) { vel.current.x *= -1; vel.current.y += (Math.random() - 0.5) * speedRef.current * 0.5; pos.current.x = Math.sign(pos.current.x) * BOX_X; }
    if (Math.abs(pos.current.y) > BOX_Y) { vel.current.y *= -1; vel.current.x += (Math.random() - 0.5) * speedRef.current * 0.5; pos.current.y = Math.sign(pos.current.y) * BOX_Y; }
    meshRef.current.position.copy(pos.current);
  });

  return (
    <>
      <mesh position={[0, 0, 0]}><ringGeometry args={[0.08, 0.12, 32]} /><meshBasicMaterial color="#ef4444" /></mesh>
      <mesh position={[0, 0, 0]}><planeGeometry args={[0.4, 0.02]} /><meshBasicMaterial color="#ef4444" opacity={0.7} transparent /></mesh>
      <mesh position={[0, 0, 0]}><planeGeometry args={[0.02, 0.4]} /><meshBasicMaterial color="#ef4444" opacity={0.7} transparent /></mesh>
      <mesh ref={meshRef}><sphereGeometry args={[0.2, 24, 24]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.3} /></mesh>
    </>
  );
}

function PeripheralFlashScene({ running }: { running: boolean }) {
  const pos = useRef(new THREE.Vector3(2.2, 0.8, 0));
  const meshRef = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const interval = useRef(1.5);

  useFrame((_, delta) => {
    if (!running || !meshRef.current) return;
    timer.current += delta;
    if (timer.current >= interval.current) {
      timer.current = 0;
      interval.current = Math.max(0.15, interval.current * 0.85);
      let newPos: THREE.Vector3;
      do { newPos = randPos(); } while (newPos.length() < 0.8 || newPos.distanceTo(pos.current) < 3.0);
      pos.current.copy(newPos);
    }
    meshRef.current.position.copy(pos.current);
  });

  return (
    <>
      <mesh position={[0, 0, 0]}><ringGeometry args={[0.08, 0.12, 32]} /><meshBasicMaterial color="#ef4444" /></mesh>
      <mesh position={[0, 0, 0]}><planeGeometry args={[0.4, 0.02]} /><meshBasicMaterial color="#ef4444" opacity={0.7} transparent /></mesh>
      <mesh position={[0, 0, 0]}><planeGeometry args={[0.02, 0.4]} /><meshBasicMaterial color="#ef4444" opacity={0.7} transparent /></mesh>
      <mesh ref={meshRef}><sphereGeometry args={[0.2, 24, 24]} /><meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.3} /></mesh>
    </>
  );
}

function GhostBallScene({ running }: { running: boolean }) {
  const [ballPos, setBallPos] = useState<THREE.Vector3 | null>(null);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef(1.6);
  const timerRef = useRef(0);
  const visibleTimer = useRef(0);
  const VISIBLE_SECS = useRef(0.55);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!running) return;
    elapsed.current += delta;
    if (visible) {
      visibleTimer.current += delta;
      if (visibleTimer.current >= VISIBLE_SECS.current) { setVisible(false); visibleTimer.current = 0; }
    } else {
      timerRef.current += delta;
      if (timerRef.current >= intervalRef.current) {
        timerRef.current = 0;
        intervalRef.current = Math.max(0.2, intervalRef.current * 0.84);
        VISIBLE_SECS.current = Math.max(0.15, 0.55 - elapsed.current * 0.012);
        let nextPos: THREE.Vector3;
        setBallPos(prev => { do { nextPos = randPos(); } while (prev && nextPos.distanceTo(prev) < 3.0); return nextPos; });
        setVisible(true);
        visibleTimer.current = 0;
      }
    }
  });

  if (!ballPos || !visible) return null;
  return (<mesh position={ballPos}><sphereGeometry args={[0.26, 24, 24]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.5} /></mesh>);
}

function ColorFilterScene({ running }: { running: boolean }) {
  const [balls, setBalls] = useState<{ pos: THREE.Vector3; isTarget: boolean; id: number }[]>([]);
  const [showing, setShowing] = useState(false);
  const intervalRef = useRef(1.5);
  const timerRef = useRef(0);
  const showTimer = useRef(0);
  const showSecsRef = useRef(0.6);
  const elapsed = useRef(0);
  const idRef = useRef(0);

  useFrame((_, delta) => {
    if (!running) return;
    elapsed.current += delta;
    if (showing) {
      showTimer.current += delta;
      if (showTimer.current >= showSecsRef.current) { setShowing(false); showTimer.current = 0; setBalls([]); }
    } else {
      timerRef.current += delta;
      if (timerRef.current >= intervalRef.current) {
        timerRef.current = 0;
        intervalRef.current = Math.max(0.2, intervalRef.current * 0.85);
        showSecsRef.current = Math.max(0.15, 0.6 - elapsed.current * 0.012);
        const posA = randPos();
        let posB: THREE.Vector3;
        do { posB = randPos(); } while (posB.distanceTo(posA) < 1.0);
        const targetFirst = Math.random() > 0.5;
        setBalls([{ pos: posA, isTarget: targetFirst, id: idRef.current++ }, { pos: posB, isTarget: !targetFirst, id: idRef.current++ }]);
        setShowing(true);
        showTimer.current = 0;
      }
    }
  });

  return (
    <>
      {showing && balls.map(b => (
        <mesh key={b.id} position={b.pos}>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color={b.isTarget ? "#22c55e" : "#ef4444"} emissive={b.isTarget ? "#22c55e" : "#ef4444"} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </>
  );
}

function DrillRunner({ exerciseId, onComplete }: {
  exerciseId: ExerciseId;
  onComplete: (stats: { maxSpeed?: number; durationSecs: number }) => void;
}) {
  const ex = EXERCISES.find(e => e.id === exerciseId)!;
  const [phase, setPhase] = useState<"countdown" | "running" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState<number>(ex.duration);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const maxSpeedRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("running"); startTimeRef.current = Date.now(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== "running") return;
    if (timeLeft <= 0) {
      const durationSecs = Math.round((Date.now() - startTimeRef.current) / 1000);
      setPhase("done");
      onCompleteRef.current({ maxSpeed: maxSpeedRef.current || undefined, durationSecs });
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  const handleSpeedUpdate = useCallback((s: number) => {
    setCurrentSpeed(s);
    if (s > maxSpeedRef.current) maxSpeedRef.current = s;
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-border bg-[#050a14] w-full" style={{ height: "min(60vw, 560px)", minHeight: 300 }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={60} />
          <ambientLight intensity={0.6} />
          <pointLight position={[5, 5, 5]} intensity={0.8} />
          {phase === "running" && exerciseId === "pursuit" && <PursuitScene running onUpdate={handleSpeedUpdate} />}
          {phase === "running" && exerciseId === "peripheral_lock" && <PeripheralLockScene running />}
          {phase === "running" && exerciseId === "peripheral_flash" && <PeripheralFlashScene running />}
          {phase === "running" && exerciseId === "ghost_ball" && <GhostBallScene running />}
          {phase === "running" && exerciseId === "color_filter" && <ColorFilterScene running />}
        </Canvas>
        <AnimatePresence>
          {phase === "countdown" && countdown > 0 && (
            <motion.div key="cd" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.4 }}
              className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl font-bold font-display text-primary">{countdown}</span>
            </motion.div>
          )}
          {phase === "running" && (
            <motion.div key="hud" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
              <div className="bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full">{timeLeft}s</div>
              {(exerciseId === "pursuit" || exerciseId === "peripheral_lock" || exerciseId === "peripheral_flash") && (
                <div className="bg-black/60 text-primary text-xs font-mono px-3 py-1.5 rounded-full">{currentSpeed.toFixed(1)} u/s</div>
              )}
            </motion.div>
          )}
          {phase === "running" && exerciseId === "peripheral_lock" && (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
              <div className="bg-red-500/80 text-white text-xs font-semibold px-4 py-2 rounded-full">Keep your eyes on the crosshair</div>
            </motion.div>
          )}
          {phase === "running" && exerciseId === "peripheral_flash" && (
            <motion.div key="hint2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
              <div className="bg-red-500/80 text-white text-xs font-semibold px-4 py-2 rounded-full">Eyes on the crosshair — feel it jump</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AcuityCompletionCard({ exerciseId, stats, onReplay, onBack }: {
  exerciseId: ExerciseId;
  stats: { maxSpeed?: number; durationSecs: number };
  onReplay: () => void;
  onBack: () => void;
}) {
  const ex = EXERCISES.find(e => e.id === exerciseId)!;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6 space-y-5 text-center max-w-sm mx-auto">
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
        <div className={`bg-secondary/40 rounded-xl p-3 ${!stats.maxSpeed ? "col-span-2" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{stats.durationSecs}s</p>
          <p className="text-xs text-muted-foreground">duration</p>
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={onReplay} className="gap-2"><RotateCcw className="w-3.5 h-3.5" /> Play Again</Button>
        <Button onClick={onBack}>Back to Drills</Button>
      </div>
    </motion.div>
  );
}

function AcuityTab({ isPaid, isFree }: { isPaid: boolean; isFree: boolean }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [activeExercise, setActiveExercise] = useState<ExerciseId | null>(null);
  const [acuityPhase, setAcuityPhase] = useState<"picker" | "running" | "complete">("picker");
  const [completionStats, setCompletionStats] = useState<{ maxSpeed?: number; durationSecs: number } | null>(null);

  const { data: completionsData } = useQuery<{ completions: AcuityCompletion[]; freeCompletionCount?: number }>({
    queryKey: ["/api/acuity/completions"],
    enabled: !!user,
  });

  const completions: AcuityCompletion[] = completionsData?.completions ?? [];
  const freeCompletionCount: number = completionsData?.freeCompletionCount ?? 0;
  const FREE_LIMIT = 3;
  const freeAtLimit = isFree && freeCompletionCount >= FREE_LIMIT;

  const countByExercise = (id: string) => completions.filter(c => c.exerciseId === id).length;
  const lastByExercise = (id: string) => { const m = completions.filter(c => c.exerciseId === id); return m.length > 0 ? m[0].completedAt : null; };

  const saveCompletion = useMutation({
    mutationFn: (payload: { exerciseId: string; durationSecs: number; maxSpeed?: number }) =>
      apiRequest("POST", "/api/acuity/completions", payload).then(r => r.json()).catch(() => null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/acuity/completions"] }),
  });

  function handleExerciseComplete(stats: { maxSpeed?: number; durationSecs: number }) {
    setCompletionStats(stats);
    setAcuityPhase("complete");
    if (activeExercise) saveCompletion.mutate({ exerciseId: activeExercise, ...stats });
  }

  function startExercise(id: ExerciseId) { setActiveExercise(id); setAcuityPhase("running"); setCompletionStats(null); }
  function backToPicker() { setActiveExercise(null); setAcuityPhase("picker"); setCompletionStats(null); }

  const activeEx = EXERCISES.find(e => e.id === activeExercise);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Eye size={20} className="text-primary" /> Visual Acuity</h2>
        <p className="text-xs text-muted-foreground">Eye training drills — pursuit, peripheral awareness, and reaction speed.</p>
      </div>

      {acuityPhase === "picker" && (
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
              <button onClick={() => navigate("/pricing")} className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 underline shrink-0">Upgrade</button>
            </div>
          )}
          {EXERCISES.map((ex, i) => {
            const locked = isFree && !ex.free;
            const atFreeLimit = isFree && ex.free && freeAtLimit;
            const count = countByExercise(ex.id);
            const last = lastByExercise(ex.id);
            return (
              <motion.div key={ex.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-card border rounded-xl p-5 flex items-center gap-4 transition-colors ${locked || atFreeLimit ? "border-border opacity-50 cursor-not-allowed" : "border-border hover:border-primary/40 cursor-pointer"}`}
                onClick={() => !locked && !atFreeLimit && startExercise(ex.id)}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{ background: locked ? "hsl(var(--secondary))" : `${ex.color}20`, color: locked ? "hsl(var(--muted-foreground))" : ex.color }}>
                  {locked ? <Lock className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold">{ex.name}</p>
                    {locked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500 font-semibold">Pro</span>}
                    {!locked && count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">{count}× done</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{ex.tagline}</p>
                  {!locked && last && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Last: {new Date(last).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>}
                  {atFreeLimit && <p className="text-[10px] text-yellow-500 mt-0.5">Session limit reached — upgrade to continue</p>}
                </div>
                {!locked && !atFreeLimit && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </motion.div>
            );
          })}
          <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground text-xs uppercase tracking-widest">Why visual acuity matters</p>
            <p>Elite hitters don't just have faster swings — they have faster eyes. The ability to smoothly track a moving ball, maintain peripheral awareness, and react to sudden changes in location are trainable skills that directly affect your ability to pick up spin and location early.</p>
          </div>
        </div>
      )}

      {acuityPhase === "running" && activeEx && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold font-display uppercase">{activeEx.name}</h3>
              <p className="text-xs text-muted-foreground">{activeEx.tagline}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={backToPicker} className="text-muted-foreground">✕ Exit</Button>
          </div>
          <DrillRunner exerciseId={activeExercise!} onComplete={handleExerciseComplete} />
        </div>
      )}

      {acuityPhase === "complete" && completionStats && activeExercise && (
        <AcuityCompletionCard
          exerciseId={activeExercise}
          stats={completionStats}
          onReplay={() => startExercise(activeExercise)}
          onBack={backToPicker}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DISCIPLINE — Go / No-Go pitch trainer
// ═══════════════════════════════════════════════════════════════

const TOTAL_PITCHES = 20;
const START_Z = -32;
const PLATE_Z = 2.5;
const DECISION_Z = -9;

type PitchLocation = "strike" | "ball";
type PitchResult = "good_swing" | "good_eye" | "chase" | "called_strike";
type PitchType = "fastball" | "curveball" | "slider" | "changeup";

interface PitchData {
  location: PitchLocation;
  type: PitchType;
  // Start position (near center, slight mound drift)
  startX: number;
  startY: number;
  // Plate-arrival position
  endX: number;
  endY: number;
  // For curved pitches — the break axis and amount
  breakX: number; // accumulated horizontal break (applied late via t^2)
  breakY: number; // accumulated vertical break
  speed: number;  // units/sec
}

const PITCH_CONFIGS: Record<PitchType, {
  label: string;
  color: string;
  speed: number;
  breakX: number;
  breakY: number;
}> = {
  fastball:  { label: "Fastball",  color: "#f5f0e8", speed: 28, breakX: 0,    breakY: 0.15  },
  curveball: { label: "Curveball", color: "#facc15", speed: 19, breakX: 0.25, breakY: -2.0  },
  slider:    { label: "Slider",    color: "#38bdf8", speed: 23, breakX: -1.4, breakY: -0.7  },
  changeup:  { label: "Changeup",  color: "#fb923c", speed: 20, breakX: 0.15, breakY: -0.4  },
};

// Strike zone bounds (x: ±0.85, y: −1.0 to +1.0)
const SZ_X = 0.85;
const SZ_Y_LO = -1.0;
const SZ_Y_HI = 1.0;

function generatePitchData(location: PitchLocation): PitchData {
  const types: PitchType[] = ["fastball", "fastball", "fastball", "curveball", "slider", "changeup"];
  const type = types[Math.floor(Math.random() * types.length)];
  const cfg = PITCH_CONFIGS[type];

  // Slight start drift so the ball doesn't always emerge from dead center
  const startX = (Math.random() - 0.5) * 0.3;
  const startY = 0.8 + (Math.random() - 0.5) * 0.3;

  let endX: number;
  let endY: number;

  if (location === "strike") {
    // Land inside zone, accounting for pitch break so the ARRIVAL is in zone
    endX = (Math.random() - 0.5) * SZ_X * 1.6 - cfg.breakX;
    endY = SZ_Y_LO + Math.random() * (SZ_Y_HI - SZ_Y_LO) - cfg.breakY;
  } else {
    // Land clearly outside — pick a side
    const side = Math.random();
    if (side < 0.35) {
      // high
      endX = (Math.random() - 0.5) * SZ_X * 1.4 - cfg.breakX;
      endY = SZ_Y_HI + 0.5 + Math.random() * 0.6 - cfg.breakY;
    } else if (side < 0.7) {
      // low
      endX = (Math.random() - 0.5) * SZ_X * 1.4 - cfg.breakX;
      endY = SZ_Y_LO - 0.5 - Math.random() * 0.6 - cfg.breakY;
    } else if (side < 0.85) {
      // inside
      endX = (Math.random() > 0.5 ? 1 : -1) * (SZ_X + 0.45 + Math.random() * 0.4) - cfg.breakX;
      endY = SZ_Y_LO + Math.random() * (SZ_Y_HI - SZ_Y_LO) - cfg.breakY;
    } else {
      // way outside + low — classic dirt ball
      endX = (Math.random() - 0.5) * SZ_X - cfg.breakX;
      endY = SZ_Y_LO - 1.0 - Math.random() * 0.5 - cfg.breakY;
    }
  }

  return { location, type, startX, startY, endX, endY, breakX: cfg.breakX, breakY: cfg.breakY, speed: cfg.speed };
}

interface Pitch {
  location: PitchLocation;
  type: PitchType;
  swung: boolean;
  reactionMs: number | null;
  result: PitchResult;
}

function getPitchResult(location: PitchLocation, swung: boolean): PitchResult {
  if (location === "strike" && swung)  return "good_swing";
  if (location === "ball"   && !swung) return "good_eye";
  if (location === "ball"   && swung)  return "chase";
  return "called_strike";
}

const RESULT_LABELS: Record<PitchResult, { text: string; color: string }> = {
  good_swing:    { text: "Good swing!", color: "#22c55e" },
  good_eye:      { text: "Good eye!",   color: "#22c55e" },
  chase:         { text: "Chase",       color: "#ef4444" },
  called_strike: { text: "Called strike", color: "#f97316" },
};

// StrikeZone — static mesh, rendered separately so it never re-mounts
function StrikeZone() {
  return (
    <>
      <mesh position={[0, 0, -1.5]}>
        <planeGeometry args={[SZ_X * 2, SZ_Y_HI - SZ_Y_LO]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.04} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[0, 0, -1.5]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(SZ_X * 2, SZ_Y_HI - SZ_Y_LO)]} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </lineSegments>
    </>
  );
}

// 3D scene — ball travels toward camera on z-axis along a pre-computed smooth path
function PitchBallScene({
  pitchData,
  onDecisionWindowOpen,
}: {
  pitchData: PitchData;
  onDecisionWindowOpen: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const zRef = useRef(START_Z);
  const notified = useRef(false);
  const cfg = PITCH_CONFIGS[pitchData.type];

  // Store path endpoints in refs so re-renders don't change them
  const startX = useRef(pitchData.startX);
  const startY = useRef(pitchData.startY);
  const endX   = useRef(pitchData.endX + pitchData.breakX);
  const endY   = useRef(pitchData.endY + pitchData.breakY);
  const bX     = useRef(pitchData.breakX);
  const bY     = useRef(pitchData.breakY);

  const totalDist = PLATE_Z - START_Z;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    zRef.current += delta * pitchData.speed;

    if (!notified.current && zRef.current >= DECISION_Z) {
      notified.current = true;
      onDecisionWindowOpen();
    }

    // t: 0 (release) → 1 (plate)
    const t = Math.max(0, Math.min(1, (zRef.current - START_Z) / totalDist));

    // Linear travel for x/y base, then add break which accelerates in the back half (t^2)
    const breakT = t * t;
    const x = startX.current + (endX.current - startX.current) * t - bX.current * (1 - breakT);
    const y = startY.current + (endY.current - startY.current) * t - bY.current * (1 - t);

    meshRef.current.position.set(x, y, zRef.current);
    // Ball grows naturally via perspective; add slight size ramp for readability
    const sz = 0.11 + t * 0.07;
    meshRef.current.scale.setScalar(sz / 0.11);

    if (zRef.current > PLATE_Z + 1.5) meshRef.current.visible = false;
  });

  return (
    <mesh ref={meshRef} position={[startX.current, startY.current, START_Z]}>
      <sphereGeometry args={[0.11, 20, 20]} />
      <meshStandardMaterial color={cfg.color} roughness={0.55} emissive={cfg.color} emissiveIntensity={0.15} />
    </mesh>
  );
}

type DisciplinePhase = "intro" | "pitching" | "complete";

function DisciplineTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<DisciplinePhase>("intro");
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [currentPitch, setCurrentPitch] = useState<PitchData | null>(null);
  const [ballRunning, setBallRunning] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [lastResult, setLastResult] = useState<PitchResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [waitingNextPitch, setWaitingNextPitch] = useState(false);

  const decisionOpenTimeRef = useRef<number | null>(null);
  const swungRef = useRef(false);
  const currentPitchRef = useRef<PitchData | null>(null);
  const pitchesRef = useRef<Pitch[]>([]);

  const { data: history = [] } = useQuery<DisciplineSession[]>({
    queryKey: ["/api/discipline/sessions"],
    enabled: !!user,
  });

  const saveSession = useMutation({
    mutationFn: (payload: Omit<DisciplineSession, "id" | "userId" | "completedAt">) =>
      apiRequest("POST", "/api/discipline/sessions", payload).then(r => r.json()).catch(() => null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/discipline/sessions"] }),
  });

  // Keep refs in sync
  useEffect(() => { currentPitchRef.current = currentPitch; }, [currentPitch]);
  useEffect(() => { pitchesRef.current = pitches; }, [pitches]);

  function launchNextPitch() {
    if (pitchesRef.current.length >= TOTAL_PITCHES) return;
    const loc: PitchLocation = Math.random() < 0.55 ? "strike" : "ball";
    const data = generatePitchData(loc);
    swungRef.current = false;
    currentPitchRef.current = data;
    setCurrentPitch(data);
    setDecisionOpen(false);
    setShowResult(false);
    setWaitingNextPitch(false);
    setBallRunning(true);
  }

  function handleDecisionWindowOpen() {
    decisionOpenTimeRef.current = Date.now();
    setDecisionOpen(true);
    const windowMs = Math.max(350, 700 - pitchesRef.current.length * 17);
    setTimeout(() => {
      if (!swungRef.current) resolvePitch(false);
    }, windowMs);
  }

  function resolvePitch(swung: boolean) {
    if (swungRef.current && !swung) return;
    swungRef.current = true;
    setBallRunning(false);
    setDecisionOpen(false);

    const pd = currentPitchRef.current;
    if (!pd) return;
    const reactionMs = swung && decisionOpenTimeRef.current != null
      ? Date.now() - decisionOpenTimeRef.current
      : null;
    const result = getPitchResult(pd.location, swung);
    const pitch: Pitch = { location: pd.location, type: pd.type, swung, reactionMs, result };

    setPitches(prev => {
      const updated = [...prev, pitch];
      pitchesRef.current = updated;
      if (updated.length >= TOTAL_PITCHES) {
        finishSession(updated);
      } else {
        setLastResult(result);
        setShowResult(true);
        setWaitingNextPitch(true);
      }
      return updated;
    });
  }

  function finishSession(allPitches: Pitch[]) {
    const strikes = allPitches.filter(p => p.location === "strike");
    const balls = allPitches.filter(p => p.location === "ball");
    const goodSwings = allPitches.filter(p => p.result === "good_swing").length;
    const chases = allPitches.filter(p => p.result === "chase").length;
    const calledStrikes = allPitches.filter(p => p.result === "called_strike").length;
    const goodTakes = allPitches.filter(p => p.result === "good_eye").length;
    const swings = allPitches.filter(p => p.swung).length;

    const disciplinePct = Math.round(((goodSwings + goodTakes) / TOTAL_PITCHES) * 100);
    const chaseRate = balls.length > 0 ? Math.round((chases / balls.length) * 100) : 0;
    const calledStrikeRate = strikes.length > 0 ? Math.round((calledStrikes / strikes.length) * 100) : 0;

    const swingReactions = allPitches.filter(p => p.swung && p.reactionMs != null).map(p => p.reactionMs!);
    const avgReactionMs = swingReactions.length > 0
      ? Math.round(swingReactions.reduce((a, b) => a + b, 0) / swingReactions.length)
      : null;

    setLastResult(allPitches[allPitches.length - 1].result);
    setShowResult(true);
    setPhase("complete");

    saveSession.mutate({
      totalPitches: TOTAL_PITCHES,
      swings,
      goodSwings,
      chases,
      calledStrikes,
      goodTakes,
      disciplinePct,
      chaseRate,
      calledStrikeRate,
      avgReactionMs,
    });
  }

  // Space bar handler
  useEffect(() => {
    if (phase !== "pitching") return;
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (waitingNextPitch) { launchNextPitch(); return; }
      if (decisionOpen) resolvePitch(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, decisionOpen, waitingNextPitch]);

  function handleSwingButton() {
    if (waitingNextPitch) { launchNextPitch(); return; }
    if (decisionOpen) resolvePitch(true);
  }

  function startSession() {
    setPitches([]);
    pitchesRef.current = [];
    setPhase("pitching");
    setShowResult(false);
    setLastResult(null);
    setWaitingNextPitch(false);
    setTimeout(launchNextPitch, 800);
  }

  function reset() {
    setBallRunning(false);
    setDecisionOpen(false);
    setShowResult(false);
    setLastResult(null);
    setWaitingNextPitch(false);
    setPitches([]);
    pitchesRef.current = [];
    setPhase("intro");
  }

  const pitchNum = pitches.length;
  const lastSession = history[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Target size={20} className="text-primary" /> Discipline</h2>
        <p className="text-xs text-muted-foreground">See a pitch. Decide: swing or take. Train your zone awareness.</p>
      </div>

      {phase === "intro" && (
        <div className="space-y-4">
          {lastSession && (
            <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{lastSession.disciplinePct}%</p>
                <p className="text-xs text-muted-foreground">Discipline</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{lastSession.chaseRate}%</p>
                <p className="text-xs text-muted-foreground">Chase Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{lastSession.calledStrikeRate}%</p>
                <p className="text-xs text-muted-foreground">Called Strikes</p>
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="font-semibold text-sm uppercase tracking-wide">How it works</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• A pitch travels toward you — strike or ball</li>
              <li>• When you see it enter the zone, decide: <span className="text-foreground font-medium">swing or take</span></li>
              <li>• Press <kbd className="px-1.5 py-0.5 rounded border border-border text-xs font-mono">Space</kbd> on desktop or tap <span className="text-foreground font-medium">SWING</span> on mobile</li>
              <li>• Do nothing = take</li>
              <li>• Decision window shrinks as you face more pitches</li>
            </ul>
            <Button onClick={startSession} className="w-full gap-2 mt-2"><Play className="w-4 h-4" /> Start ({TOTAL_PITCHES} pitches)</Button>
          </div>
          {history.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Sessions</p>
              <div className="space-y-2">
                {history.slice(0, 5).map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{new Date(s.completedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <div className="flex gap-4">
                      <span className="text-primary font-semibold">{s.disciplinePct}% disc</span>
                      <span className="text-red-400">{s.chaseRate}% chase</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "pitching" && (
        <div className="space-y-3">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-mono">{pitchNum} / {TOTAL_PITCHES} pitches</span>
            <div className="flex gap-1">
              {Array.from({ length: TOTAL_PITCHES }).map((_, i) => {
                const p = pitches[i];
                const color = !p ? "bg-secondary" :
                  p.result === "good_swing" || p.result === "good_eye" ? "bg-green-500" :
                  p.result === "chase" ? "bg-red-500" : "bg-orange-400";
                return <div key={i} className={`w-2 h-2 rounded-full ${color}`} />;
              })}
            </div>
          </div>

          {/* Canvas */}
          <div className="relative rounded-xl overflow-hidden border border-border bg-[#050a14] w-full" style={{ height: "min(60vw, 460px)", minHeight: 280 }}>
            <Canvas>
              <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={55} />
              <ambientLight intensity={0.4} />
              <pointLight position={[3, 3, 3]} intensity={0.8} />
              <StrikeZone />
              {ballRunning && currentPitch && (
                <PitchBallScene
                  key={pitchNum}
                  pitchData={currentPitch}
                  onDecisionWindowOpen={handleDecisionWindowOpen}
                />
              )}
            </Canvas>

            {/* Pitch type label — shown while ball is in flight */}
            {ballRunning && currentPitch && (
              <div className="absolute top-3 left-3 pointer-events-none">
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full bg-black/60"
                  style={{ color: PITCH_CONFIGS[currentPitch.type].color }}
                >
                  {PITCH_CONFIGS[currentPitch.type].label}
                </span>
              </div>
            )}

            {/* Result flash */}
            <AnimatePresence>
              {showResult && lastResult && (
                <motion.div
                  key={`res-${pitchNum}`}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <span className="text-4xl font-bold font-display drop-shadow-lg" style={{ color: RESULT_LABELS[lastResult].color }}>
                    {RESULT_LABELS[lastResult].text}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* "Next pitch" hint */}
            {waitingNextPitch && (
              <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
                <div className="bg-black/60 text-white text-xs font-semibold px-4 py-2 rounded-full">
                  Space / tap SWING for next pitch
                </div>
              </div>
            )}
          </div>

          {/* SWING button — mobile primary interaction */}
          <button
            onClick={handleSwingButton}
            className={`w-full rounded-2xl font-bold text-lg py-6 transition-all select-none ${
              decisionOpen
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.02]"
                : waitingNextPitch
                ? "bg-secondary text-foreground"
                : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            {waitingNextPitch ? "Next Pitch" : "SWING"}
          </button>

          <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={reset}>✕ End Session</Button>
        </div>
      )}

      {phase === "complete" && (() => {
        const strikes = pitches.filter(p => p.location === "strike");
        const balls = pitches.filter(p => p.location === "ball");
        const goodSwings = pitches.filter(p => p.result === "good_swing").length;
        const chases = pitches.filter(p => p.result === "chase").length;
        const calledStrikes = pitches.filter(p => p.result === "called_strike").length;
        const goodTakes = pitches.filter(p => p.result === "good_eye").length;
        const disciplinePct = Math.round(((goodSwings + goodTakes) / TOTAL_PITCHES) * 100);
        const chaseRate = balls.length > 0 ? Math.round((chases / balls.length) * 100) : 0;
        const calledStrikeRate = strikes.length > 0 ? Math.round((calledStrikes / strikes.length) * 100) : 0;
        const swingReactions = pitches.filter(p => p.swung && p.reactionMs != null).map(p => p.reactionMs!);
        const avgReaction = swingReactions.length > 0
          ? Math.round(swingReactions.reduce((a, b) => a + b, 0) / swingReactions.length)
          : null;

        return (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-2" />
              <h2 className="text-xl font-bold font-display uppercase">Session Complete</h2>
              <p className="text-sm text-muted-foreground">{TOTAL_PITCHES} pitches</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-secondary/40 rounded-xl p-3">
                <p className="text-3xl font-bold text-primary">{disciplinePct}%</p>
                <p className="text-xs text-muted-foreground">Discipline</p>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3">
                <p className="text-3xl font-bold text-red-400">{chaseRate}%</p>
                <p className="text-xs text-muted-foreground">Chase Rate</p>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3">
                <p className="text-3xl font-bold text-orange-400">{calledStrikeRate}%</p>
                <p className="text-xs text-muted-foreground">Called Strikes</p>
              </div>
              {avgReaction != null && (
                <div className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-3xl font-bold text-foreground">{avgReaction}ms</p>
                  <p className="text-xs text-muted-foreground">Avg Reaction</p>
                </div>
              )}
            </div>

            {/* Pitch-by-pitch breakdown */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pitch Log</p>
              <div className="flex flex-wrap gap-1.5">
                {pitches.map((p, i) => (
                  <div
                    key={i}
                    title={`Pitch ${i + 1}: ${p.location} — ${RESULT_LABELS[p.result].text}`}
                    className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: p.result === "good_swing" || p.result === "good_eye" ? "#22c55e22" : p.result === "chase" ? "#ef444422" : "#f9731622",
                      color: p.result === "good_swing" || p.result === "good_eye" ? "#22c55e" : p.result === "chase" ? "#ef4444" : "#f97316",
                      border: `1px solid ${p.result === "good_swing" || p.result === "good_eye" ? "#22c55e40" : p.result === "chase" ? "#ef444440" : "#f9731640"}`,
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Good decision</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Chase</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Called strike</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={startSession}><RotateCcw className="w-3.5 h-3.5" /> Play Again</Button>
              <Button variant="outline" onClick={reset}>Done</Button>
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function Enhancements() {
  usePageMeta({ title: "Enhance", description: "Cognitive and visual training for hitters — 3D object tracking, eye drills, and more.", path: "/enhance" });
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const rawTab = params.get("tab");
  const initialTab: Tab = rawTab === "acuity" ? "acuity" : rawTab === "discipline" ? "discipline" : "cognition";
  const [tab, setTab] = useState<Tab>(initialTab);

  const isPaid = !!(user?.isAdmin) || ["player", "pro", "coach"].includes(user?.subscriptionTier ?? "");
  const isFree = !!user && !isPaid;

  if (!user) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 text-center space-y-5">
          <Brain className="w-12 h-12 text-primary/40 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold mb-2">Sign in to train</h1>
            <p className="text-muted-foreground">Cognitive and visual training for hitters.</p>
          </div>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </Layout>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "cognition",  label: "Cognition",     icon: <Brain className="w-4 h-4" /> },
    { id: "acuity",     label: "Visual Acuity", icon: <Eye className="w-4 h-4" /> },
    { id: "discipline", label: "Discipline",    icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Enhance</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Enhance</h1>
          <p className="text-muted-foreground mt-1">Cognitive and visual training designed for hitters.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "cognition"  && <CognitionTab  isPaid={isPaid} isFree={isFree} />}
        {tab === "acuity"     && <AcuityTab     isPaid={isPaid} isFree={isFree} />}
        {tab === "discipline" && <DisciplineTab />}
      </div>
    </Layout>
  );
}
