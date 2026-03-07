import { useRef, useState, useEffect, useCallback } from "react";
import type { PoseResult, PoseLandmark } from "@/lib/poseDetector";
import { SKELETON_CONNECTIONS, UPPER_BODY_INDICES } from "@/lib/poseDetector";

interface PoseOverlayProps {
  poseResult: PoseResult | null;
  visible: boolean;
  videoElement?: HTMLVideoElement | null;
}

const UPPER_COLOR = "#22c55e";
const LOWER_COLOR = "#3b82f6";
const JOINT_COLOR = "#ffffff";
const ANGLE_LABEL_COLOR = "#fbbf24";
const MIN_VISIBILITY = 0.5;

const KEY_ANGLE_JOINTS: { index: number; label: string; key: keyof PoseResult["jointAngles"] }[] = [
  { index: 13, label: "L Elbow", key: "leftElbow" },
  { index: 14, label: "R Elbow", key: "rightElbow" },
  { index: 23, label: "L Hip", key: "leftHip" },
  { index: 24, label: "R Hip", key: "rightHip" },
  { index: 25, label: "L Knee", key: "leftKnee" },
  { index: 26, label: "R Knee", key: "rightKnee" },
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

export default function PoseOverlay({ poseResult, visible, videoElement }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        setCanvasSize({ width: w, height: h });
        if (canvasRef.current) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!poseResult || !visible) return;

    const lm = poseResult.landmarks;
    if (lm.length < 33) return;

    const { offsetX, offsetY, drawW, drawH } = computeVideoRect(width, height, videoElement);
    const toCanvas = (p: PoseLandmark) => ({ x: offsetX + p.x * drawW, y: offsetY + p.y * drawH });

    for (const [i, j] of SKELETON_CONNECTIONS) {
      const a = lm[i];
      const b = lm[j];
      if ((a.visibility ?? 0) < MIN_VISIBILITY || (b.visibility ?? 0) < MIN_VISIBILITY) continue;

      const pa = toCanvas(a);
      const pb = toCanvas(b);

      const isUpper = UPPER_BODY_INDICES.has(i) && UPPER_BODY_INDICES.has(j);
      ctx.strokeStyle = isUpper ? UPPER_COLOR : LOWER_COLOR;
      ctx.lineWidth = 3;
      ctx.shadowColor = isUpper ? UPPER_COLOR : LOWER_COLOR;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    for (let i = 11; i < 33; i++) {
      const p = lm[i];
      if ((p.visibility ?? 0) < MIN_VISIBILITY) continue;
      const cp = toCanvas(p);
      ctx.fillStyle = JOINT_COLOR;
      ctx.shadowColor = JOINT_COLOR;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "left";
    for (const { index, label, key } of KEY_ANGLE_JOINTS) {
      const p = lm[index];
      if ((p.visibility ?? 0) < MIN_VISIBILITY) continue;
      const cp = toCanvas(p);
      const angle = poseResult.jointAngles[key];

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const text = `${angle}°`;
      const metrics = ctx.measureText(text);
      const pad = 3;
      ctx.fillRect(cp.x + 8, cp.y - 10, metrics.width + pad * 2, 16);

      ctx.fillStyle = ANGLE_LABEL_COLOR;
      ctx.fillText(text, cp.x + 8 + pad, cp.y + 2);
    }
  }, [poseResult, visible, videoElement, canvasSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!visible) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 z-15 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={sizeRef.current.width}
        height={sizeRef.current.height}
        className="w-full h-full"
      />
    </div>
  );
}
