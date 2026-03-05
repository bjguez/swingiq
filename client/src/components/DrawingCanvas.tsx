import { useRef, useState, useEffect, useCallback } from "react";

type Tool = "select" | "pen" | "circle" | "rect" | "text";
type DrawAction = {
  type: Tool;
  color: string;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
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

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

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

        case "circle":
          if (action.start && action.end) {
            const dx = action.end.x - action.start.x;
            const dy = action.end.y - action.start.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            ctx.beginPath();
            ctx.arc(action.start.x, action.start.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            const angle = Math.round(Math.atan2(dy, dx) * (180 / Math.PI));
            ctx.font = "12px monospace";
            ctx.fillText(`${Math.abs(angle)}°`, action.start.x + 5, action.start.y - 5);
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
  }, [annotations, currentAction]);

  useEffect(() => {
    redraw();
  }, [redraw, canvasSize]);

  const isInteractive = tool !== "select";

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isInteractive) return;
    const pos = getPos(e);
    setIsDrawing(true);

    if (tool === "text") {
      const text = prompt("Enter text annotation:");
      if (text) {
        const newAction: DrawAction = { type: "text", color, start: pos, text };
        onAnnotationsChange([...annotations, newAction]);
      }
      setIsDrawing(false);
      return;
    }

    if (tool === "pen") {
      setCurrentAction({ type: "pen", color, points: [pos] });
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