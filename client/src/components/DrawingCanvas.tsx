import { useRef, useState, useEffect, useCallback } from "react";

type Tool = "select" | "pen" | "line" | "circle" | "rect" | "text" | "angle";
type DrawAction = {
  type: Tool;
  color: string;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  mid?: { x: number; y: number };
  text?: string;
};

interface DrawingCanvasProps {
  tool: Tool;
  color: string;
  annotations: DrawAction[];
  onAnnotationsChange: (annotations: DrawAction[]) => void;
}

export default function DrawingCanvas({ tool, color, annotations, onAnnotationsChange }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });
  const [angleStep, setAngleStep] = useState<number>(0);
  const [anglePoints, setAnglePoints] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setAngleStep(0);
    setAnglePoints([]);
    setCurrentAction(null);
    setIsDrawing(false);
  }, [tool]);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  function calcAngleDeg(vertex: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let angle = Math.abs(a1 - a2) * (180 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return Math.round(angle);
  }

  function drawArrowhead(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, size: number) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allActions = currentAction ? [...annotations, currentAction] : annotations;

    for (const action of allActions) {
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (action.type) {
        case "pen":
          if (action.points && action.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(action.points[0].x, action.points[0].y);
            for (let i = 1; i < action.points.length; i++) {
              ctx.lineTo(action.points[i].x, action.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case "line":
          if (action.start && action.end) {
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
            drawArrowhead(ctx, action.start, action.end, 10);
          }
          break;

        case "angle":
          if (action.points && action.points.length >= 2) {
            const vertex = action.points[0];
            const p1 = action.points[1];

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(vertex.x, vertex.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(vertex.x, vertex.y, 4, 0, Math.PI * 2);
            ctx.fill();

            if (action.points.length >= 3) {
              const p2 = action.points[2];
              ctx.beginPath();
              ctx.moveTo(vertex.x, vertex.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();

              const deg = calcAngleDeg(vertex, p1, p2);

              const arcRadius = 25;
              const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
              const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
              let startAngle = a1;
              let endAngle = a2;
              let diff = endAngle - startAngle;
              if (diff > Math.PI) { startAngle += 2 * Math.PI; }
              else if (diff < -Math.PI) { endAngle += 2 * Math.PI; }
              ctx.beginPath();
              ctx.arc(vertex.x, vertex.y, arcRadius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
              ctx.stroke();

              const midAngle = (startAngle + endAngle) / 2;
              const labelX = vertex.x + (arcRadius + 14) * Math.cos(midAngle);
              const labelY = vertex.y + (arcRadius + 14) * Math.sin(midAngle);
              ctx.font = "bold 13px monospace";
              ctx.fillStyle = action.color;

              const bgWidth = ctx.measureText(`${deg}°`).width + 8;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(labelX - bgWidth / 2, labelY - 8, bgWidth, 18);
              ctx.fillStyle = action.color;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(`${deg}°`, labelX, labelY);
              ctx.textAlign = "start";
              ctx.textBaseline = "alphabetic";
            }
          }
          break;

        case "circle":
          if (action.start && action.end) {
            const dx = action.end.x - action.start.x;
            const dy = action.end.y - action.start.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            ctx.beginPath();
            ctx.arc(action.start.x, action.start.y, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;

        case "rect":
          if (action.start && action.end) {
            const w = action.end.x - action.start.x;
            const h = action.end.y - action.start.y;
            ctx.strokeRect(action.start.x, action.start.y, w, h);
          }
          break;

        case "text":
          if (action.start && action.text) {
            ctx.font = "14px sans-serif";
            ctx.fillText(action.text, action.start.x, action.start.y);
          }
          break;
      }
    }

    if (tool === "angle" && anglePoints.length > 0 && anglePoints.length < 3) {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.arc(anglePoints[0].x, anglePoints[0].y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (anglePoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(anglePoints[1].x, anglePoints[1].y);
        ctx.lineTo(anglePoints[0].x, anglePoints[0].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [annotations, currentAction, anglePoints, tool, color]);

  useEffect(() => {
    redraw();
  }, [redraw, canvasSize]);

  const isInteractive = tool !== "select";

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isInteractive) return;
    const pos = getPos(e);

    if (tool === "text") {
      const text = prompt("Enter text annotation:");
      if (text) {
        const newAction: DrawAction = { type: "text", color, start: pos, text };
        onAnnotationsChange([...annotations, newAction]);
      }
      return;
    }

    if (tool === "angle") {
      const newPoints = [...anglePoints, pos];
      setAnglePoints(newPoints);

      if (newPoints.length === 3) {
        const action: DrawAction = {
          type: "angle",
          color,
          points: newPoints,
        };
        onAnnotationsChange([...annotations, action]);
        setAnglePoints([]);
        setAngleStep(0);
      } else {
        setAngleStep(newPoints.length);
      }
      return;
    }

    setIsDrawing(true);

    if (tool === "pen") {
      setCurrentAction({ type: "pen", color, points: [pos] });
    } else if (tool === "line") {
      setCurrentAction({ type: "line", color, start: pos, end: pos });
    } else {
      setCurrentAction({ type: tool, color, start: pos, end: pos });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction) return;
    const pos = getPos(e);

    if (tool === "pen" && currentAction.points) {
      setCurrentAction({
        ...currentAction,
        points: [...currentAction.points, pos],
      });
    } else if (tool !== "pen") {
      setCurrentAction({
        ...currentAction,
        end: pos,
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    onAnnotationsChange([...annotations, currentAction]);
    setCurrentAction(null);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-20" style={{ pointerEvents: isInteractive ? "auto" : "none" }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="w-full h-full"
        style={{ cursor: isInteractive ? "crosshair" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

export type { Tool, DrawAction };