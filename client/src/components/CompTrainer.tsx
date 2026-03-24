import { useRef, useState, useEffect, useCallback } from "react";
import { MechanicsGap } from "@/components/MechanicsGap";
import { detectPose, SKELETON_CONNECTIONS } from "@/lib/poseDetector";
import type { PoseResult, SwingPhase } from "@/lib/poseDetector";
import type { MlbPlayer, Video } from "@shared/schema";
import { ArrowLeft, Lock, Ghost, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Comp {
  id: string;
  compType: string;
  rank: number | null;
  player: MlbPlayer;
}

interface Props {
  comp: Comp;
  compVideos: Video[];
  userVideos: Video[];
  onBack: () => void;
}

// ── Skeleton normalization ─────────────────────────────────────────────────
// Centers each skeleton on hip midpoint, scales by torso length so both
// skeletons are comparable regardless of framing differences.
type NormalizedLandmark = { x: number; y: number; visibility: number };

function normalizeSkeleton(lm: PoseResult["landmarks"]): NormalizedLandmark[] {
  const hipMidX = (lm[23].x + lm[24].x) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;
  const shoulderMidX = (lm[11].x + lm[12].x) / 2;
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const torso = Math.sqrt((shoulderMidX - hipMidX) ** 2 + (shoulderMidY - hipMidY) ** 2);
  if (torso === 0) return lm.map(p => ({ x: p.x, y: p.y, visibility: p.visibility }));
  return lm.map(p => ({
    x: (p.x - hipMidX) / torso,
    y: (p.y - hipMidY) / torso,
    visibility: p.visibility,
  }));
}

// ── Ghost canvas drawing ───────────────────────────────────────────────────
function drawGhostSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  color: string,
  cx: number,
  cy: number,
  scale: number,
  alpha = 1,
) {
  const sx = (x: number) => cx + x * scale;
  const sy = (y: number) => cy + y * scale;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  for (const [i, j] of SKELETON_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!a || !b || a.visibility < 0.3 || b.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (const lm of landmarks) {
    if (lm.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.arc(sx(lm.x), sy(lm.y), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Phase badge color ──────────────────────────────────────────────────────
function phaseColor(phase: SwingPhase | null) {
  if (!phase || phase === "Unknown") return "bg-secondary text-muted-foreground";
  const map: Record<string, string> = {
    Gather: "bg-blue-500/20 text-blue-400",
    Touchdown: "bg-yellow-500/20 text-yellow-400",
    Thrust: "bg-orange-500/20 text-orange-400",
    Contact: "bg-primary/20 text-primary",
    "Post-Contact": "bg-purple-500/20 text-purple-400",
  };
  return map[phase] ?? "bg-secondary text-muted-foreground";
}

// ── ScrubPanel ─────────────────────────────────────────────────────────────
// One video panel with live phase detection + lock button.
function ScrubPanel({
  label,
  color,
  videoUrl,
  lockedPose,
  onLock,
  onUnlock,
}: {
  label: string;
  color: string;
  videoUrl: string;
  lockedPose: PoseResult | null;
  onLock: (pose: PoseResult) => void;
  onUnlock: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [livePose, setLivePose] = useState<PoseResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const lastDetectRef = useRef(0);

  const runDetect = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid || vid.readyState < 2) return;
    const now = performance.now();
    if (now - lastDetectRef.current < 150) return; // throttle to ~6fps
    lastDetectRef.current = now;
    setDetecting(true);
    const result = await detectPose(vid, now);
    setDetecting(false);
    if (result) setLivePose(result);
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.addEventListener("timeupdate", runDetect);
    vid.addEventListener("seeked", runDetect);
    vid.addEventListener("pause", runDetect);
    return () => {
      vid.removeEventListener("timeupdate", runDetect);
      vid.removeEventListener("seeked", runDetect);
      vid.removeEventListener("pause", runDetect);
    };
  }, [runDetect, videoUrl]);

  // Reset live pose when video changes
  useEffect(() => { setLivePose(null); }, [videoUrl]);

  const displayPhase = lockedPose?.phase ?? livePose?.phase ?? null;
  const isLocked = !!lockedPose;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </p>
        {displayPhase && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phaseColor(displayPhase)} ${isLocked ? "ring-1 ring-current" : ""}`}>
            {isLocked ? "🔒 " : ""}{displayPhase}
          </span>
        )}
      </div>

      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          crossOrigin="anonymous"
          controls
          playsInline
          className="w-full h-full object-contain"
        />
        {detecting && (
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
        {isLocked && (
          <div className="absolute inset-0 ring-2 rounded-lg pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${color}` }} />
        )}
      </div>

      <div className="flex gap-2">
        {!isLocked ? (
          <Button
            size="sm"
            className="flex-1"
            disabled={!livePose}
            onClick={() => livePose && onLock(livePose)}
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            {livePose ? `Lock at ${livePose.phase}` : "Scrub to detect pose"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="flex-1" onClick={onUnlock}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Unlock
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main CompTrainer ───────────────────────────────────────────────────────
export function CompTrainer({ comp, compVideos, userVideos, onBack }: Props) {
  const [selectedCompVideoId, setSelectedCompVideoId] = useState(compVideos[0]?.id ?? "");
  const [selectedUserVideoId, setSelectedUserVideoId] = useState(userVideos[0]?.id ?? "");
  const [playerLocked, setPlayerLocked] = useState<PoseResult | null>(null);
  const [compLocked, setCompLocked] = useState<PoseResult | null>(null);
  const [ghostVisible, setGhostVisible] = useState(false);
  const ghostCanvasRef = useRef<HTMLCanvasElement>(null);

  const selectedCompVideo = compVideos.find(v => v.id === selectedCompVideoId);
  const selectedUserVideo = userVideos.find(v => v.id === selectedUserVideoId);
  const bothLocked = !!playerLocked && !!compLocked;
  const compFirst = comp.player.name.split(" ")[0];

  // Reset locks when video selection changes
  useEffect(() => { setPlayerLocked(null); setGhostVisible(false); }, [selectedUserVideoId]);
  useEffect(() => { setCompLocked(null); setGhostVisible(false); }, [selectedCompVideoId]);

  // Draw ghost canvas whenever both are locked and ghost is visible
  useEffect(() => {
    if (!ghostVisible || !playerLocked || !compLocked) return;
    const canvas = ghostCanvasRef.current;
    if (!canvas) return;

    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const cx = W / 2;
    const cy = H * 0.62; // hip anchor slightly below center
    const scale = H * 0.28;

    const playerNorm = normalizeSkeleton(playerLocked.landmarks);
    const compNorm = normalizeSkeleton(compLocked.landmarks);

    // Draw comp skeleton first (behind), more transparent
    drawGhostSkeleton(ctx, compNorm, "#fb923c", cx, cy, scale, 0.65);
    // Draw player skeleton on top
    drawGhostSkeleton(ctx, playerNorm, "#4ade80", cx, cy, scale, 1);

    // Phase labels
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#4ade80";
    ctx.fillText(`YOU · ${playerLocked.phase}`, 12, H - 24);
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`${comp.player.name.toUpperCase()} · ${compLocked.phase}`, 12, H - 10);
  }, [ghostVisible, playerLocked, compLocked, comp.player.name]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-4 w-px bg-border" />
        {comp.player.imageUrl && (
          <img src={comp.player.imageUrl} alt={comp.player.name}
            className="w-8 h-8 rounded-full object-contain bg-secondary border border-border" />
        )}
        <div>
          <p className="font-bold text-sm leading-tight">{comp.player.name}</p>
          <p className="text-xs text-muted-foreground">
            {comp.player.team} · {comp.compType === "auto" ? `#${comp.rank} biometric comp` : "Studying"}
          </p>
        </div>
      </div>

      {/* Video selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Swing</label>
          {userVideos.length === 0 ? (
            <div className="h-10 flex items-center text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 border border-border">
              No uploads yet
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedUserVideoId}
                onChange={e => setSelectedUserVideoId(e.target.value)}
                className="w-full h-10 rounded-md bg-secondary/30 border border-border px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {userVideos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{compFirst}'s Swing</label>
          {compVideos.length === 0 ? (
            <div className="h-10 flex items-center text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 border border-border">
              No videos for {comp.player.name}
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedCompVideoId}
                onChange={e => setSelectedCompVideoId(e.target.value)}
                className="w-full h-10 rounded-md bg-secondary/30 border border-border px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {compVideos.map(v => <option key={v.id} value={v.id}>{v.title}{v.season ? ` (${v.season})` : ""}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      {!bothLocked && (
        <div className="bg-secondary/30 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
          <span className="text-primary mt-0.5">→</span>
          <span>
            Scrub each video to the frame you want to compare — the phase badge updates live as MediaPipe detects your position.
            Hit <strong className="text-foreground">Lock</strong> on each to freeze the pose, then compare.
          </span>
        </div>
      )}

      {/* Scrub panels */}
      <div className="grid grid-cols-2 gap-4">
        <ScrubPanel
          label="Your swing"
          color="#4ade80"
          videoUrl={selectedUserVideo?.sourceUrl ?? ""}
          lockedPose={playerLocked}
          onLock={setPlayerLocked}
          onUnlock={() => { setPlayerLocked(null); setGhostVisible(false); }}
        />
        <ScrubPanel
          label={`${compFirst}'s swing`}
          color="#fb923c"
          videoUrl={selectedCompVideo?.sourceUrl ?? ""}
          lockedPose={compLocked}
          onLock={setCompLocked}
          onUnlock={() => { setCompLocked(null); setGhostVisible(false); }}
        />
      </div>

      {/* Ghost comparison CTA */}
      {bothLocked && (
        <Button
          className="w-full gap-2"
          onClick={() => setGhostVisible(v => !v)}
        >
          <Ghost className="w-4 h-4" />
          {ghostVisible ? "Hide Ghost Comparison" : "View Ghost Comparison"}
        </Button>
      )}

      {/* Ghost canvas */}
      {ghostVisible && bothLocked && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Ghost Overlay</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-green-400 rounded inline-block" />You
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-orange-400 rounded inline-block" />{compFirst}
              </span>
            </span>
          </div>
          <canvas
            ref={ghostCanvasRef}
            width={480}
            height={560}
            className="w-full rounded-xl border border-border"
            style={{ background: "#0a0a0f" }}
          />
        </div>
      )}

      {/* Mechanics Gap */}
      <div className="space-y-2 pt-2 border-t border-border">
        <h3 className="font-display font-bold text-lg uppercase tracking-wide">Mechanics Gap</h3>
        <MechanicsGap
          playerAngles={playerLocked?.jointAngles ?? null}
          compAngles={compLocked?.jointAngles ?? null}
          playerPhase={playerLocked?.phase ?? "Unknown"}
          compName={comp.player.name}
        />
      </div>
    </div>
  );
}
