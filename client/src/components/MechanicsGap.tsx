import type { JointAngles, SwingPhase } from "@/lib/poseDetector";

const ANGLE_ROWS: { key: keyof JointAngles; label: string }[] = [
  { key: "rightElbow",       label: "Right Elbow" },
  { key: "leftElbow",        label: "Left Elbow" },
  { key: "rightShoulder",    label: "Right Shoulder" },
  { key: "leftShoulder",     label: "Left Shoulder" },
  { key: "trunkAngle",       label: "Trunk Angle" },
  { key: "shoulderRotation", label: "Shoulder Rotation" },
  { key: "rightHip",         label: "Right Hip" },
  { key: "leftHip",          label: "Left Hip" },
  { key: "rightKnee",        label: "Right Knee" },
  { key: "leftKnee",         label: "Left Knee" },
];

function gapColor(delta: number) {
  const abs = Math.abs(delta);
  if (abs <= 5)  return "text-green-400";
  if (abs <= 15) return "text-yellow-400";
  return "text-red-400";
}

function gapBg(delta: number) {
  const abs = Math.abs(delta);
  if (abs <= 5)  return "bg-green-500/10";
  if (abs <= 15) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

export function MechanicsGap({
  playerAngles,
  compAngles,
  playerPhase,
  compName,
}: {
  playerAngles: JointAngles | null;
  compAngles: JointAngles | null;
  playerPhase: SwingPhase;
  compName: string;
}) {
  if (!playerAngles || !compAngles) {
    return (
      <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground space-y-2">
        <p className="font-semibold">Enable pose detection on both videos</p>
        <p className="text-xs">Hit play on both videos, then toggle Pose Detection to see your mechanics gap vs {compName}.</p>
      </div>
    );
  }

  const rows = ANGLE_ROWS.map(({ key, label }) => {
    const mine = playerAngles[key];
    const comp = compAngles[key];
    const delta = mine - comp;
    return { key, label, mine, comp, delta };
  });

  const topGaps = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  const compFirst = compName.split(" ")[0];

  return (
    <div className="space-y-4">
      {/* Phase indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Phase detected: <span className="text-foreground font-semibold">{playerPhase}</span></span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-400 inline-block rounded" />Your pose</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" />{compFirst}</span>
        </span>
      </div>

      {/* Top focus areas */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Top Focus Areas vs {compName}
        </h4>
        <div className="space-y-2.5">
          {topGaps.map((r, i) => (
            <div key={r.key} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${gapBg(r.delta)}`}>
              <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
              <span className="text-sm flex-1 font-semibold">{r.label}</span>
              <span className="text-xs text-muted-foreground">
                You <span className="text-foreground font-mono">{r.mine}°</span> → {compFirst} <span className="text-foreground font-mono">{r.comp}°</span>
              </span>
              <span className={`text-xs font-bold font-mono w-12 text-right ${gapColor(r.delta)}`}>
                {r.delta > 0 ? "+" : ""}{r.delta}°
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Full delta table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="bg-secondary/50 px-4 py-2 grid grid-cols-12 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-4">Joint</div>
          <div className="col-span-3 text-center">You</div>
          <div className="col-span-3 text-center">{compFirst}</div>
          <div className="col-span-2 text-right">Gap</div>
        </div>
        <div className="divide-y divide-border/50">
          {rows.map(r => (
            <div key={r.key} className="px-4 py-2 grid grid-cols-12 items-center text-sm hover:bg-secondary/20">
              <div className="col-span-4 text-muted-foreground text-xs">{r.label}</div>
              <div className="col-span-3 text-center font-mono font-semibold">{r.mine}°</div>
              <div className="col-span-3 text-center font-mono text-muted-foreground">{r.comp}°</div>
              <div className={`col-span-2 text-right font-mono font-bold text-xs ${gapColor(r.delta)}`}>
                {r.delta > 0 ? "+" : ""}{r.delta}°
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />≤5° On track</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />5–15° Work on it</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />&gt;15° Focus here</span>
      </div>
    </div>
  );
}
