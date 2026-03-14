import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play, Pause, SkipBack, SkipForward,
  MousePointer2, PenTool, Circle, Square, Type,
  Undo, Trash2, Link2, Upload, Maximize, Minimize, Timer, PersonStanding, RotateCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { VideoLibraryModal } from "./VideoLibraryModal";
import VideoPlayer, { type VideoPlayerHandle } from "./VideoPlayer";
import DrawingCanvas, { type Tool, type DrawAction } from "./DrawingCanvas";
import PoseOverlay from "./PoseOverlay";
import { detectPose, resetPoseDetector, type PoseResult } from "@/lib/poseDetector";

const SPEEDS = [0.25, 0.5, 0.75, 1];

interface VideoComparisonProps {
  externalLeftSrc?: string | null;
  externalLeftLabel?: string;
  externalRightSrc?: string | null;
  externalRightLabel?: string;
  onRightVideoSelected?: (label: string) => void;
}

export default function VideoComparison({ externalLeftSrc, externalLeftLabel, externalRightSrc, externalRightLabel, onRightVideoSelected }: VideoComparisonProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([0]);
  const [synced, setSynced] = useState(true);
  const [activePanel, setActivePanel] = useState<"left" | "right" | null>(null);
  const [leftDuration, setLeftDuration] = useState(1);
  const [rightDuration, setRightDuration] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [activeColor, setActiveColor] = useState("#ef4444");

  const [leftVideoSrc, setLeftVideoSrc] = useState<string | null>(null);
  const [rightVideoSrc, setRightVideoSrc] = useState<string | null>(null);
  const [leftLabel, setLeftLabel] = useState("Amateur Swing");
  const [rightLabel, setRightLabel] = useState("Pro Swing");
  const [leftRotation, setLeftRotation] = useState<0 | 90 | 180 | 270>(0);
  const [rightRotation, setRightRotation] = useState<0 | 90 | 180 | 270>(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const applyRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (leftVideoSrc) leftVideoRef.current?.setRate(rate);
    if (rightVideoSrc) rightVideoRef.current?.setRate(rate);
  }, [leftVideoSrc, rightVideoSrc]);

  useEffect(() => {
    if (externalLeftSrc) {
      setLeftVideoSrc(externalLeftSrc);
      setLeftLabel(externalLeftLabel ?? "My Swing");
    }
  }, [externalLeftSrc, externalLeftLabel]);

  useEffect(() => {
    if (externalRightSrc) {
      setRightVideoSrc(externalRightSrc);
      const label = externalRightLabel ?? "Pro Swing";
      setRightLabel(label);
      onRightVideoSelected?.(label);
    }
  }, [externalRightSrc, externalRightLabel]);

  useEffect(() => {
    resetPoseDetector();
  }, [leftVideoSrc]);

  const [leftAnnotations, setLeftAnnotations] = useState<DrawAction[]>([]);
  const [rightAnnotations, setRightAnnotations] = useState<DrawAction[]>([]);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);

  const [poseEnabled, setPoseEnabled] = useState(false);
  const [poseResult, setPoseResult] = useState<PoseResult | null>(null);
  const [poseLoading, setPoseLoading] = useState(false);
  const poseRafRef = useRef<number>(0);
  const lastPoseTimeRef = useRef<number>(-1);

  const leftVideoRef = useRef<VideoPlayerHandle>(null);
  const rightVideoRef = useRef<VideoPlayerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const annotationHistoryRef = useRef<Array<"left" | "right">>([]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current as any;
    const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);

    if (!el.requestFullscreen && !el.webkitRequestFullscreen) {
      // iOS Safari: no arbitrary element fullscreen — use CSS overlay instead
      setIsFullscreen(prev => !prev);
      return;
    }

    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  }, []);

  const handleLeftTimeUpdate = useCallback((time: number, dur: number) => {
    if (dur > 0) {
      setLeftDuration(dur);
      if (synced || activePanel === "left" || activePanel === null) {
        setCurrentTime(time);
        setProgress([(time / dur) * 100]);
      }
    }
  }, [synced, activePanel]);

  const handleRightTimeUpdate = useCallback((time: number, dur: number) => {
    if (dur > 0) {
      setRightDuration(dur);
      if (!synced && activePanel === "right") {
        setCurrentTime(time);
        setProgress([(time / dur) * 100]);
      }
    }
  }, [synced, activePanel]);

  const affectsLeft = synced || activePanel === "left" || activePanel === null;
  const affectsRight = synced || activePanel === "right" || activePanel === null;

  const handleSeek = useCallback((values: number[]) => {
    const pct = values[0];
    setProgress(values);
    if (affectsLeft && leftVideoSrc) {
      const t = (pct / 100) * leftDuration;
      setCurrentTime(t);
      leftVideoRef.current?.seek(t);
    }
    if (affectsRight && rightVideoSrc) {
      const t = (pct / 100) * rightDuration;
      if (!affectsLeft) setCurrentTime(t);
      rightVideoRef.current?.seek(t);
    }
  }, [leftDuration, rightDuration, affectsLeft, affectsRight, leftVideoSrc, rightVideoSrc]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (affectsLeft && leftVideoSrc) leftVideoRef.current?.pause();
      if (affectsRight && rightVideoSrc) rightVideoRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (affectsLeft && leftVideoSrc) leftVideoRef.current?.play();
      if (affectsRight && rightVideoSrc) rightVideoRef.current?.play();
      setIsPlaying(true);
    }
  }, [isPlaying, affectsLeft, affectsRight, leftVideoSrc, rightVideoSrc]);

  const stepForward = useCallback(() => {
    if (affectsLeft && leftVideoSrc) { leftVideoRef.current?.pause(); leftVideoRef.current?.stepForward(); }
    if (affectsRight && rightVideoSrc) { rightVideoRef.current?.pause(); rightVideoRef.current?.stepForward(); }
    setIsPlaying(false);
  }, [affectsLeft, affectsRight, leftVideoSrc, rightVideoSrc]);

  const stepBackward = useCallback(() => {
    if (affectsLeft && leftVideoSrc) { leftVideoRef.current?.pause(); leftVideoRef.current?.stepBackward(); }
    if (affectsRight && rightVideoSrc) { rightVideoRef.current?.pause(); rightVideoRef.current?.stepBackward(); }
    setIsPlaying(false);
  }, [affectsLeft, affectsRight, leftVideoSrc, rightVideoSrc]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepBackward(); }
      else if (e.key === "[") {
        setPlaybackRate(prev => {
          const idx = SPEEDS.indexOf(prev);
          const next = idx > 0 ? SPEEDS[idx - 1] : prev;
          if (next !== prev) applyRate(next);
          return next;
        });
      } else if (e.key === "]") {
        setPlaybackRate(prev => {
          const idx = SPEEDS.indexOf(prev);
          const next = idx < SPEEDS.length - 1 ? SPEEDS[idx + 1] : prev;
          if (next !== prev) applyRate(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, stepForward, stepBackward, applyRate]);

  const handleLeftAnnotationsChange = useCallback((annotations: DrawAction[]) => {
    annotationHistoryRef.current.push("left");
    setLeftAnnotations(annotations);
  }, []);

  const handleRightAnnotationsChange = useCallback((annotations: DrawAction[]) => {
    annotationHistoryRef.current.push("right");
    setRightAnnotations(annotations);
  }, []);

  const handleLeftUpload = useCallback((url: string, label?: string) => {
    setLeftVideoSrc(url);
    if (label) setLeftLabel(label);
    setLeftAnnotations([]);
    annotationHistoryRef.current = [];
  }, []);

  const handleRightUpload = useCallback((url: string, label?: string) => {
    setRightVideoSrc(url);
    if (label) {
      setRightLabel(label);
      onRightVideoSelected?.(label);
    }
    setRightAnnotations([]);
    annotationHistoryRef.current = [];
  }, [onRightVideoSelected]);

  const undoAnnotation = useCallback(() => {
    const last = annotationHistoryRef.current.pop();
    if (last === "left") setLeftAnnotations(prev => prev.slice(0, -1));
    else if (last === "right") setRightAnnotations(prev => prev.slice(0, -1));
  }, []);

  const clearAnnotations = useCallback(() => {
    setLeftAnnotations([]);
    setRightAnnotations([]);
    annotationHistoryRef.current = [];
  }, []);

  const handleTimerClick = useCallback(() => {
    if (timerStart === null) {
      setTimerStart(currentTime);
      setTimerEnd(null);
    } else if (timerEnd === null) {
      setTimerEnd(currentTime);
    } else {
      setTimerStart(currentTime);
      setTimerEnd(null);
    }
  }, [currentTime, timerStart, timerEnd]);

  const clearTimer = useCallback(() => {
    setTimerStart(null);
    setTimerEnd(null);
  }, []);

  const activePoseVideoSrc = activePanel === "right" ? rightVideoSrc : leftVideoSrc;
  const activePoseRef = activePanel === "right" ? rightVideoRef : leftVideoRef;

  const runPoseDetection = useCallback(async (force = false) => {
    if (!poseEnabled || !activePoseVideoSrc) return;
    const videoEl = activePoseRef.current?.getVideoElement();
    if (!videoEl) return;

    const ct = videoEl.currentTime;
    if (!force && Math.abs(ct - lastPoseTimeRef.current) < 0.01) return;
    lastPoseTimeRef.current = ct;

    const result = await detectPose(videoEl, performance.now());
    if (result) setPoseResult(result);
  }, [poseEnabled, activePoseVideoSrc, activePoseRef]);

  useEffect(() => {
    if (!poseEnabled) {
      setPoseResult(null);
      cancelAnimationFrame(poseRafRef.current);
      return;
    }

    setPoseLoading(true);
    runPoseDetection(true).then(() => setPoseLoading(false));

    let active = true;
    const loop = () => {
      if (!active) return;
      const videoEl = activePoseRef.current?.getVideoElement();
      if (videoEl && !videoEl.paused) runPoseDetection();
      if (active) poseRafRef.current = requestAnimationFrame(loop);
    };
    poseRafRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(poseRafRef.current);
    };
  }, [poseEnabled, runPoseDetection]);

  useEffect(() => {
    if (poseEnabled && activePoseVideoSrc) {
      const videoEl = activePoseRef.current?.getVideoElement();
      if (videoEl && videoEl.paused) runPoseDetection(true);
    }
  }, [currentTime, poseEnabled, activePoseVideoSrc, activePoseRef, runPoseDetection, isFullscreen]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  const colors = [
    { value: "#ef4444", label: "Red" },
    { value: "#eab308", label: "Yellow" },
    { value: "#22c55e", label: "Green" },
  ];

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-4 bg-card border border-border rounded-xl p-4 shadow-lg ${
        isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none' : ''
      }`}
    >
      {/* Videos Container */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isFullscreen ? 'flex-1 min-h-0 grid-rows-[1fr]' : ''}`}>
        
        {/* Left (Amateur) Video */}
        <div
          className={`relative rounded-lg overflow-hidden bg-black cursor-pointer transition-shadow ${isFullscreen ? 'h-full min-h-0' : 'aspect-video'} ${
            synced ? 'ring-2 ring-blue-400/60 border border-blue-400/30' :
            activePanel === 'left' ? 'ring-2 ring-primary border border-primary/50' :
            'border border-border'
          }`}
          onClick={() => { setActivePanel("left"); setSynced(false); }}
        >
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-30 flex justify-between items-start pointer-events-none">
            <div>
              <div className="text-white font-bold font-display text-lg drop-shadow-md">{leftLabel}</div>
              <div className="text-white/70 text-xs">{leftVideoSrc ? "Uploaded" : "No video"}</div>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {leftVideoSrc && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40" title="Rotate video" onClick={() => setLeftRotation((r: 0 | 90 | 180 | 270) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}>
                  <RotateCw className="w-4 h-4" />
                </Button>
              )}
              <VideoLibraryModal
                mode="user"
                onVideoSelected={handleLeftUpload}
                onCompSelected={handleRightUpload}
                trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40" data-testid="button-upload-left">
                    <Upload className="w-4 h-4" />
                  </Button>
                }
              />
            </div>
          </div>
          
          <VideoPlayer
            ref={leftVideoRef}
            src={leftVideoSrc}
            onTimeUpdate={handleLeftTimeUpdate}
            onLoadedMetadata={(d) => setLeftDuration(d)}
            rotation={leftRotation}
            className="w-full h-full object-contain"
            placeholder={
              <VideoLibraryModal
                mode="user"
                onVideoSelected={handleLeftUpload}
                onCompSelected={handleRightUpload}
                trigger={
                  <div className="flex flex-col items-center gap-2 text-center p-4 cursor-pointer hover:opacity-80 transition-opacity">
                    <Upload className="w-8 h-8 text-muted-foreground/50" />
                    <span className="text-muted-foreground text-xs">Upload your swing video</span>
                  </div>
                }
              />
            }
          />

          {activePanel !== "right" && (
            <PoseOverlay poseResult={poseResult} visible={poseEnabled} videoElement={leftVideoRef.current?.getVideoElement()} isFullscreen={isFullscreen} />
          )}

          <DrawingCanvas
            tool={activeTool}
            color={activeColor}
            annotations={leftAnnotations}
            onAnnotationsChange={handleLeftAnnotationsChange}
            onTimerClick={handleTimerClick}
          />

          {activePanel !== "right" && poseEnabled && poseResult && (
            <div data-testid="pose-hud" className="hidden sm:block absolute bottom-2 left-2 z-30 bg-black/80 border border-border rounded-lg p-2 text-xs font-mono space-y-1 pointer-events-none">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  poseResult.phase === "Unknown" ? "bg-muted text-muted-foreground" : "bg-primary/30 text-primary"
                }`} data-testid="pose-phase-badge">
                  {poseResult.phase}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                <span className="text-green-400">L Elbow: {poseResult.jointAngles.leftElbow}°</span>
                <span className="text-green-400">R Elbow: {poseResult.jointAngles.rightElbow}°</span>
                <span className="text-blue-400">L Hip: {poseResult.jointAngles.leftHip}°</span>
                <span className="text-blue-400">R Hip: {poseResult.jointAngles.rightHip}°</span>
                <span className="text-blue-400">L Knee: {poseResult.jointAngles.leftKnee}°</span>
                <span className="text-blue-400">R Knee: {poseResult.jointAngles.rightKnee}°</span>
                <span className="text-yellow-400">Trunk: {poseResult.jointAngles.trunkAngle}°</span>
                <span className="text-yellow-400">Shld Rot: {poseResult.jointAngles.shoulderRotation}°</span>
              </div>
            </div>
          )}

          {activePanel !== "right" && poseLoading && poseEnabled && (
            <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
              <div className="bg-black/60 rounded-lg px-4 py-2 text-sm text-white animate-pulse">
                Loading pose model...
              </div>
            </div>
          )}
        </div>

        {/* Right (Pro) Video */}
        <div
          className={`relative rounded-lg overflow-hidden bg-black cursor-pointer transition-shadow ${isFullscreen ? 'h-full min-h-0' : 'aspect-video'} ${
            synced ? 'ring-2 ring-blue-400/60 border border-blue-400/30' :
            activePanel === 'right' ? 'ring-2 ring-primary border border-primary/50' :
            'border border-border'
          }`}
          onClick={() => { setActivePanel("right"); setSynced(false); }}
        >
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-30 flex justify-between items-start pointer-events-none">
            <div>
              <div className="text-white font-bold font-display text-lg drop-shadow-md">{rightLabel}</div>
              <div className="text-white/70 text-xs">{rightVideoSrc ? "Loaded" : "No video"}</div>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {rightVideoSrc && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40" title="Rotate video" onClick={() => setRightRotation((r: 0 | 90 | 180 | 270) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}>
                  <RotateCw className="w-4 h-4" />
                </Button>
              )}
              <VideoLibraryModal
                mode="pro"
                onVideoSelected={handleRightUpload}
                trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40" data-testid="button-upload-right">
                    <Upload className="w-4 h-4" />
                  </Button>
                }
              />
            </div>
          </div>
          
          <VideoPlayer
            ref={rightVideoRef}
            src={rightVideoSrc}
            onTimeUpdate={handleRightTimeUpdate}
            onLoadedMetadata={(d) => setRightDuration(d)}
            rotation={rightRotation}
            className="w-full h-full object-contain"
            placeholder={
              <VideoLibraryModal
                mode="pro"
                onVideoSelected={handleRightUpload}
                trigger={
                  <div className="flex flex-col items-center gap-2 text-center p-4 cursor-pointer hover:opacity-80 transition-opacity">
                    <Upload className="w-8 h-8 text-muted-foreground/50" />
                    <span className="text-muted-foreground text-xs">Import a pro swing to compare</span>
                  </div>
                }
              />
            }
          />

          {activePanel === "right" && (
            <PoseOverlay poseResult={poseResult} visible={poseEnabled} videoElement={rightVideoRef.current?.getVideoElement()} isFullscreen={isFullscreen} />
          )}

          <DrawingCanvas
            tool={activeTool}
            color={activeColor}
            annotations={rightAnnotations}
            onAnnotationsChange={handleRightAnnotationsChange}
            onTimerClick={handleTimerClick}
          />

          {activePanel === "right" && poseEnabled && poseResult && (
            <div data-testid="pose-hud" className="hidden sm:block absolute bottom-2 left-2 z-30 bg-black/80 border border-border rounded-lg p-2 text-xs font-mono space-y-1 pointer-events-none">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  poseResult.phase === "Unknown" ? "bg-muted text-muted-foreground" : "bg-primary/30 text-primary"
                }`}>
                  {poseResult.phase}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                <span className="text-green-400">L Elbow: {poseResult.jointAngles.leftElbow}°</span>
                <span className="text-green-400">R Elbow: {poseResult.jointAngles.rightElbow}°</span>
                <span className="text-blue-400">L Hip: {poseResult.jointAngles.leftHip}°</span>
                <span className="text-blue-400">R Hip: {poseResult.jointAngles.rightHip}°</span>
                <span className="text-blue-400">L Knee: {poseResult.jointAngles.leftKnee}°</span>
                <span className="text-blue-400">R Knee: {poseResult.jointAngles.rightKnee}°</span>
                <span className="text-yellow-400">Trunk: {poseResult.jointAngles.trunkAngle}°</span>
                <span className="text-yellow-400">Shld Rot: {poseResult.jointAngles.shoulderRotation}°</span>
              </div>
            </div>
          )}

          {activePanel === "right" && poseLoading && poseEnabled && (
            <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
              <div className="bg-black/60 rounded-lg px-4 py-2 text-sm text-white animate-pulse">
                Loading pose model...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawing Toolbar — horizontal, centered, below videos */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 border border-border rounded-lg bg-secondary/20 overflow-x-auto">
        <ToolButton icon={<MousePointer2 className="w-4 h-4" />} active={activeTool === "select"} tooltip="Select" onClick={() => setActiveTool("select")} />
        <ToolButton icon={<PenTool className="w-4 h-4" />} active={activeTool === "pen"} tooltip="Freehand" onClick={() => setActiveTool("pen")} />
        <ToolButton icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="12" y2="20" /></svg>} active={activeTool === "line"} tooltip="Straight Line" onClick={() => setActiveTool("line")} />
        <ToolButton icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="21" /><line x1="3" y1="21" x2="16" y2="4" /><path d="M10 21 A7 7 0 0 1 8.2 15.5" fill="none" /></svg>} active={activeTool === "angle"} tooltip="Measure Angle" onClick={() => setActiveTool("angle")} />
        <ToolButton icon={<Circle className="w-4 h-4" />} active={activeTool === "circle"} tooltip="Circle" onClick={() => setActiveTool("circle")} />
        <ToolButton icon={<Square className="w-4 h-4" />} active={activeTool === "rect"} tooltip="Rectangle" onClick={() => setActiveTool("rect")} />
        <ToolButton icon={<Type className="w-4 h-4" />} active={activeTool === "text"} tooltip="Text Notes" onClick={() => setActiveTool("text")} />
        
        <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

        <ToolButton icon={<Timer className="w-4 h-4" />} active={activeTool === "timer"} tooltip="Frame Timer" onClick={() => { setActiveTool("timer"); }} />
        
        <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

        <ToolButton
          icon={<PersonStanding className="w-4 h-4" />}
          active={poseEnabled}
          tooltip="Pose Detection"
          onClick={() => setPoseEnabled(prev => !prev)}
        />
        {timerStart !== null && (
          <div data-testid="timer-display" className="flex items-center gap-2 px-2 py-1 rounded bg-black/40 border border-border text-xs font-mono shrink-0">
            <span className="text-muted-foreground">A:</span>
            <span className="text-primary">{formatTime(timerStart)}</span>
            {timerEnd !== null && (
              <>
                <span className="text-muted-foreground">B:</span>
                <span className="text-primary">{formatTime(timerEnd)}</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className="text-yellow-400 font-bold">{formatTime(Math.abs(timerEnd - timerStart))}</span>
              </>
            )}
            <button onClick={clearTimer} className="text-muted-foreground hover:text-foreground ml-1">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
        
        {colors.map(c => (
          <div 
            key={c.value}
            onClick={() => setActiveColor(c.value)}
            className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-110 transition-transform shrink-0 ${
              activeColor === c.value ? 'border-white scale-110' : 'border-background'
            }`}
            style={{ backgroundColor: c.value }}
            data-testid={`color-${c.label.toLowerCase()}`}
          />
        ))}

        <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

        <ToolButton icon={<Undo className="w-4 h-4" />} tooltip="Undo" onClick={undoAnnotation} />
        <ToolButton icon={<Trash2 className="w-4 h-4" />} tooltip="Clear All" onClick={clearAnnotations} />
      </div>

      {/* Playback Controls */}
      <div className="bg-secondary/30 border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-10 w-10 shrink-0 ${synced ? 'bg-primary/20 text-primary border-primary/50' : 'text-muted-foreground'}`}
            onClick={() => { setSynced(s => !s); setActivePanel(null); }}
            title={synced ? "Videos synced — click to unsync" : "Videos unsynced — click to sync"}
            data-testid="button-sync"
          >
            <Link2 className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 h-8 flex items-center">
            <Slider 
              value={progress} 
              onValueChange={handleSeek} 
              max={100} 
              step={0.1}
              className="w-full" 
              data-testid="slider-progress"
            />
          </div>
          
          <div className="text-sm font-mono text-muted-foreground w-24 text-right" data-testid="text-time">
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={stepBackward} data-testid="button-step-back">
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={togglePlay}
              data-testid="button-play"
            >
              {isPlaying ? <Pause className="w-6 h-6 ml-0.5" /> : <Play className="w-6 h-6 ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={stepForward} data-testid="button-step-forward">
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speed controls */}
            <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-1">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => applyRate(s)}
                  className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                    playbackRate === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  title={`${s}x speed ([/] to adjust)`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-foreground"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon, active, tooltip, onClick }: { icon: React.ReactNode, active?: boolean, tooltip: string, onClick?: () => void }) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      title={tooltip}
      onClick={onClick}
      data-testid={`tool-${tooltip.toLowerCase().replace(/\s+/g, '-')}`}
      className={`h-9 w-9 rounded-md shrink-0 transition-colors ${
        active 
          ? 'bg-primary/20 text-primary border border-primary/30' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {icon}
    </Button>
  );
}