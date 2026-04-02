import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchVideos, deleteVideo } from "@/lib/api";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { UserVideoCard } from "@/components/UserVideoCard";
import {
  Trash2, Upload, Film, Search, Brain, BookOpen, Dna, Users,
  ChevronRight, Trophy, Lock, Star, MapPin, Eye,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer,
} from "recharts";
import type { Video, CognitionSession } from "@shared/schema";
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

      {/* ── Cognition ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<Brain className="w-3.5 h-3.5" />}
          title="Cognition"
          href="/cognition"
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
                ? <Button size="sm" onClick={() => navigate("/cognition")}>Try it free</Button>
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
            <Button size="sm" onClick={() => navigate("/cognition")}>Play Now</Button>
          </div>
        )}
      </div>

      {/* ── Visual Acuity ── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SectionDivider
          icon={<Eye className="w-3.5 h-3.5" />}
          title="Visual Acuity"
          href="/acuity"
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
                    onClick={() => navigate("/acuity")}
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
              <Button size="sm" onClick={() => navigate("/acuity")}>Start Training</Button>
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
                ? <Button size="sm" onClick={() => navigate("/acuity")}>Try it free</Button>
                : <Button size="sm" onClick={() => navigate("/pricing")}>Upgrade</Button>
              }
            </div>
          </div>
        )}
      </div>

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

    </Layout>
  );
}
