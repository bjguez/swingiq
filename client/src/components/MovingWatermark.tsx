import { useState, useEffect } from "react";

const POSITIONS: React.CSSProperties[] = [
  { top: "8%",  left: "4%"  },
  { top: "8%",  right: "4%" },
  { bottom: "14%", left: "4%"  },
  { bottom: "14%", right: "4%" },
];

export function MovingWatermark() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * 4));

  useEffect(() => {
    const next = () => setIdx(i => (i + 1) % 4);
    // randomise interval 3.5–5s so it doesn't feel robotic
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => { t = setTimeout(() => { next(); schedule(); }, 3500 + Math.random() * 1500); };
    schedule();
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="absolute pointer-events-none select-none z-10 transition-all duration-700 ease-in-out"
      style={POSITIONS[idx]}
    >
      <span className="text-white/25 text-[10px] font-bold tracking-widest drop-shadow-sm">
        swingstudio.ai
      </span>
    </div>
  );
}
