import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Video, Brain, Users, BookOpen, Dna, ChevronRight,
  Trophy, TrendingUp, Calendar, MapPin, Zap,
} from "lucide-react";
import type { CognitionSession } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type VideoRow = {
  id: string; title: string; category: string; createdAt: string;
  sourceUrl: string | null; thumbnailUrl: string | null; isProVideo: boolean;
};

type CoachSession = {
  id: string; notes: string | null; sharedAt: string | null; createdAt: string;
  voiceoverUrl: string | null;
  coachFirstName: string | null; coachLastName: string | null; coachUsername: string;
  coachOrganization: string | null;
};

type Comp = {
  id: string; compType: string; rank: number | null;
  player: { name: string; team: string; savantId: string | null; bats: string };
};

type FocusPhase = string;

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  foundation: "Foundation", gather: "Gather", lag: "Lag",
  on_plane: "On Plane", contact: "Contact", finish: "Finish",
};

const PHASE_COLORS: Record<string, string> = {
  foundation: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  gather:     "bg-purple-500/15 text-purple-400 border-purple-500/20",
  lag:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
  on_plane:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  contact:    "bg-green-500/15 text-green-400 border-green-500/20",
  finish:     "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

const TIER_LABELS: Record<string, { label: string; cls: string }> = {
  free:   { label: "Free",   cls: "bg-secondary text-muted-foreground" },
  rookie: { label: "Rookie", cls: "bg-secondary text-muted-foreground" },
  player: { label: "Player", cls: "bg-blue-500/15 text-blue-400" },
  pro:    { label: "Pro",    cls: "bg-primary/15 text-primary" },
  coach:  { label: "Coach",  cls: "bg-purple-500/15 text-purple-400" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, onClick }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-xl p-4 flex flex-col gap-1 ${onClick ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
        {icon}{label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionHeader({ icon, title, href }: { icon: React.ReactNode; title: string; href?: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        {icon}{title}
      </h2>
      {href && (
        <button
          onClick={() => navigate(href)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          View all <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  usePageMeta({ title: "Dashboard", description: "Your personal Swing Studio dashboard.", path: "/dashboard" });
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: videos = [] } = useQuery<VideoRow[]>({
    queryKey: ["/api/videos"],
    queryFn: () => fetch("/api/videos").then(r => r.json()),
    enabled: !!user,
  });

  const { data: cognitionSessions = [] } = useQuery<CognitionSession[]>({
    queryKey: ["/api/cognition/sessions"],
    queryFn: () => fetch("/api/cognition/sessions").then(r => r.json()),
    enabled: !!user,
  });

  const { data: coachSessions = [] } = useQuery<CoachSession[]>({
    queryKey: ["/api/coaching/sessions/received"],
    queryFn: () => fetch("/api/coaching/sessions/received").then(r => r.json()),
    enabled: !!user,
  });

  const { data: focusPhases = [] } = useQuery<FocusPhase[]>({
    queryKey: ["/api/blueprint/focus"],
    queryFn: () => fetch("/api/blueprint/focus").then(r => r.json()),
    enabled: !!user,
  });

  const { data: comps = [] } = useQuery<Comp[]>({
    queryKey: ["/api/biometrics/comps"],
    queryFn: () => fetch("/api/biometrics/comps").then(r => r.json()),
    enabled: !!user,
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const mySwings = useMemo(
    () => videos.filter(v => !v.isProVideo).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [videos]
  );

  const cognitionChartData = useMemo(
    () => [...cognitionSessions].reverse().slice(-10).map((s, i) => ({
      round: i + 1,
      threshold: Number(s.threshold).toFixed(2),
      accuracy: s.accuracy,
    })),
    [cognitionSessions]
  );

  const bestCognition = useMemo(
    () => cognitionSessions.reduce<CognitionSession | null>((best, s) =>
      !best || Number(s.threshold) > Number(best.threshold) ? s : best, null
    ),
    [cognitionSessions]
  );

  const latestCognition = cognitionSessions[0] ?? null;
  const autoComps = comps.filter(c => c.compType === "auto").sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const tierInfo = TIER_LABELS[user?.subscriptionTier ?? "free"] ?? TIER_LABELS.free;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";
  const location = [user?.city, user?.state].filter(Boolean).join(", ");

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-0 md:px-4 py-6 space-y-8">

        {/* ── Hero ── */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xl font-bold text-primary uppercase">
            {displayName[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold font-display uppercase truncate">{displayName}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tierInfo.cls}`}>
                {tierInfo.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {user.username && <span>@{user.username}</span>}
              {user.skillLevel && <span className="capitalize">{user.skillLevel.replace(/_/g, " ")}</span>}
              {user.bats && <span>Bats {user.bats}</span>}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stat row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Video className="w-3.5 h-3.5" />}
            label="Swings"
            value={mySwings.length}
            sub="uploaded"
            onClick={() => navigate("/my-swings")}
          />
          <StatCard
            icon={<Brain className="w-3.5 h-3.5" />}
            label="Cognition"
            value={cognitionSessions.length}
            sub={latestCognition ? `Last: ${Number(latestCognition.threshold).toFixed(2)} u/s` : "No sessions yet"}
            onClick={() => navigate("/cognition")}
          />
          <StatCard
            icon={<Users className="w-3.5 h-3.5" />}
            label="Coaching"
            value={coachSessions.length}
            sub="sessions received"
            onClick={() => navigate("/development")}
          />
          <StatCard
            icon={<BookOpen className="w-3.5 h-3.5" />}
            label="Blueprint"
            value={focusPhases.length}
            sub={focusPhases.length > 0 ? "active phases" : "No phases active"}
            onClick={() => navigate("/development")}
          />
        </div>

        {/* ── Cognition trend ── */}
        {cognitionSessions.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <SectionHeader icon={<Brain className="w-3.5 h-3.5" />} title="Cognition" href="/cognition" />
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Latest</p>
                <p className="text-xl font-bold text-primary">{Number(latestCognition?.threshold).toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">u/s threshold</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Personal Best</p>
                <p className="text-xl font-bold text-yellow-400 flex items-center gap-1">
                  <Trophy className="w-4 h-4" />{Number(bestCognition?.threshold).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">u/s threshold</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Latest Accuracy</p>
                <p className="text-xl font-bold text-green-400">{latestCognition?.accuracy}%</p>
                <p className="text-[10px] text-muted-foreground">{latestCognition?.correctRounds}/{latestCognition?.totalRounds} rounds</p>
              </div>
            </div>
            {cognitionChartData.length > 1 && (
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={cognitionChartData}>
                  <XAxis dataKey="round" tick={false} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`${v} u/s`, "Threshold"]}
                    labelFormatter={(l) => `Session ${l}`}
                  />
                  <Line
                    type="monotone" dataKey="threshold" stroke="hsl(var(--primary))"
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            {latestCognition?.completedAt && (
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Last session {new Date(latestCognition.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* ── Recent swings ── */}
        {mySwings.length > 0 && (
          <div>
            <SectionHeader icon={<Video className="w-3.5 h-3.5" />} title="Recent Swings" href="/my-swings" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mySwings.slice(0, 3).map(v => (
                <div
                  key={v.id}
                  onClick={() => navigate("/my-swings")}
                  className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-video bg-secondary/50 flex items-center justify-center">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground capitalize">{v.category}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Coaching sessions ── */}
        {coachSessions.length > 0 && (
          <div>
            <SectionHeader icon={<Users className="w-3.5 h-3.5" />} title="Recent Coaching" href="/development" />
            <div className="space-y-2">
              {coachSessions.slice(0, 3).map(s => {
                const coachName = [s.coachFirstName, s.coachLastName].filter(Boolean).join(" ") || s.coachUsername;
                const date = s.sharedAt ?? s.createdAt;
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate("/development")}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        From <span className="text-primary">{coachName}</span>
                        {s.coachOrganization && <span className="text-muted-foreground text-xs ml-1">· {s.coachOrganization}</span>}
                      </p>
                      {s.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Blueprint phases ── */}
        {focusPhases.length > 0 && (
          <div>
            <SectionHeader icon={<BookOpen className="w-3.5 h-3.5" />} title="Blueprint Focus" href="/development" />
            <div className="flex flex-wrap gap-2">
              {focusPhases.map(phase => (
                <span
                  key={phase}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${PHASE_COLORS[phase] ?? "bg-secondary text-muted-foreground border-border"}`}
                >
                  {PHASE_LABELS[phase] ?? phase}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── MLB comps ── */}
        {autoComps.length > 0 && (
          <div>
            <SectionHeader icon={<Dna className="w-3.5 h-3.5" />} title="Your MLB Comps" href="/biometrics" />
            <div className="flex gap-3 overflow-x-auto pb-1">
              {autoComps.map((comp, i) => (
                <div
                  key={comp.id}
                  onClick={() => navigate("/biometrics")}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shrink-0 cursor-pointer hover:border-primary/40 transition-colors min-w-[180px]"
                >
                  {comp.player.savantId ? (
                    <img
                      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_60,q_auto:good/v1/people/${comp.player.savantId}/headshot/67/current`}
                      alt={comp.player.name}
                      className="w-10 h-10 rounded-full object-cover bg-secondary/50 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {comp.player.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && <Trophy className="w-3 h-3 text-yellow-400 shrink-0" />}
                      <p className="text-sm font-semibold truncate">{comp.player.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{comp.player.team}</p>
                    <p className="text-[10px] text-muted-foreground">Bats {comp.player.bats}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {mySwings.length === 0 && coachSessions.length === 0 && cognitionSessions.length === 0 && (
          <div className="border border-border rounded-xl p-10 text-center space-y-3">
            <Zap className="w-8 h-8 text-primary/40 mx-auto" />
            <p className="text-sm font-semibold">Your dashboard is empty</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Upload a swing, complete a cognition session, or get coached to start building your profile.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => navigate("/")}
                className="text-xs text-primary hover:underline"
              >Upload a swing</button>
              <span className="text-muted-foreground">·</span>
              <button
                onClick={() => navigate("/cognition")}
                className="text-xs text-primary hover:underline"
              >Play Cognition</button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
