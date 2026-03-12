import { useRef, useImperativeHandle, forwardRef } from "react";

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  stepForward: () => void;
  stepBackward: () => void;
  getVideoElement: () => HTMLVideoElement | null;
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

    const rotationStyle: React.CSSProperties = rotation !== 0 ? {
      transform: `rotate(${rotation}deg)`,
      ...(rotation === 90 || rotation === 270 ? { width: "100%", height: "100%", maxWidth: "unset" } : {}),
    } : {};

    return (
      <video
        ref={videoRef}
        src={src}
        className={className}
        style={rotationStyle}
        playsInline
        preload="auto"
        onTimeUpdate={() => {
          if (videoRef.current) {
            onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            onLoadedMetadata?.(videoRef.current.duration);
          }
        }}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;