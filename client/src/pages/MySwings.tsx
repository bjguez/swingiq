import { useState, useMemo, useCallback } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchVideos, deleteVideo } from "@/lib/api";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { UserVideoCard } from "@/components/UserVideoCard";
import {
  Trash2, Upload, Film, Search, Brain, BookOpen, Dna, Users,
  ChevronRight, Trophy, Lock, Star, MapPin, Eye, Target, Sparkles, Copy, Gift, Check,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer,
} from "recharts";
import type { Video, CognitionSession, DisciplineSession, ConfidenceSession } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";

// ── Types ─────────────────────────────────────────────────────────────────────

type Comp = {
  id: string; compType: string; rank: number | null;
  player: { name: string; team: string; savantId: string | null; bats: string };
};

type CoachSession = {
  id: string; notes: string | null; sharedAt: string | null; createdAt: string;
  coachFirstName: string | null; coachLastName: string | null; coachUsername: string;
  coachOrganization: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function SectionDivider({ icon, title, href, onNavigate }: {
  icon: React.ReactNode; title: string; href?: string; onNavigate?: (href: string) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <h2 className="text-lg font-bold font-display uppercase flex items-center gap-2">
        {icon}{title}
      </h2>
      {href && onNavigate && (
        <button
          onClick={() => onNavigate(href)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          View all <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ActivityCalendar({
  cognitionDates,
  acuityDates,
  disciplineDates,
  confidenceDates,
}: {
  cognitionDates: string[];
  acuityDates: string[];
  disciplineDates: string[];
  confidenceDates: string[];
}) {
  const WEEKS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activityMap = new Map<string, { cognition: boolean; acuity: boolean; discipline: boolean; confidence: boolean }>();
  function mark(raw: string, module: "cognition" | "acuity" | "discipline" | "confidence") {
    const key = new Date(raw).toDateString();
    const prev = activityMap.get(key) ?? { cognition: false, acuity: false, discipline: false, confidence: false };
    activityMap.set(key, { ...prev, [module]: true });
  }
  cognitionDates.forEach(d => mark(d, "cognition"));
  acuityDates.forEach(d => mark(d, "acuity"));
  disciplineDates.forEach(d => mark(d, "discipline"));
  confidenceDates.forEach(d => mark(d, "confidence"));

  // Build weeks grid (Mon → Sun, oldest → newest)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - WEEKS * 7 + 1);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks: Date[][] = [];
  const cursor = new Date(startDate);
  while (weeks.length < WEEKS) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels = weeks.map((week, i) => {
    if (i === 0) return week[0].toLocaleDateString("en-US", { month: "short" });
    const firstOfMonth = week.find(d => d.getDate() === 1);
    return firstOfMonth ? firstOfMonth.toLocaleDateString("en-US", { month: "short" }) : null;
  });

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="overflow-x-auto pb-1">
      <div className="space-y-2 w-fit mx-auto">
        {/* Month labels */}
        <div className="flex gap-1.5 sm:gap-2 md:gap-2.5 pl-7 sm:pl-8 md:pl-10">
          {weeks.map((_, i) => (
            <div key={i} className="w-3.5 sm:w-5 md:w-6 shrink-0 text-[10px] sm:text-xs text-muted-foreground text-center">
              {monthLabels[i] ?? ""}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 sm:gap-2 md:gap-2.5">
          {/* Day labels */}
          <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-2.5">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="w-5 sm:w-6 md:w-8 h-3.5 sm:h-5 md:h-6 text-[10px] sm:text-xs text-muted-foreground flex items-center justify-end pr-1">
                {label}
              </div>
            ))}
          </div>
          {/* Cells */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1.5 sm:gap-2 md:gap-2.5">
              {week.map((day, di) => {
                const isFuture = day > today;
                const activity = activityMap.get(day.toDateString());
                const modules = activity
                  ? (["cognition", "acuity", "discipline", "confidence"] as const).filter(m => activity[m])
                  : [];
                const count = modules.length;
                const MODULE_LABELS: Record<string, string> = {
                  cognition: "Cognition", acuity: "Visual Acuity",
                  discipline: "Discipline", confidence: "Confidence",
                };
                const tooltip = isFuture ? "" : [
                  day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  count > 0 ? modules.map(m => MODULE_LABELS[m]).join(", ") : "No activity",
                ].join(" · ");

                return (
                  <div
                    key={di}
                    title={tooltip}
                    className={`w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0 rounded-sm ${
                      isFuture ? "opacity-0" :
                      count === 0 ? "bg-muted/40" :
                      count === 1 ? "bg-primary/30" :
                      count === 2 ? "bg-primary/55" :
                      count === 3 ? "bg-primary/80" :
                      "bg-primary"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 pl-7 sm:pl-8 md:pl-10 text-[10px] sm:text-xs text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(n => (
            <div key={n} className={`w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-sm shrink-0 ${
              n === 0 ? "bg-muted/40" : n === 1 ? "bg-primary/30" : n === 2 ? "bg-primary/55" : n === 3 ? "bg-primary/80" : "bg-primary"
            }`} />
          ))}
          <span>More</span>
          <span className="ml-3 text-muted-foreground/50">· modules completed per day</span>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MySwings() {
  usePageMeta({ title: "My Studio", description: "Your swing library, training plan, and player hub.", path: "/my-studio" });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const isPaid = user?.isAdmin || ["player", "pro", "coach"].includes(user?.subscriptionTier ?? "");
  const isFree = !!user && !isPaid;
  const tierInfo = TIER_LABELS[user?.subscriptionTier ?? "free"] ?? TIER_LABELS.free;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";
  const location = [user?.city, user?.state].filter(Boolean).join(", ");

  // ── Video data ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
    enabled: !!user,
  });

  const userVideos = useMemo(
    () => (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl),
    [allVideos]
  );

  const filteredVideos = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return userVideos.filter(v =>
      !q ||
      v.title.toLowerCase().includes(q) ||
      ((v as any).notes?.toLowerCase().includes(q)) ||
      ((v as any).tags?.some((t: string) => t.toLowerCase().includes(q)))
    );
  }, [userVideos, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filteredVideos.map(v => v.id)));
  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setDeleting(new Set(ids));
    await Promise.allSettled(ids.map(id => deleteVideo(id)));
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    setSelected(new Set());
    setDeleting(new Set());
  };

  // ── Dashboard data ─────────────────────────────────────────────────────────

  const { data: sessionsData } = useQuery({
    queryKey: ["/api/cognition/sessions"],
    queryFn: () => fetch("/api/cognition/sessions").then(r => r.json()),
    enabled: !!user,
  });
  const cognitionSessions: CognitionSession[] = Array.isArray(sessionsData) ? sessionsData : [];
  const freeSessionCount: number = (!Array.isArray(sessionsData) && sessionsData?.freeSessionCount) ?? 0;
  const FREE_COGNITION_LIMIT = 3;

  const { data: focusPhases = [] } = useQuery<string[]>({
    queryKey: ["/api/blueprint/focus"],
    queryFn: () => fetch("/api/blueprint/focus").then(r => r.json()),
    enabled: !!user,
  });

  const { data: comps = [] } = useQuery<Comp[]>({
    queryKey: ["/api/biometrics/comps"],
    queryFn: () => fetch("/api/biometrics/comps").then(r => r.json()),
    enabled: !!user && isPaid,
  });

  const { data: acuityData } = useQuery({
    queryKey: ["/api/acuity/completions"],
    queryFn: () => fetch("/api/acuity/completions").then(r => r.json()),
    enabled: !!user,
  });
  const acuityCompletions: any[] = Array.isArray(acuityData?.completions) ? acuityData.completions : [];
  const acuityFreeCount: number = acuityData?.freeCompletionCount ?? 0;
  const ACUITY_FREE_LIMIT = 3;

  const ACUITY_EXERCISES = [
    { id: "pursuit",          label: "Ball Pursuit",      free: true },
    { id: "peripheral_lock",  label: "Peripheral Lock",   free: false },
    { id: "peripheral_flash", label: "Peripheral Flash",  free: false },
    { id: "ghost_ball",       label: "Ghost Ball",        free: false },
    { id: "color_filter",     label: "Color Filter",      free: false },
  ];

  const { data: disciplineHistory = [] } = useQuery<DisciplineSession[]>({
    queryKey: ["/api/discipline/sessions"],
    queryFn: () => fetch("/api/discipline/sessions", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });
  const latestDiscipline = disciplineHistory[0] ?? null;

  const disciplineChartData = useMemo(
    () => [...disciplineHistory].reverse().slice(-10).map((s, i) => ({
      session: i + 1,
      discipline: s.disciplinePct,
      chase: s.chaseRate,
    })),
    [disciplineHistory]
  );

  const { data: coachSessions = [] } = useQuery<CoachSession[]>({
    queryKey: ["/api/coaching/sessions/received"],
    queryFn: () => fetch("/api/coaching/sessions/received").then(r => r.json()),
    enabled: !!user && isPaid,
  });

  const cognitionChartData = useMemo(
    () => [...cognitionSessions].reverse().slice(-10).map((s, i) => ({
      round: i + 1,
      threshold: Number(s.threshold).toFixed(2),
    })),
    [cognitionSessions]
  );

  const bestCognition = useMemo(
    () => cognitionSessions.reduce<CognitionSession | null>((best, s) =>
      !best || Number(s.threshold) > Number(best.threshold) ? s : best, null),
    [cognitionSessions]
  );

  const { data: confidenceData } = useQuery({
    queryKey: ["/api/confidence/sessions"],
    queryFn: () => fetch("/api/confidence/sessions").then(r => r.json()),
    enabled: !!user,
  });
  const confidenceSessions: ConfidenceSession[] = Array.isArray(confidenceData) ? confidenceData : [];
  const freeConfidenceCount: number = (!Array.isArray(confidenceData) && (confidenceData as any)?.freeSessionCount) ?? 0;
  const FREE_CONFIDENCE_LIMIT = 3;

  const confidenceStreak = useMemo(() => {
    if (!confidenceSessions.length) return 0;
    const days = new Set(confidenceSessions.map(s => new Date(s.completedAt!).toDateString()));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [confidenceSessions]);

  const { data: badgesData } = useQuery({
    queryKey: ["/api/badges"],
    queryFn: () => fetch("/api/badges").then(r => r.json()),
    enabled: !!user,
  });
  const earnedBadgeIds = new Set<string>((badgesData?.earned ?? []).map((b: any) => b.badgeId));
  const badgeEarnedAt = new Map<string, string>((badgesData?.earned ?? []).map((b: any) => [b.badgeId, b.earnedAt]));
  const allBadgeDefs: { id: string; name: string; description: string; category: string }[] = badgesData?.definitions ?? [];

  const { data: streakData } = useQuery({
    queryKey: ["/api/streak"],
    queryFn: () => fetch("/api/streak").then(r => r.json()),
    enabled: !!user,
  });
  const combinedStreak: number = streakData?.streak ?? 0;

  const { data: referralData } = useQuery({
    queryKey: ["/api/referral"],
    queryFn: () => fetch("/api/referral").then(r => r.json()),
    enabled: !!user,
  });

  const latestCognition = cognitionSessions[0] ?? null;
  const autoComps = comps.filter(c => c.compType === "auto").sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  if (!user) return null;

  return (
    <Layout>

      {/* ── Player identity row ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary uppercase">
          {displayName[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-base truncate">{displayName}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tierInfo.cls}`}>{tierInfo.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {user.username && <span>@{user.username}</span>}
            {user.skillLevel && <span className="capitalize">{user.skillLevel.replace(/_/g, " ")}</span>}
            {user.bats && <span>Bats {user.bats}</span>}
            {location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{location}</span>}
            {combinedStreak > 0 && (
              <span className="flex items-center gap-0.5 text-orange-400 font-semibold">
                <Sparkles className="w-3 h-3" />{combinedStreak}-day streak
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── My Swings header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">My Library</span>
            <span className="text-sm text-muted-foreground">{userVideos.length} swing{userVideos.length !== 1 ? "s" : ""}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">My Studio</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {userVideos.length > 0 && (
            <Button variant="outline" size="sm" className="border-border"
              onClick={() => { setBulkMode(b => !b); clearSelection(); }}>
              {bulkMode ? "Cancel" : "Manage"}
            </Button>
          )}
          {bulkMode && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting.size > 0}>
              <Trash2 className="w-4 h-4 mr-2" />Delete {selected.size} selected
            </Button>
          )}
          {bulkMode && (
            <Button variant="ghost" size="sm" onClick={selected.size === userVideos.length ? clearSelection : selectAll}>
              {selected.size === userVideos.length ? "Deselect All" : "Select All"}
            </Button>
          )}
          <VideoLibraryModal mode="user" trigger={
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              <Upload className="w-4 h-4 mr-2" />Upload Swing
            </Button>
          } />
        </div>
      </div>

      {/* Search */}
      {userVideos.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, notes, tags…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Video grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-secondary" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : userVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-semibold text-lg">No swings uploaded yet</p>
            <p className="text-muted-foreground text-sm mt-1">Upload a swing from the Analysis page or use the button above.</p>
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <p className="text-muted-foreground text-sm">No swings match your search.</p>
          <button onClick={() => setSearchQuery("")} className="text-xs text-primary hover:underline">Clear search</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bulkMode && (
            <div className="col-span-full text-sm text-muted-foreground">
              {selected.size} of {filteredVideos.length} selected
            </div>
          )}
          {filteredVideos.map((video: Video) => (
            <UserVideoCard
              key={video.id}
              video={video}
              bulkMode={bulkMode}
              selected={selected.has(video.id)}
              onToggleSelect={toggleSelect}
              onSelect={(v) => navigate(`/?videoId=${v.id}`)}
              showDelete showTrim
              playLabel="Analyze"
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── Development Blueprint ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<BookOpen className="w-3.5 h-3.5" />}
          title="Development Blueprint"
          href="/development"
          onNavigate={navigate}
        />

        {focusPhases.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Star className="w-3 h-3 text-primary" />Currently working on:
            </p>
            <div className="flex flex-wrap gap-2">
              {focusPhases.map(p => (
                <span
                  key={p}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${PHASE_COLORS[p] ?? "bg-secondary text-muted-foreground border-border"}`}
                >
                  {PHASE_LABELS[p] ?? p}
                </span>
              ))}
            </div>
            <button onClick={() => navigate("/development")} className="text-xs text-primary hover:underline">
              Open Blueprint →
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-1">Build your development plan</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                A phase-by-phase hitting curriculum — Foundation, Gather, Lag, On Plane, Contact, Finish.
                {isFree && " Foundation is free. Upgrade to unlock all phases."}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/development")} variant="outline">
              Open Blueprint
            </Button>
          </div>
        )}
      </div>

      {/* ── Training Activity Calendar ── */}
      {isPaid && (cognitionSessions.length > 0 || disciplineHistory.length > 0 || acuityCompletions.length > 0 || confidenceSessions.length > 0) && (
        <div className="border-t border-border pt-6 space-y-4">
          <SectionDivider
            icon={<Sparkles className="w-3.5 h-3.5" />}
            title="Training Activity"
          />
          <ActivityCalendar
            cognitionDates={cognitionSessions.map(s => s.completedAt as unknown as string)}
            acuityDates={acuityCompletions.map((s: any) => s.completedAt)}
            disciplineDates={disciplineHistory.map(s => s.completedAt as unknown as string)}
            confidenceDates={confidenceSessions.map(s => s.completedAt as unknown as string)}
          />
        </div>
      )}

      {/* ── Cognition ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<Brain className="w-3.5 h-3.5" />}
          title="Cognition"
          href="/enhance?tab=cognition"
          onNavigate={navigate}
        />

        {cognitionSessions.length > 0 ? (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
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
                <p className="text-xs text-muted-foreground mb-0.5">Accuracy</p>
                <p className="text-xl font-bold text-green-400">{latestCognition?.accuracy}%</p>
                <p className="text-[10px] text-muted-foreground">{latestCognition?.correctRounds}/{latestCognition?.totalRounds} rounds</p>
              </div>
            </div>
            {cognitionChartData.length > 1 && (
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={cognitionChartData}>
                  <XAxis dataKey="round" tick={false} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} hide />
                  <ChartTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`${v} u/s`, "Threshold"]}
                    labelFormatter={(l) => `Session ${l}`}
                  />
                  <Line type="monotone" dataKey="threshold" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : isFree ? (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm mb-1">3D Multiple Object Tracking</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Train the same visual attention skills used by elite hitters. Free plan includes {FREE_COGNITION_LIMIT} sessions — results won't be saved.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sessions used: <span className="font-semibold text-foreground">{freeSessionCount} / {FREE_COGNITION_LIMIT}</span>
                </p>
              </div>
              {freeSessionCount < FREE_COGNITION_LIMIT
                ? <Button size="sm" onClick={() => navigate("/enhance?tab=cognition")}>Try it free</Button>
                : <Button size="sm" onClick={() => navigate("/pricing")}>Upgrade</Button>
              }
            </div>
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Unlock with Player+</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Unlimited sessions</li>
                <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Full history & threshold trend</li>
                <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Track improvement over time</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-1">3D Multiple Object Tracking</p>
              <p className="text-xs text-muted-foreground max-w-sm">Train your visual attention and processing speed the way elite hitters do.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/enhance?tab=cognition")}>Play Now</Button>
          </div>
        )}
      </div>

      {/* ── Visual Acuity ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<Eye className="w-3.5 h-3.5" />}
          title="Visual Acuity"
          href="/enhance?tab=acuity"
          onNavigate={navigate}
        />
        {isPaid ? (
          acuityCompletions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {ACUITY_EXERCISES.map(ex => {
                const exCompletions = acuityCompletions.filter((c: any) => c.exerciseId === ex.id);
                const last = exCompletions[0];
                return (
                  <div
                    key={ex.id}
                    onClick={() => navigate("/enhance?tab=acuity")}
                    className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <p className="text-xs font-semibold truncate">{ex.label}</p>
                    <p className="text-xl font-bold text-primary">{exCompletions.length}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {last
                        ? new Date(last.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "Not started"}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm mb-1">5 eye training exercises</p>
                <p className="text-xs text-muted-foreground">Train ball tracking, peripheral vision, and reaction speed.</p>
              </div>
              <Button size="sm" onClick={() => navigate("/enhance?tab=acuity")}>Start Training</Button>
            </div>
          )
        ) : (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm mb-1">Eye Training Drills</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Ball Pursuit is free. {ACUITY_FREE_LIMIT - acuityFreeCount > 0
                    ? `${ACUITY_FREE_LIMIT - acuityFreeCount} free session${ACUITY_FREE_LIMIT - acuityFreeCount !== 1 ? "s" : ""} remaining.`
                    : "Free limit reached. Upgrade for all 5 exercises."}
                </p>
              </div>
              {acuityFreeCount < ACUITY_FREE_LIMIT
                ? <Button size="sm" onClick={() => navigate("/enhance?tab=acuity")}>Try it free</Button>
                : <Button size="sm" onClick={() => navigate("/pricing")}>Upgrade</Button>
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Discipline ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<Target className="w-3.5 h-3.5" />}
          title="Discipline"
          href="/enhance?tab=discipline"
          onNavigate={navigate}
        />
        {latestDiscipline ? (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Discipline</p>
                <p className="text-xl font-bold text-primary">{latestDiscipline.disciplinePct}%</p>
                <p className="text-[10px] text-muted-foreground">good decisions</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Chase Rate</p>
                <p className="text-xl font-bold text-red-400">{latestDiscipline.chaseRate}%</p>
                <p className="text-[10px] text-muted-foreground">balls swung at</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Called Strikes</p>
                <p className="text-xl font-bold text-orange-400">{latestDiscipline.calledStrikeRate}%</p>
                <p className="text-[10px] text-muted-foreground">strikes taken</p>
              </div>
              {latestDiscipline.avgReactionMs != null && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Reaction Time</p>
                  <p className="text-xl font-bold text-foreground">{Math.round(latestDiscipline.avgReactionMs)}ms</p>
                  <p className="text-[10px] text-muted-foreground">avg on swings</p>
                </div>
              )}
            </div>
            {disciplineChartData.length > 1 && (
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={disciplineChartData}>
                  <XAxis dataKey="session" tick={false} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} hide />
                  <ChartTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, name: string) => [`${v}%`, name === "discipline" ? "Discipline" : "Chase Rate"]}
                    labelFormatter={(l) => `Session ${l}`}
                  />
                  <Line type="monotone" dataKey="discipline" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="chase" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="3 3" activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Discipline</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" style={{ borderTop: "1.5px dashed #ef4444", height: 0 }} /> Chase Rate</span>
              <span className="ml-auto">{disciplineHistory.length} session{disciplineHistory.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-1">Pitch recognition trainer</p>
              <p className="text-xs text-muted-foreground">See fastballs, curveballs, sliders. Swing or take. Train your zone discipline.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/enhance?tab=discipline")}>Play Now</Button>
          </div>
        )}
      </div>

      {/* ── Confidence ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<Sparkles className="w-3.5 h-3.5" />}
          title="Confidence"
          href="/enhance?tab=confidence"
          onNavigate={navigate}
        />
        {confidenceSessions.length > 0 ? (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Streak</p>
                <p className="text-xl font-bold text-primary">{confidenceStreak}</p>
                <p className="text-[10px] text-muted-foreground">day{confidenceStreak !== 1 ? "s" : ""} in a row</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Total Sessions</p>
                <p className="text-xl font-bold text-foreground">{confidenceSessions.length}</p>
                <p className="text-[10px] text-muted-foreground">completed</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Last Session</p>
                <p className="text-xl font-bold text-foreground">{confidenceSessions[0]?.durationMinutes}m</p>
                <p className="text-[10px] text-muted-foreground">{confidenceSessions[0]?.cyclesCompleted} cycles</p>
              </div>
            </div>
          </div>
        ) : isFree ? (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm mb-1">Breathing &amp; Affirmations</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Box breathing + positive self-talk to build mental confidence at the plate. Free plan includes {FREE_CONFIDENCE_LIMIT} sessions.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sessions used: <span className="font-semibold text-foreground">{freeConfidenceCount} / {FREE_CONFIDENCE_LIMIT}</span>
                </p>
              </div>
              {freeConfidenceCount < FREE_CONFIDENCE_LIMIT
                ? <Button size="sm" onClick={() => navigate("/enhance?tab=confidence")}>Try it free</Button>
                : <Button size="sm" onClick={() => navigate("/pricing")}>Upgrade</Button>
              }
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-1">Breathing &amp; Affirmations</p>
              <p className="text-xs text-muted-foreground">Build your mental confidence with guided box breathing and positive self-talk.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/enhance?tab=confidence")}>Begin</Button>
          </div>
        )}
      </div>

      {/* ── Badges ── */}
      {allBadgeDefs.length > 0 && (
        <div className="border-t border-border pt-6 space-y-4">
          <SectionDivider
            icon={<Trophy className="w-3.5 h-3.5" />}
            title="Badges"
          />
          {(["milestone", "streak", "volume"] as const).map(category => {
            const defs = allBadgeDefs.filter(b => b.category === category);
            if (!defs.length) return null;
            const labels: Record<string, string> = { milestone: "Milestones", streak: "Streaks", volume: "Volume" };
            return (
              <div key={category} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{labels[category]}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {defs.map(badge => {
                    const earned = earnedBadgeIds.has(badge.id);
                    const earnedDate = badgeEarnedAt.get(badge.id);
                    return (
                      <div
                        key={badge.id}
                        title={earned ? `${badge.description}${earnedDate ? ` · ${new Date(earnedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}` : badge.description}
                        className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center transition-colors ${
                          earned
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-card opacity-40"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${earned ? "bg-primary/15" : "bg-muted"}`}>
                          {earned
                            ? <Trophy className="w-3.5 h-3.5 text-primary" />
                            : <Lock className="w-3 h-3 text-muted-foreground" />
                          }
                        </div>
                        <p className={`text-[10px] font-semibold leading-tight ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                          {badge.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MLB Comps ── */}
      {isPaid && (
        <div className="border-t border-border pt-6 space-y-4">
          <SectionDivider
            icon={<Dna className="w-3.5 h-3.5" />}
            title="MLB Comps"
            href="/biometrics"
            onNavigate={navigate}
          />
          {autoComps.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {autoComps.map((comp, i) => (
                <div
                  key={comp.id}
                  onClick={() => navigate("/biometrics")}
                  className="bg-card border border-border rounded-xl p-5 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors text-center"
                >
                  {comp.player.savantId ? (
                    <img
                      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:good/v1/people/${comp.player.savantId}/headshot/67/current`}
                      alt={comp.player.name}
                      className="w-16 h-16 rounded-full object-cover bg-secondary/50"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                      {comp.player.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 w-full">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                      <p className="font-semibold truncate">{comp.player.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{comp.player.team}</p>
                    <p className="text-xs text-muted-foreground">Bats {comp.player.bats}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm mb-1">Find your MLB comps</p>
                <p className="text-xs text-muted-foreground">Enter your physical profile to get matched with MLB hitters with similar builds.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/biometrics")}>Set up</Button>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Coaching ── */}
      {isPaid && coachSessions.length > 0 && (
        <div className="border-t border-border pt-6 space-y-4">
          <SectionDivider
            icon={<Users className="w-3.5 h-3.5" />}
            title="Recent Coaching"
            href="/development"
            onNavigate={navigate}
          />
          <div className="space-y-2">
            {coachSessions.slice(0, 3).map(s => {
              const coachName = [s.coachFirstName, s.coachLastName].filter(Boolean).join(" ") || s.coachUsername;
              const date = s.sharedAt ?? s.createdAt;
              return (
                <div
                  key={s.id}
                  onClick={() => navigate("/development?session=" + s.id)}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      From <span className="text-primary">{coachName}</span>
                      {s.coachOrganization && <span className="text-muted-foreground text-xs ml-1">· {s.coachOrganization}</span>}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.notes}</p>}
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

      {/* ── Referral ── */}
      {!!user && (
        <div id="referral" className="border-t border-border pt-6 space-y-4">
          <SectionDivider
            icon={<Gift className="w-3.5 h-3.5" />}
            title="Refer a Friend"
          />
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Share your link. When a friend signs up and subscribes, you get <span className="text-foreground font-semibold">1 free month</span> automatically applied to your next invoice.
            </p>
            {referralData?.referralCode
              ? <ReferralLinkCopy code={referralData.referralCode} />
              : <div className="h-9 bg-secondary rounded-lg animate-pulse" />
            }
            {referralData.referrals?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Referrals</p>
                <div className="space-y-1">
                  {referralData.referrals.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate">{r.referredEmail ?? "—"}</span>
                      <span className={`text-xs font-semibold shrink-0 ml-2 ${r.referrerCreditedAt ? "text-green-400" : r.subscribedAt ? "text-primary" : "text-muted-foreground"}`}>
                        {r.referrerCreditedAt ? "Credited" : r.subscribedAt ? "Subscribed" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </Layout>
  );
}

function ReferralLinkCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const referralUrl = `${window.location.origin}/ref/${code}`;
  const copy = useCallback(() => {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralUrl]);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0 bg-secondary rounded-lg px-3 py-2 text-sm font-mono text-muted-foreground truncate">
        {referralUrl}
      </div>
      <Button size="sm" variant="outline" onClick={copy} className="shrink-0 gap-1.5">
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
