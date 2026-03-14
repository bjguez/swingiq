import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scissors, Play, Pause, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface VideoTrimmerProps {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  trigger: React.ReactNode;
}

export default function VideoTrimmer({ videoId, videoUrl, videoTitle, trigger }: VideoTrimmerProps) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"start" | "end" | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setError(null);
      setTrimming(false);
    }
  }, [open]);

  const handleLoadedMetadata = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const d = vid.duration;
    setDuration(d);
    setStartTime(0);
    setEndTime(d);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if (vid.currentTime >= endTime) {
      vid.pause();
      setIsPlaying(false);
      vid.currentTime = startTime;
    }
  }, [endTime, startTime]);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      if (vid.currentTime < startTime || vid.currentTime >= endTime) {
        vid.currentTime = startTime;
      }
      vid.play();
      setIsPlaying(true);
    }
  }, [isPlaying, startTime, endTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0;

  const handlePointerDown = (handle: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = handle;

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const time = ratio * duration;

      if (dragging.current === "start") {
        const newStart = Math.min(time, endTime - 0.1);
        setStartTime(Math.max(0, newStart));
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, newStart);
      } else {
        const newEnd = Math.min(duration, Math.max(time, startTime + 0.1));
        setEndTime(newEnd);
        if (videoRef.current && videoRef.current.currentTime > newEnd) {
          videoRef.current.currentTime = startTime;
        }
      }
    };

    const onUp = () => {
      dragging.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const handleTrim = async () => {
    setTrimming(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/trim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime, endTime }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Trim failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to trim video");
    } finally {
      setTrimming(false);
    }
  };

  const clipDuration = endTime - startTime;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Trim Video
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground truncate">{videoTitle}</p>

        <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            preload="auto"
            muted
          />
          <button
            onClick={togglePlay}
            data-testid="trim-play-toggle"
            className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/80 rounded-full p-2 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
          </button>
        </div>

        <div className="space-y-3">
          <div
            ref={trackRef}
            className="relative h-12 bg-secondary rounded-lg overflow-hidden cursor-pointer select-none"
            data-testid="trim-track"
          >
            <div
              className="absolute inset-y-0 bg-primary/20 border-x-2 border-primary"
              style={{ left: `${pct(startTime)}%`, width: `${pct(endTime) - pct(startTime)}%` }}
            />

            <div
              className="absolute top-0 bottom-0 w-1 bg-white/60 z-10"
              style={{ left: `${pct(currentTime)}%` }}
            />

            <div
              className="absolute top-0 bottom-0 w-4 cursor-col-resize z-20 flex items-center justify-center group"
              style={{ left: `calc(${pct(startTime)}% - 8px)` }}
              onPointerDown={handlePointerDown("start")}
              data-testid="trim-handle-start"
            >
              <div className="w-1.5 h-8 bg-primary rounded-full group-hover:bg-primary/80 shadow-lg" />
            </div>

            <div
              className="absolute top-0 bottom-0 w-4 cursor-col-resize z-20 flex items-center justify-center group"
              style={{ left: `calc(${pct(endTime)}% - 8px)` }}
              onPointerDown={handlePointerDown("end")}
              data-testid="trim-handle-end"
            >
              <div className="w-1.5 h-8 bg-primary rounded-full group-hover:bg-primary/80 shadow-lg" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Start: <span className="text-foreground" data-testid="trim-start-time">{formatTime(startTime)}</span></span>
              <span className="text-muted-foreground">End: <span className="text-foreground" data-testid="trim-end-time">{formatTime(endTime)}</span></span>
            </div>
            <span className="text-primary font-bold" data-testid="trim-clip-duration">
              Clip: {formatTime(clipDuration)}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/20 text-destructive text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={trimming} data-testid="trim-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleTrim}
            disabled={trimming || clipDuration < 0.1}
            data-testid="trim-confirm"
            className="gap-2"
          >
            {trimming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Trimming...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                Trim to {formatTime(clipDuration)}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
