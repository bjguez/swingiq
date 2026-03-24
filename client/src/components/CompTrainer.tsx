import { useRef, useState, useEffect } from "react";
import { MechanicsGap } from "@/components/MechanicsGap";
import PoseOverlay from "@/components/PoseOverlay";
import DrawingCanvas from "@/components/DrawingCanvas";
import type { Tool, DrawAction } from "@/components/DrawingCanvas";
import { detectPose } from "@/lib/poseDetector";
import type { PoseResult, SwingPhase } from "@/lib/poseDetector";
import type { MlbPlayer, Video } from "@shared/schema";
import {
  ArrowLeft, Lock, ChevronDown, RefreshCw,
  Eye, EyeOff, Pencil, Minus, Circle, Square, Type, Trash2, MousePointer,
} from "lucide-react";
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

// ── Drawing toolbar config ─────────────────────────────────────────────────
const DRAW_COLORS = ["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#06b6d4"];
const DRAW_TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: "select",  icon: <MousePointer className="w-3.5 h-3.5" />, label: "Select (no draw)" },
  { id: "pen",     icon: <Pencil className="w-3.5 h-3.5" />,       label: "Pen" },
  { id: "line",    icon: <Minus className="w-3.5 h-3.5" />,        label: "Line" },
  { id: "circle",  icon: <Circle className="w-3.5 h-3.5" />,       label: "Circle" },
  { id: "rect",    icon: <Square className="w-3.5 h-3.5" />,       label: "Rectangle" },
  { id: "text",    icon: <Type className="w-3.5 h-3.5" />,         label: "Text" },
];

// ── Phase badge ────────────────────────────────────────────────────────────
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

// ── Main CompTrainer ───────────────────────────────────────────────────────
export function CompTrainer({ comp, compVideos, userVideos, onBack }: Props) {
  // Video selection
  const [selectedUserVideoId, setSelectedUserVideoId] = useState(userVideos[0]?.id ?? "");
  const [selectedCompVideoId, setSelectedCompVideoId] = useState(compVideos[0]?.id ?? "");

  // Pose detection
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [playerLivePose, setPlayerLivePose] = useState<PoseResult | null>(null);
  const [compLivePose, setCompLivePose]     = useState<PoseResult | null>(null);

  // Dim overlay (0–70%)
  const [dimLevel, setDimLevel] = useState(0);

  // Drawing tools
  const [drawTool, setDrawTool]             = useState<Tool>("select");
  const [drawColor, setDrawColor]           = useState("#ffffff");
  const [leftAnnotations, setLeftAnnotations]   = useState<DrawAction[]>([]);
  const [rightAnnotations, setRightAnnotations] = useState<DrawAction[]>([]);

  // Locked poses (for Mechanics Gap)
  const [playerLocked, setPlayerLocked] = useState<PoseResult | null>(null);
  const [compLocked, setCompLocked]     = useState<PoseResult | null>(null);

  // Video element refs for detection
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const compVideoRef   = useRef<HTMLVideoElement>(null);

  const selectedUserVideo = userVideos.find(v => v.id === selectedUserVideoId);
  const selectedCompVideo = compVideos.find(v => v.id === selectedCompVideoId);
  const compFirst  = comp.player.name.split(" ")[0];

  // ── Pose detection interval (alternates player / comp each tick) ──────────
  useEffect(() => {
    if (!poseEnabled) {
      setPlayerLivePose(null);
      setCompLivePose(null);
      return;
    }
    let turn = 0;
    const id = setInterval(async () => {
      if (turn % 2 === 0) {
        const vid = playerVideoRef.current;
        if (vid && vid.readyState >= 2) {
          const r = await detectPose(vid, performance.now());
          if (r) setPlayerLivePose(r);
        }
      } else {
        const vid = compVideoRef.current;
        if (vid && vid.readyState >= 2) {
          const r = await detectPose(vid, performance.now());
          if (r) setCompLivePose(r);
        }
      }
      turn++;
    }, 100); // 10 fps alternating ≈ 5 fps per video
    return () => clearInterval(id);
  }, [poseEnabled]);

  // Reset when videos change
  useEffect(() => {
    setPlayerLocked(null);
    setPlayerLivePose(null);
  }, [selectedUserVideoId]);
  useEffect(() => {
    setCompLocked(null);
    setCompLivePose(null);
  }, [selectedCompVideoId]);

  const playerDisplayPose = playerLocked ?? playerLivePose;
  const compDisplayPose   = compLocked   ?? compLivePose;

  // ── Video panel helper ─────────────────────────────────────────────────────
  const VideoPanel = ({
    label,
    accentColor,
    videoRef,
    videoSrc,
    livePose,
    lockedPose,
    annotations,
    onAnnotationsChange,
    onLock,
    onUnlock,
    onClear,
  }: {
    label: string;
    accentColor: string;
    videoRef: React.RefObject<HTMLVideoElement>;
    videoSrc: string | undefined;
    livePose: PoseResult | null;
    lockedPose: PoseResult | null;
    annotations: DrawAction[];
    onAnnotationsChange: (a: DrawAction[]) => void;
    onLock: () => void;
    onUnlock: () => void;
    onClear: () => void;
  }) => {
    const isLocked = !!lockedPose;
    const displayPose = lockedPose ?? livePose;
    const phase = displayPose?.phase ?? null;

    return (
      <div className="space-y-2">
        {/* Panel header */}
        <div className="flex items-center justify-between min-h-5.5">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
            {label}
          </p>
          {phase && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phaseColor(phase)} ${isLocked ? "ring-1 ring-current" : ""}`}>
              {isLocked ? "🔒 " : ""}{phase}
            </span>
          )}
        </div>

        {/* Video container */}
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              crossOrigin="anonymous"
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              No video selected
            </div>
          )}

          {/* Dim overlay — behind pose and drawing */}
          <div
            className="absolute inset-0 z-10 pointer-events-none bg-black transition-opacity"
            style={{ opacity: dimLevel / 100 }}
          />

          {/* Pose overlay (z-20, pointer-events-none) */}
          {poseEnabled && videoSrc && (
            <PoseOverlay
              poseResult={displayPose}
              visible={poseEnabled}
              videoElement={videoRef.current}
            />
          )}

          {/* Drawing canvas (z-20, auto pointer-events when tool active) */}
          {videoSrc && (
            <DrawingCanvas
              tool={drawTool}
              color={drawColor}
              annotations={annotations}
              onAnnotationsChange={onAnnotationsChange}
            />
          )}

          {/* Locked ring indicator */}
          {isLocked && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none z-40"
              style={{ boxShadow: `inset 0 0 0 2px ${accentColor}` }}
            />
          )}
        </div>

        {/* Lock / clear row */}
        <div className="flex gap-2">
          {poseEnabled && (
            isLocked ? (
              <Button size="sm" variant="outline" className="flex-1" onClick={onUnlock}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Unlock
              </Button>
            ) : (
              <Button size="sm" className="flex-1" disabled={!livePose} onClick={onLock}>
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                {livePose ? `Lock · ${livePose.phase}` : "Scrub to detect pose"}
              </Button>
            )
          )}
          {annotations.length > 0 && (
            <Button size="sm" variant="outline" onClick={onClear} title="Clear drawings">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-4 w-px bg-border" />
        {comp.player.imageUrl && (
          <img
            src={comp.player.imageUrl}
            alt={comp.player.name}
            className="w-8 h-8 rounded-full object-contain bg-secondary border border-border"
          />
        )}
        <div>
          <p className="font-bold text-sm leading-tight">{comp.player.name}</p>
          <p className="text-xs text-muted-foreground">
            {comp.player.team} · {comp.compType === "auto" ? `#${comp.rank} biometric comp` : "Studying"}
          </p>
        </div>
      </div>

      {/* ── Video selectors ───────────────────────────────────────────── */}
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
                {compVideos.map(v => (
                  <option key={v.id} value={v.id}>{v.title}{v.season ? ` (${v.season})` : ""}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* ── Side-by-side video panels ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <VideoPanel
          label="Your Swing"
          accentColor="#4ade80"
          videoRef={playerVideoRef}
          videoSrc={selectedUserVideo?.sourceUrl}
          livePose={playerLivePose}
          lockedPose={playerLocked}
          annotations={leftAnnotations}
          onAnnotationsChange={setLeftAnnotations}
          onLock={() => playerLivePose && setPlayerLocked(playerLivePose)}
          onUnlock={() => setPlayerLocked(null)}
          onClear={() => setLeftAnnotations([])}
        />
        <VideoPanel
          label={`${compFirst}'s Swing`}
          accentColor="#fb923c"
          videoRef={compVideoRef}
          videoSrc={selectedCompVideo?.sourceUrl}
          livePose={compLivePose}
          lockedPose={compLocked}
          annotations={rightAnnotations}
          onAnnotationsChange={setRightAnnotations}
          onLock={() => compLivePose && setCompLocked(compLivePose)}
          onUnlock={() => setCompLocked(null)}
          onClear={() => setRightAnnotations([])}
        />
      </div>

      {/* ── Controls bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 bg-secondary/30 border border-border rounded-xl px-4 py-3">
        {/* Pose toggle */}
        <button
          onClick={() => setPoseEnabled(v => !v)}
          className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            poseEnabled
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {poseEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          Pose {poseEnabled ? "ON" : "OFF"}
        </button>

        {/* Dim slider */}
        <div className="flex items-center gap-2 flex-1 min-w-35">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Dim</span>
          <input
            type="range"
            min={0}
            max={70}
            value={dimLevel}
            onChange={e => setDimLevel(Number(e.target.value))}
            className="flex-1 h-1.5 accent-primary cursor-pointer"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{dimLevel}%</span>
        </div>
      </div>

      {/* ── Drawing toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tool buttons */}
        <div className="flex items-center gap-0.5 bg-secondary/30 border border-border rounded-lg p-1">
          {DRAW_TOOLS.map(t => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => setDrawTool(t.id)}
              className={`p-1.5 rounded-md transition-colors ${
                drawTool === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Color swatches */}
        <div className="flex items-center gap-1 bg-secondary/30 border border-border rounded-lg p-1.5">
          {DRAW_COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => setDrawColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${
                drawColor === c ? "scale-125 ring-2 ring-offset-1 ring-offset-background ring-white/50" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Clear buttons */}
        <div className="ml-auto flex gap-1.5">
          {leftAnnotations.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setLeftAnnotations([])} className="text-xs gap-1">
              <Trash2 className="w-3 h-3" /> Left
            </Button>
          )}
          {rightAnnotations.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setRightAnnotations([])} className="text-xs gap-1">
              <Trash2 className="w-3 h-3" /> Right
            </Button>
          )}
        </div>
      </div>

      {/* ── Mechanics Gap ─────────────────────────────────────────────── */}
      <div className="space-y-2 pt-2 border-t border-border">
        <h3 className="font-display font-bold text-lg uppercase tracking-wide">Mechanics Gap</h3>
        <MechanicsGap
          playerAngles={playerDisplayPose?.jointAngles ?? null}
          compAngles={compDisplayPose?.jointAngles ?? null}
          playerPhase={playerDisplayPose?.phase ?? "Unknown"}
          compName={comp.player.name}
        />
      </div>
    </div>
  );
}
