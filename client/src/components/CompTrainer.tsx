import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MechanicsGap } from "@/components/MechanicsGap";
import { detectPose, SKELETON_CONNECTIONS } from "@/lib/poseDetector";
import type { PoseResult } from "@/lib/poseDetector";
import type { MlbPlayer, Video } from "@shared/schema";
import { ArrowLeft, Layers, LayoutPanelLeft, Scan, ChevronDown } from "lucide-react";

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

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseResult["landmarks"],
  color: string,
  w: number,
  h: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  for (const [i, j] of SKELETON_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!a || !b || a.visibility < 0.4 || b.visibility < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const lm of landmarks) {
    if (lm.visibility < 0.4) continue;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export function CompTrainer({ comp, compVideos, userVideos, onBack }: Props) {
  const [selectedCompVideoId, setSelectedCompVideoId] = useState<string>(compVideos[0]?.id ?? "");
  const [selectedUserVideoId, setSelectedUserVideoId] = useState<string>(userVideos[0]?.id ?? "");
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [overlayMode, setOverlayMode] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);

  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const compVideoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const playerPoseRef = useRef<PoseResult | null>(null);
  const compPoseRef = useRef<PoseResult | null>(null);
  const [playerPose, setPlayerPose] = useState<PoseResult | null>(null);
  const [compPose, setCompPose] = useState<PoseResult | null>(null);

  const poseLoopRef = useRef<number | null>(null);
  const detectTargetRef = useRef<"player" | "comp">("player");
  const canvasLoopRef = useRef<number | null>(null);

  const selectedCompVideo = compVideos.find(v => v.id === selectedCompVideoId);
  const selectedUserVideo = userVideos.find(v => v.id === selectedUserVideoId);
  const compFirst = comp.player.name.split(" ")[0];

  // ── Overlay canvas render loop ────────────────────────────────────────────
  const startCanvasLoop = useCallback(() => {
    const loop = () => {
      const canvas = overlayCanvasRef.current;
      const pVid = playerVideoRef.current;
      const cVid = compVideoRef.current;
      if (!canvas || !pVid || !cVid) { canvasLoopRef.current = requestAnimationFrame(loop); return; }

      const w = pVid.videoWidth || 640;
      const h = pVid.videoHeight || 360;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { canvasLoopRef.current = requestAnimationFrame(loop); return; }

      ctx.clearRect(0, 0, w, h);

      // Draw player video (base layer, full opacity)
      if (pVid.readyState >= 2) ctx.drawImage(pVid, 0, 0, w, h);

      // Draw comp video (overlay, semi-transparent, tinted slightly)
      if (cVid.readyState >= 2) {
        ctx.globalAlpha = overlayOpacity;
        ctx.drawImage(cVid, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // Draw pose skeletons
      if (poseEnabled) {
        if (playerPoseRef.current?.landmarks) {
          drawSkeleton(ctx, playerPoseRef.current.landmarks, "#4ade80", w, h);
        }
        if (compPoseRef.current?.landmarks) {
          drawSkeleton(ctx, compPoseRef.current.landmarks, "#fb923c", w, h);
        }
      }

      canvasLoopRef.current = requestAnimationFrame(loop);
    };
    canvasLoopRef.current = requestAnimationFrame(loop);
  }, [overlayOpacity, poseEnabled]);

  useEffect(() => {
    if (!overlayMode) {
      if (canvasLoopRef.current) cancelAnimationFrame(canvasLoopRef.current);
      return;
    }
    startCanvasLoop();
    return () => { if (canvasLoopRef.current) cancelAnimationFrame(canvasLoopRef.current); };
  }, [overlayMode, startCanvasLoop]);

  // ── Pose detection loop (alternates player / comp) ────────────────────────
  useEffect(() => {
    if (!poseEnabled) {
      if (poseLoopRef.current) cancelAnimationFrame(poseLoopRef.current);
      playerPoseRef.current = null;
      compPoseRef.current = null;
      setPlayerPose(null);
      setCompPose(null);
      return;
    }

    const loop = async () => {
      const target = detectTargetRef.current;
      const vid = target === "player" ? playerVideoRef.current : compVideoRef.current;

      if (vid && !vid.paused && vid.readyState >= 2) {
        const result = await detectPose(vid, performance.now());
        if (result) {
          if (target === "player") {
            playerPoseRef.current = result;
            setPlayerPose(result);
          } else {
            compPoseRef.current = result;
            setCompPose(result);
          }
        }
      }

      detectTargetRef.current = target === "player" ? "comp" : "player";
      poseLoopRef.current = requestAnimationFrame(loop) as unknown as number;
    };

    poseLoopRef.current = requestAnimationFrame(loop) as unknown as number;
    return () => { if (poseLoopRef.current) cancelAnimationFrame(poseLoopRef.current); };
  }, [poseEnabled]);

  // Reset poses when videos change
  useEffect(() => {
    playerPoseRef.current = null;
    setPlayerPose(null);
  }, [selectedUserVideoId]);

  useEffect(() => {
    compPoseRef.current = null;
    setCompPose(null);
  }, [selectedCompVideoId]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Comps
        </button>
        <div className="h-4 w-px bg-border" />
        {comp.player.imageUrl && (
          <img src={comp.player.imageUrl} alt={comp.player.name}
            className="w-8 h-8 rounded-full object-contain bg-secondary border border-border" />
        )}
        <div>
          <p className="font-bold text-sm leading-tight">{comp.player.name}</p>
          <p className="text-xs text-muted-foreground">{comp.player.team} · {comp.compType === "auto" ? `#${comp.rank} biometric comp` : "Studying"}</p>
        </div>
      </div>

      {/* Video selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Swing</label>
          {userVideos.length === 0 ? (
            <div className="h-10 flex items-center text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 border border-border">
              No uploads yet — go to My Swings
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedUserVideoId}
                onChange={e => setSelectedUserVideoId(e.target.value)}
                className="w-full h-10 rounded-md bg-secondary/30 border border-border px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {userVideos.map(v => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{compFirst}'s Swing</label>
          {compVideos.length === 0 ? (
            <div className="h-10 flex items-center text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 border border-border">
              No videos found for {comp.player.name}
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedCompVideoId}
                onChange={e => setSelectedCompVideoId(e.target.value)}
                className="w-full h-10 rounded-md bg-secondary/30 border border-border px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {compVideos.map(v => (
                  <option key={v.id} value={v.id}>{v.title} {v.season ? `(${v.season})` : ""}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Mode + controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-0.5">
          <button
            onClick={() => setOverlayMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${!overlayMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" /> Side by Side
          </button>
          <button
            onClick={() => setOverlayMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${overlayMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Layers className="w-3.5 h-3.5" /> Overlay
          </button>
        </div>

        {/* Opacity slider (overlay mode only) */}
        {overlayMode && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Opacity</span>
            <input
              type="range" min={0.1} max={0.9} step={0.05}
              value={overlayOpacity}
              onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-24 accent-primary"
            />
            <span>{Math.round(overlayOpacity * 100)}%</span>
          </div>
        )}

        {/* Pose toggle */}
        <button
          onClick={() => setPoseEnabled(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition-colors ml-auto ${
            poseEnabled
              ? "bg-primary/10 text-primary border-primary/30"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
          }`}
        >
          <Scan className="w-3.5 h-3.5" />
          {poseEnabled ? "Pose On" : "Pose Detection"}
        </button>
      </div>

      {/* Video area */}
      {overlayMode ? (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          {/* Hidden video elements used as canvas sources */}
          <video
            ref={playerVideoRef}
            src={selectedUserVideo?.sourceUrl ?? ""}
            crossOrigin="anonymous"
            className="hidden"
            playsInline
            muted
          />
          <video
            ref={compVideoRef}
            src={selectedCompVideo?.sourceUrl ?? ""}
            crossOrigin="anonymous"
            className="hidden"
            playsInline
            muted
          />
          <canvas ref={overlayCanvasRef} className="w-full h-full object-contain" />

          {/* Overlay controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <button
              onClick={() => {
                playerVideoRef.current?.paused ? playerVideoRef.current?.play() : playerVideoRef.current?.pause();
                compVideoRef.current?.paused ? compVideoRef.current?.play() : compVideoRef.current?.pause();
              }}
              className="bg-black/70 border border-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-black/90 transition-colors"
            >
              Play / Pause Both
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-3 right-3 bg-black/70 rounded-lg px-2.5 py-1.5 flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-400 rounded inline-block" />You</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-400 rounded inline-block" />{compFirst}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Swing</p>
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              {selectedUserVideo?.sourceUrl ? (
                <video
                  ref={playerVideoRef}
                  src={selectedUserVideo.sourceUrl}
                  crossOrigin="anonymous"
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  No video selected
                </div>
              )}
              {poseEnabled && playerPose && (
                <PoseDot phase={playerPose.phase} color="green" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{compFirst}'s Swing</p>
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              {selectedCompVideo?.sourceUrl ? (
                <video
                  ref={compVideoRef}
                  src={selectedCompVideo.sourceUrl}
                  crossOrigin="anonymous"
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  No video
                </div>
              )}
              {poseEnabled && compPose && (
                <PoseDot phase={compPose.phase} color="orange" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mechanics Gap analysis */}
      <div className="space-y-2">
        <h3 className="font-display font-bold text-lg uppercase tracking-wide flex items-center gap-2">
          <Scan className="w-5 h-5 text-primary" /> Mechanics Gap
        </h3>
        <MechanicsGap
          playerAngles={playerPose?.jointAngles ?? null}
          compAngles={compPose?.jointAngles ?? null}
          playerPhase={playerPose?.phase ?? "Unknown"}
          compName={comp.player.name}
        />
      </div>
    </div>
  );
}

function PoseDot({ phase, color }: { phase: string; color: "green" | "orange" }) {
  return (
    <div className="absolute top-2 left-2 bg-black/70 rounded px-1.5 py-0.5 text-[10px] font-bold"
      style={{ color: color === "green" ? "#4ade80" : "#fb923c" }}>
      {phase}
    </div>
  );
}
