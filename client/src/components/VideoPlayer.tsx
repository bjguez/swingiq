import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  stepForward: () => void;
  stepBackward: () => void;
  getVideoElement: () => HTMLVideoElement | null;
  setRate: (rate: number) => void;
}

interface VideoPlayerProps {
  src: string | null;
  onTimeUpdate?: (time: number, duration: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  className?: string;
  placeholder?: React.ReactNode;
  rotation?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, onTimeUpdate, onLoadedMetadata, className, placeholder, rotation = 0, flipH = false, zoom = 1, panX = 0, panY = 0 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loadError, setLoadError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const firstFrameSeekDone = useRef(false);

    useEffect(() => {
      if (src) {
        setLoadError(false);
        setIsLoading(true);
        firstFrameSeekDone.current = false;
      }
    }, [src]);

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      seek: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
      stepForward: () => {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + 1 / 30,
            videoRef.current.duration
          );
        }
      },
      getVideoElement: () => videoRef.current,
      setRate: (rate: number) => {
        if (videoRef.current) videoRef.current.playbackRate = rate;
      },
      stepBackward: () => {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(
            videoRef.current.currentTime - 1 / 30,
            0
          );
        }
      },
    }));

    if (!src) {
      return (
        <div className={`flex items-center justify-center bg-black/50 ${className}`}>
          {placeholder || <span className="text-muted-foreground text-sm">No video loaded</span>}
        </div>
      );
    }

    if (loadError) {
      return (
        <div className={`flex flex-col items-center justify-center gap-2 bg-black/50 ${className}`}>
          <span className="text-destructive text-sm font-medium">Failed to load video</span>
          <span className="text-muted-foreground text-xs">The file may be missing or unavailable</span>
        </div>
      );
    }

    const parts: string[] = [];
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (flipH) parts.push("scaleX(-1)");
    if (zoom !== 1) parts.push(`scale(${zoom})`);
    if (panX !== 0 || panY !== 0) parts.push(`translate(${panX}px, ${panY}px)`);
    const videoStyle: React.CSSProperties = {
      ...(parts.length ? { transform: parts.join(" ") } : {}),
      ...(rotation === 90 || rotation === 270 ? { width: "100%", height: "100%", maxWidth: "unset" } : {}),
    };

    const handleFirstFrame = () => {
      if (videoRef.current && !firstFrameSeekDone.current) {
        firstFrameSeekDone.current = true;
        videoRef.current.currentTime = 0.001;
      }
    };

    return (
      <div className={`relative ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10 pointer-events-none">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          style={videoStyle}
          playsInline
          muted
          preload="metadata"
          onError={() => { setLoadError(true); setIsLoading(false); }}
          onLoadedMetadata={() => {
            handleFirstFrame();
            if (videoRef.current) onLoadedMetadata?.(videoRef.current.duration);
          }}
          onCanPlay={() => {
            setIsLoading(false);
            handleFirstFrame();
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
            }
          }}
        />
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
