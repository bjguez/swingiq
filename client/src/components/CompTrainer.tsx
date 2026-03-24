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
// Centers each skeleton on hip midpoint, scales by torso length.
type NL = { x: number; y: number; visibility: number };

function normalizeSkeleton(lm: PoseResult["landmarks"]): NL[] {
  const hipMidX = (lm[23].x + lm[24].x) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;
  const shoulderMidX = (lm[11].x + lm[12].x) / 2;
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const torso = Math.sqrt((shoulderMidX - hipMidX) ** 2 + (shoulderMidY - hipMidY) ** 2);
  const t = torso || 1;
  return lm.map(p => ({
    x: (p.x - hipMidX) / t,
    y: (p.y - hipMidY) / t,
    visibility: p.visibility,
  }));
}

// ── Ghost canvas renderer ──────────────────────────────────────────────────
// Adaptive: computes bounding box of BOTH skeletons combined, then scales
// to fit the canvas with padding. Arms during a swing won't clip.
function renderGhostCanvas(
  canvas: HTMLCanvasElement,
  playerResult: PoseResult,
  compResult: PoseResult,
  compName: string,
  playerPhase: string,
  compPhase: string,
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const playerNorm = normalizeSkeleton(playerResult.landmarks);
  const compNorm   = normalizeSkeleton(compResult.landmarks);

  // Collect all visible points to compute bounding box
  const VIS = 0.1;
  const allPts = [...playerNorm, ...compNorm].filter(p => p.visibility > VIS);

  ctx.fillStyle = "#07070f";
  ctx.fillRect(0, 0, W, H);

  if (allPts.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No pose landmarks detected", W / 2, H / 2);
    return;
  }

  // Bounding box
  const xs = allPts.map(p => p.x);
  const ys = allPts.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Scale to fit canvas with 12% padding each side
  const PAD = 0.12;
  const scaleX = (W * (1 - 2 * PAD)) / Math.max(maxX - minX, 0.01);
  const scaleY = (H * (1 - 2 * PAD)) / Math.max(maxY - minY, 0.01);
  const scale  = Math.min(scaleX, scaleY);

  const toX = (nx: number) => W / 2 + (nx - cx) * scale;
  const toY = (ny: number) => H / 2 + (ny - cy) * scale;

  // Subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

  const drawSkeleton = (norm: NL[], color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const a = norm[i]; const b = norm[j];
      if (!a || !b || a.visibility < VIS || b.visibility < VIS) continue;
      ctx.beginPath();
      ctx.moveTo(toX(a.x), toY(a.y));
      ctx.lineTo(toX(b.x), toY(b.y));
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const lm of norm) {
      if (lm.visibility < VIS) continue;
      ctx.beginPath();
      ctx.arc(toX(lm.x), toY(lm.y), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // Comp behind (translucent), player on top
  drawSkeleton(compNorm,   "#fb923c", 0.65);
  drawSkeleton(playerNorm, "#4ade80", 1.0);

  // Phase labels
  const firstName = compName.split(" ")[0].toUpperCase();
  ctx.shadowBlur = 0;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "#4ade80";
  ctx.fillText(`YOU · ${playerPhase}`, 12, H - 22);
  ctx.fillStyle = "#fb923c";
  ctx.fillText(`${firstName} · ${compPhase}`, 12, H - 8);
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

  const selectedCompVideo = compVideos.find(v => v.id === selectedCompVideoId);
  const selectedUserVideo = userVideos.find(v => v.id === selectedUserVideoId);
  const bothLocked = !!playerLocked && !!compLocked;
  const compFirst = comp.player.name.split(" ")[0];

  // Reset locks when video selection changes
  useEffect(() => { setPlayerLocked(null); setGhostVisible(false); }, [selectedUserVideoId]);
  useEffect(() => { setCompLocked(null); setGhostVisible(false); }, [selectedCompVideoId]);

  // Callback ref — fires the moment the canvas element mounts, guaranteed non-null.
  const ghostCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !playerLocked || !compLocked) return;
    renderGhostCanvas(
      canvas,
      playerLocked,
      compLocked,
      comp.player.name,
      playerLocked.phase,
      compLocked.phase,
    );
  }, [playerLocked, compLocked, comp.player.name]); // eslint-disable-line

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
