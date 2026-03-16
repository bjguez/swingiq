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
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, onTimeUpdate, onLoadedMetadata, className, placeholder, rotation = 0 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loadError, setLoadError] = useState(false);
    const prevSrcRef = useRef(src);
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      setLoadError(false);
    }

    // Explicitly call load() when src changes — some mobile browsers don't auto-load
    // when React updates the src attribute
    useEffect(() => {
      if (src && videoRef.current) {
        videoRef.current.load();
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

    const rotationStyle: React.CSSProperties = rotation !== 0 ? {
      transform: `rotate(${rotation}deg)`,
      ...(rotation === 90 || rotation === 270 ? { width: "100%", height: "100%", maxWidth: "unset" } : {}),
    } : {};

    const handleReady = () => {
      if (videoRef.current) videoRef.current.currentTime = 0.001;
    };

    return (
      <video
        ref={videoRef}
        src={src}
        className={className}
        style={rotationStyle}
        playsInline
        preload="metadata"
        onError={() => setLoadError(true)}
        onLoadedMetadata={() => {
          handleReady();
          if (videoRef.current) onLoadedMetadata?.(videoRef.current.duration);
        }}
        onCanPlay={handleReady}
        onTimeUpdate={() => {
          if (videoRef.current) {
            onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
          }
        }}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
