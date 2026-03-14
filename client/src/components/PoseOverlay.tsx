import { useRef, useState, useEffect, useCallback } from "react";
import type { PoseResult, PoseLandmark } from "@/lib/poseDetector";
import { SKELETON_CONNECTIONS, UPPER_BODY_INDICES } from "@/lib/poseDetector";

interface PoseOverlayProps {
  poseResult: PoseResult | null;
  visible: boolean;
  videoElement?: HTMLVideoElement | null;
  isFullscreen?: boolean;
}

const UPPER_COLOR = "#22c55e";
const LOWER_COLOR = "#60a5fa";
const JOINT_COLOR = "rgba(255,255,255,0.9)";
const ANGLE_BG = "rgba(0,0,0,0.72)";
const ANGLE_TEXT = "#fde68a";
const MIN_VISIBILITY = 0.5;
const LINE_WIDTH = 2;

const KEY_ANGLE_JOINTS: { index: number; key: keyof PoseResult["jointAngles"] }[] = [
  { index: 13, key: "leftElbow" },
  { index: 14, key: "rightElbow" },
  { index: 23, key: "leftHip" },
  { index: 24, key: "rightHip" },
  { index: 25, key: "leftKnee" },
  { index: 26, key: "rightKnee" },
];

function computeVideoRect(containerW: number, containerH: number, videoEl?: HTMLVideoElement | null) {
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
    return { offsetX: 0, offsetY: 0, drawW: containerW, drawH: containerH };
  }
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const videoAspect = vw / vh;
  const containerAspect = containerW / containerH;

  let drawW: number, drawH: number, offsetX: number, offsetY: number;
  if (videoAspect > containerAspect) {
    drawW = containerW;
    drawH = containerW / videoAspect;
    offsetX = 0;
    offsetY = (containerH - drawH) / 2;
  } else {
    drawH = containerH;
    drawW = containerH * videoAspect;
    offsetX = (containerW - drawW) / 2;
    offsetY = 0;
  }
  return { offsetX, offsetY, drawW, drawH };
}

export default function PoseOverlay({ poseResult, visible, videoElement, isFullscreen }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;

    const updateSize = (w: number, h: number) => {
      if (w > 0 && h > 0) {
        setCanvasSize({ width: w, height: h });
        if (canvasRef.current) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
        }
      }
    };

    updateSize(container.clientWidth, container.clientHeight);

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [visible, isFullscreen]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSize;
    if (width === 0 || height === 0) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!poseResult || !visible) return;

    const lm = poseResult.landmarks;
    if (lm.length < 33) return;

    const { offsetX, offsetY, drawW, drawH } = computeVideoRect(width, height, videoElement);
    const toCanvas = (p: PoseLandmark) => ({ x: offsetX + p.x * drawW, y: offsetY + p.y * drawH });

    // Draw skeleton connections
    ctx.lineWidth = LINE_WIDTH;
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const a = lm[i];
      const b = lm[j];
      if ((a.visibility ?? 0) < MIN_VISIBILITY || (b.visibility ?? 0) < MIN_VISIBILITY) continue;

      const pa = toCanvas(a);
      const pb = toCanvas(b);
      const isUpper = UPPER_BODY_INDICES.has(i) && UPPER_BODY_INDICES.has(j);
      const color = isUpper ? UPPER_COLOR : LOWER_COLOR;

      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Draw joints
    for (let i = 11; i < 33; i++) {
      const p = lm[i];
      if ((p.visibility ?? 0) < MIN_VISIBILITY) continue;
      const cp = toCanvas(p);
      ctx.fillStyle = JOINT_COLOR;
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw angle labels
    ctx.font = "bold 10px 'Inter', 'SF Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const { index, key } of KEY_ANGLE_JOINTS) {
      const p = lm[index];
      if ((p.visibility ?? 0) < MIN_VISIBILITY) continue;
      const cp = toCanvas(p);
      const angle = poseResult.jointAngles[key];
      const text = `${angle}°`;
      const metrics = ctx.measureText(text);
      const pad = 4;
      const bw = metrics.width + pad * 2;
      const bh = 15;
      const bx = cp.x + 7;
      const by = cp.y - bh / 2;

      ctx.fillStyle = ANGLE_BG;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();

      ctx.fillStyle = ANGLE_TEXT;
      ctx.fillText(text, bx + pad, cp.y);
    }
  }, [poseResult, visible, videoElement, canvasSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!visible) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 z-20 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="w-full h-full"
      />
    </div>
  );
}
