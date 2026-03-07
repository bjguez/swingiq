import { useState, useRef, useCallback, useEffect } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, 
  MousePointer2, PenTool, Circle, Square, Type, 
  Undo, Trash2, Link2, Youtube, Upload, Maximize, Minimize, Timer, PersonStanding
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { VideoLibraryModal } from "./VideoLibraryModal";
import VideoPlayer, { type VideoPlayerHandle } from "./VideoPlayer";
import DrawingCanvas, { type Tool, type DrawAction } from "./DrawingCanvas";
import PoseOverlay from "./PoseOverlay";
import { detectPose, type PoseResult } from "@/lib/poseDetector";

interface VideoComparisonProps {
  externalLeftSrc?: string | null;
  externalLeftLabel?: string;
}

export default function VideoComparison({ externalLeftSrc, externalLeftLabel }: VideoComparisonProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([0]);
  const [synced, setSynced] = useState(true);
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

  useEffect(() => {
    if (externalLeftSrc) {
      setLeftVideoSrc(externalLeftSrc);
      setLeftLabel(externalLeftLabel ?? "My Swing");
    }
  }, [externalLeftSrc, externalLeftLabel]);

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

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  const handleLeftTimeUpdate = useCallback((time: number, dur: number) => {
    if (dur > 0) {
      setCurrentTime(time);
      setLeftDuration(dur);
      setProgress([(time / dur) * 100]);
    }
  }, []);

  const handleRightTimeUpdate = useCallback((time: number, dur: number) => {
    if (dur > 0 && !leftVideoSrc) {
      setCurrentTime(time);
      setRightDuration(dur);
      setProgress([(time / dur) * 100]);
    } else if (dur > 0) {
      setRightDuration(dur);
    }
  }, [leftVideoSrc]);

  const handleSeek = useCallback((values: number[]) => {
    const pct = values[0];
    setProgress(values);
    
    if (leftVideoSrc) {
      const leftTime = (pct / 100) * leftDuration;
      setCurrentTime(leftTime);
      leftVideoRef.current?.seek(leftTime);
    }
    if (rightVideoSrc && (synced || !leftVideoSrc)) {
      const rightTime = (pct / 100) * rightDuration;
      if (!leftVideoSrc) setCurrentTime(rightTime);
      rightVideoRef.current?.seek(rightTime);
    }
  }, [leftDuration, rightDuration, synced, leftVideoSrc, rightVideoSrc]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (leftVideoSrc) leftVideoRef.current?.pause();
      if (rightVideoSrc) rightVideoRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (leftVideoSrc) leftVideoRef.current?.play();
      if (rightVideoSrc && (synced || !leftVideoSrc)) rightVideoRef.current?.play();
      setIsPlaying(true);
    }
  }, [isPlaying, synced, leftVideoSrc, rightVideoSrc]);

  const stepForward = useCallback(() => {
    if (leftVideoSrc) { leftVideoRef.current?.pause(); leftVideoRef.current?.stepForward(); }
    if (rightVideoSrc && (synced || !leftVideoSrc)) { rightVideoRef.current?.pause(); rightVideoRef.current?.stepForward(); }
    setIsPlaying(false);
  }, [synced, leftVideoSrc, rightVideoSrc]);

  const stepBackward = useCallback(() => {
    if (leftVideoSrc) { leftVideoRef.current?.pause(); leftVideoRef.current?.stepBackward(); }
    if (rightVideoSrc && (synced || !leftVideoSrc)) { rightVideoRef.current?.pause(); rightVideoRef.current?.stepBackward(); }
    setIsPlaying(false);
  }, [synced, leftVideoSrc, rightVideoSrc]);

  const handleLeftUpload = useCallback((url: string, label?: string) => {
    setLeftVideoSrc(url);
    if (label) setLeftLabel(label);
    setLeftAnnotations([]);
  }, []);

  const handleRightUpload = useCallback((url: string, label?: string) => {
    setRightVideoSrc(url);
    if (label) setRightLabel(label);
    setRightAnnotations([]);
  }, []);

  const undoAnnotation = useCallback(() => {
    setLeftAnnotations(prev => prev.slice(0, -1));
    setRightAnnotations(prev => prev.slice(0, -1));
  }, []);

  const clearAnnotations = useCallback(() => {
    setLeftAnnotations([]);
    setRightAnnotations([]);
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

  const runPoseDetection = useCallback(async (force = false) => {
    if (!poseEnabled || !leftVideoSrc) return;
    const videoEl = leftVideoRef.current?.getVideoElement();
    if (!videoEl) return;

    const ct = videoEl.currentTime;
    if (!force && Math.abs(ct - lastPoseTimeRef.current) < 0.01) return;
    lastPoseTimeRef.current = ct;

    const result = await detectPose(videoEl, performance.now());
    if (result) setPoseResult(result);
  }, [poseEnabled, leftVideoSrc]);

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
      const videoEl = leftVideoRef.current?.getVideoElement();
      if (videoEl && !videoEl.paused) {
        runPoseDetection();
      }
      if (active) poseRafRef.current = requestAnimationFrame(loop);
    };
    poseRafRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(poseRafRef.current);
    };
  }, [poseEnabled, runPoseDetection]);

  useEffect(() => {
    if (poseEnabled && leftVideoSrc) {
      runPoseDetection(true);
    }
  }, [currentTime, poseEnabled, leftVideoSrc, runPoseDetection]);

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
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isFullscreen ? 'flex-1' : ''}`}>
        
        {/* Left (Amateur) Video */}
        <div className={`relative rounded-lg overflow-hidden border border-border bg-black ${isFullscreen ? 'h-full' : 'aspect-video'}`}>
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-30 flex justify-between items-start pointer-events-none">
            <div>
              <div className="text-white font-bold font-display text-lg drop-shadow-md">{leftLabel}</div>
              <div className="text-white/70 text-xs">{leftVideoSrc ? "Uploaded" : "No video"}</div>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              <VideoLibraryModal 
                onVideoSelected={handleLeftUpload}
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
            className="w-full h-full object-contain"
            placeholder={
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <Upload className="w-8 h-8 text-muted-foreground/50" />
                <span className="text-muted-foreground text-xs">Upload your swing video</span>
              </div>
            }
          />

          <PoseOverlay poseResult={poseResult} visible={poseEnabled} videoElement={leftVideoRef.current?.getVideoElement()} />

          <DrawingCanvas
            tool={activeTool}
            color={activeColor}
            annotations={leftAnnotations}
            onAnnotationsChange={setLeftAnnotations}
            onTimerClick={handleTimerClick}
          />

          {poseEnabled && poseResult && (
            <div data-testid="pose-hud" className="absolute bottom-2 left-2 z-30 bg-black/80 border border-border rounded-lg p-2 text-xs font-mono space-y-1 pointer-events-none">
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

          {poseLoading && poseEnabled && (
            <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
              <div className="bg-black/60 rounded-lg px-4 py-2 text-sm text-white animate-pulse">
                Loading pose model...
              </div>
            </div>
          )}
        </div>

        {/* Right (Pro) Video */}
        <div className={`relative rounded-lg overflow-hidden border border-border bg-black ${isFullscreen ? 'h-full' : 'aspect-video'}`}>
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-30 flex justify-between items-start pointer-events-none">
            <div>
              <div className="text-white font-bold font-display text-lg drop-shadow-md">{rightLabel}</div>
              <div className="text-white/70 text-xs">{rightVideoSrc ? "Loaded" : "No video"}</div>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              <VideoLibraryModal 
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
            className="w-full h-full object-contain"
            placeholder={
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <Upload className="w-8 h-8 text-muted-foreground/50" />
                <span className="text-muted-foreground text-xs">Import a pro swing to compare</span>
              </div>
            }
          />

          <DrawingCanvas
            tool={activeTool}
            color={activeColor}
            annotations={rightAnnotations}
            onAnnotationsChange={setRightAnnotations}
            onTimerClick={handleTimerClick}
          />
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
            onClick={() => setSynced(!synced)}
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

        <div className="flex items-center justify-between">
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
          
          <div className="flex items-center gap-2">
            <VideoLibraryModal 
              onVideoSelected={handleRightUpload}
              trigger={
                <Button variant="outline" size="sm" className="hidden sm:flex border-border bg-secondary/50" data-testid="button-import-mlb">
                  <Youtube className="w-4 h-4 mr-2 text-red-500" />
                  Import MLB clip
                </Button>
              } 
            />
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