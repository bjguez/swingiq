import { useState, useRef, useCallback } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, 
  MousePointer2, PenTool, Circle, Square, Type, 
  Undo, Trash2, Link2, Youtube, Upload, Minus, Crosshair
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { VideoLibraryModal } from "./VideoLibraryModal";
import VideoPlayer, { type VideoPlayerHandle } from "./VideoPlayer";
import DrawingCanvas, { type Tool, type DrawAction } from "./DrawingCanvas";

export default function VideoComparison() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([0]);
  const [synced, setSynced] = useState(true);
  const [leftDuration, setLeftDuration] = useState(1);
  const [rightDuration, setRightDuration] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [activeColor, setActiveColor] = useState("#ef4444");

  const [leftVideoSrc, setLeftVideoSrc] = useState<string | null>(null);
  const [rightVideoSrc, setRightVideoSrc] = useState<string | null>(null);
  const [leftLabel, setLeftLabel] = useState("Amateur Swing");
  const [rightLabel, setRightLabel] = useState("Pro Swing");

  const [leftAnnotations, setLeftAnnotations] = useState<DrawAction[]>([]);
  const [rightAnnotations, setRightAnnotations] = useState<DrawAction[]>([]);

  const leftVideoRef = useRef<VideoPlayerHandle>(null);
  const rightVideoRef = useRef<VideoPlayerHandle>(null);

  const primaryDuration = leftVideoSrc ? leftDuration : rightDuration;

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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const colors = [
    { value: "#ef4444", label: "Red" },
    { value: "#eab308", label: "Yellow" },
    { value: "#22c55e", label: "Green" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card border border-border rounded-xl p-4 shadow-lg">
      
      {/* Left Toolbar */}
      <div className="lg:col-span-1 flex lg:flex-col gap-2 items-center justify-start py-2 border-b lg:border-b-0 lg:border-r border-border pr-0 lg:pr-4 overflow-x-auto lg:overflow-x-visible">
        <ToolButton icon={<MousePointer2 className="w-5 h-5" />} active={activeTool === "select"} tooltip="Select" onClick={() => setActiveTool("select")} />
        <ToolButton icon={<PenTool className="w-5 h-5" />} active={activeTool === "pen"} tooltip="Freehand" onClick={() => setActiveTool("pen")} />
        <ToolButton icon={<Minus className="w-5 h-5" />} active={activeTool === "line"} tooltip="Straight Line" onClick={() => setActiveTool("line")} />
        <ToolButton icon={<Crosshair className="w-5 h-5" />} active={activeTool === "angle"} tooltip="Measure Angle" onClick={() => setActiveTool("angle")} />
        <ToolButton icon={<Circle className="w-5 h-5" />} active={activeTool === "circle"} tooltip="Circle" onClick={() => setActiveTool("circle")} />
        <ToolButton icon={<Square className="w-5 h-5" />} active={activeTool === "rect"} tooltip="Rectangle" onClick={() => setActiveTool("rect")} />
        <ToolButton icon={<Type className="w-5 h-5" />} active={activeTool === "text"} tooltip="Text Notes" onClick={() => setActiveTool("text")} />
        
        <div className="w-px h-6 lg:w-6 lg:h-px bg-border my-2 flex-shrink-0" />
        
        <div className="flex lg:flex-col gap-2">
          {colors.map(c => (
            <div 
              key={c.value}
              onClick={() => setActiveColor(c.value)}
              className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-110 transition-transform ${
                activeColor === c.value ? 'border-white scale-110' : 'border-background'
              }`}
              style={{ backgroundColor: c.value }}
              data-testid={`color-${c.label.toLowerCase()}`}
            />
          ))}
        </div>

        <div className="w-px h-6 lg:w-6 lg:h-px bg-border my-2 flex-shrink-0" />

        <ToolButton icon={<Undo className="w-5 h-5" />} tooltip="Undo" onClick={undoAnnotation} />
        <ToolButton icon={<Trash2 className="w-5 h-5" />} tooltip="Clear All" onClick={clearAnnotations} />
      </div>

      {/* Main Video Area */}
      <div className="lg:col-span-11 flex flex-col gap-4">
        
        {/* Videos Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Left (Amateur) Video */}
          <div className="relative rounded-lg overflow-hidden border border-border bg-black aspect-video">
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

            <DrawingCanvas
              tool={activeTool}
              color={activeColor}
              annotations={leftAnnotations}
              onAnnotationsChange={setLeftAnnotations}
            />
          </div>

          {/* Right (Pro) Video */}
          <div className="relative rounded-lg overflow-hidden border border-border bg-black aspect-video">
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
            />
          </div>
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
            </div>
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
      className={`h-10 w-10 rounded-md shrink-0 transition-colors ${
        active 
          ? 'bg-primary/20 text-primary border border-primary/30' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {icon}
    </Button>
  );
}