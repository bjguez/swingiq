import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, fetchPlayers } from "@/lib/api";
import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import type { Video, MlbPlayer } from "@shared/schema";
import {
  Upload, Trash2, Pencil, Save, X, Plus, PlayCircle,
  Film, Loader2, CheckCircle2, AlertCircle, Search,
  Users, UserPlus, Scissors, BookOpen, Mic,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const allCategories = ["Full Swing", "Game Swing", "Gather", "Launch", "Swing"];

const sourceOptions = ["MLB.com", "YouTube", "Upload", "Baseball Savant", "Other"];

interface MlbSearchResult {
  mlbId: string;
  name: string;
  team: string;
  position: string;
  bats: string;
}

interface MlbLookupResult {
  savantId: string;
  name: string;
  team: string;
  position: string;
  bats: string;
  height: string | null;
  weight: number | null;
  imageUrl: string;
  avgExitVelo: number | null;
  maxExitVelo: number | null;
  barrelPct: number | null;
  hardHitPct: number | null;
  avgExitVeloPercentile: number | null;
  maxExitVeloPercentile: number | null;
  barrelPctPercentile: number | null;
  hardHitPctPercentile: number | null;
  batSpeed: number | null;
  attackAngle: number | null;
  rotationalAccel: number | null;
  battingAvg: number | null;
  homeRuns: number | null;
  rbi: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  savantAvailable: boolean;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"videos" | "users" | "players" | "health" | "blueprint">("videos");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ title: string; url: string } | null>(null);
  const [tierDraft, setTierDraft] = useState<Record<string, string>>({});

  // User tab filters
  const [userSearch, setUserSearch] = useState("");
  const [userTypeTab, setUserTypeTab] = useState<"all" | "players" | "coaches" | "parents">("all");
  const [userPage, setUserPage] = useState(0);
  const USER_PAGE_SIZE = 50;

  // Video state
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterBats, setFilterBats] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  // Player state (tab)
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerBatsFilter, setPlayerBatsFilter] = useState("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Video>>({});
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);

  // Player state
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ updated: number; failed: number; total: number } | null>(null);

  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["/api/players"],
    queryFn: fetchPlayers,
  });

  const { data: adminUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: activeTab === "users",
  });

  const { data: r2Health, isLoading: r2Loading, error: r2Error, refetch: refetchHealth } = useQuery({
    queryKey: ["/api/admin/r2-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/r2-health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${body.message ?? "Failed to check R2 health"}`);
      }
      return res.json() as Promise<{ total: number; missing: number; ok: number; r2PublicUrl: string; urlMode: string; videos: { id: string; title: string; playerName: string | null; isProVideo: boolean; key: string; exists: boolean }[] }>;
    },
    enabled: activeTab === "health",
    retry: false,
  });

  const [transcodeProgress, setTranscodeProgress] = useState<{
    running: boolean;
    total: number;
    done: number;
    failed: number;
    current: string | null;
    errors: string[];
  } | null>(null);

  async function startTranscode() {
    const res = await fetch("/api/admin/transcode-mov/pending");
    if (!res.ok) { toast({ title: "Failed to fetch pending videos", variant: "destructive" }); return; }
    const { pending } = await res.json() as { pending: { id: string; title: string }[]; total: number };
    if (pending.length === 0) { toast({ title: "No videos need transcoding" }); return; }

    setTranscodeProgress({ running: true, total: pending.length, done: 0, failed: 0, current: pending[0].title, errors: [] });

    let done = 0, failed = 0;
    const errors: string[] = [];
    for (const video of pending) {
      setTranscodeProgress(prev => prev ? { ...prev, current: video.title } : prev);
      try {
        const r = await fetch(`/api/admin/transcode-mov/${video.id}`, { method: "POST" });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: "Unknown error" }));
          errors.push(`${video.title}: ${err.message}`);
          failed++;
        } else {
          done++;
        }
      } catch {
        errors.push(`${video.title}: Network error`);
        failed++;
      }
      setTranscodeProgress(prev => prev ? { ...prev, done, failed, errors: [...errors] } : prev);
    }

    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    refetchHealth();
    setTranscodeProgress(prev => prev ? { ...prev, running: false, current: null } : prev);
    if (failed > 0) {
      toast({ title: `Transcoded ${done}/${pending.length}. ${failed} failed.`, variant: "destructive" });
    } else {
      toast({ title: `Transcoded ${done} video${done !== 1 ? "s" : ""} to mp4` });
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({ title: "Video deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete video", variant: "destructive" });
    },
  });

  const setTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      const res = await fetch("/api/admin/set-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: `${data.username} set to ${data.subscriptionTier}` });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to set tier", variant: "destructive" });
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/players/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      toast({ title: "Player removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove player", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Video> }) => {
      const res = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setEditingId(null);
      setEditData({});
      toast({ title: "Video updated" });
    },
    onError: () => {
      toast({ title: "Failed to update video", variant: "destructive" });
    },
  });

  const playerBatsMap = useMemo(() => new Map<string, string>(
    (players as MlbPlayer[]).map(p => [p.name.toLowerCase(), p.bats ?? ""])
  ), [players]);

  const filtered = useMemo(() => allVideos.filter((v: Video) => {
    if (!v.isProVideo) return false;
    const matchCat = filterCategory === "All" || v.category === filterCategory;
    const matchSearch = !searchQuery ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.playerName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchBats = filterBats === "All" || !v.playerName ||
      playerBatsMap.get(v.playerName.toLowerCase()) === filterBats;
    return matchCat && matchSearch && matchBats;
  }), [allVideos, filterCategory, searchQuery, filterBats, playerBatsMap]);

  const startEdit = (video: Video) => {
    setEditingId(video.id);
    setEditData({ ...video });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    const payload: Record<string, unknown> = {
      title: editData.title,
      category: editData.category,
      source: editData.source,
      playerName: editData.playerName ?? null,
      playerId: editData.playerId ?? null,
      fps: editData.fps ?? null,
      duration: editData.duration ?? null,
      sourceUrl: editData.sourceUrl ?? null,
      season: editData.season ?? null,
      isProVideo: editData.isProVideo ?? false,
      showInLibrary: editData.showInLibrary ?? true,
      showInDevelopment: editData.showInDevelopment ?? true,
    };
    updateMutation.mutate({ id: editingId, data: payload as Partial<Video> });
  };

  const filteredUsers = useMemo(() => {
    let list = adminUsers as any[];
    if (userTypeTab === "players") list = list.filter(u => !u.accountType || u.accountType === "player");
    if (userTypeTab === "coaches") list = list.filter(u => u.accountType === "coach");
    if (userTypeTab === "parents") list = list.filter(u => u.accountType === "parent");
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      list = list.filter(u =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q) ||
        u.state?.toLowerCase().includes(q) ||
        u.athletes?.some((a: any) =>
          `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [adminUsers, userTypeTab, userSearch]);

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE));
  const pagedUsers = useMemo(
    () => filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE),
    [filteredUsers, userPage]
  );

  const proCount = useMemo(() => allVideos.filter((v: Video) => v.isProVideo).length, [allVideos]);
  const uploadCount = useMemo(() => allVideos.filter((v: Video) => !v.isProVideo).length, [allVideos]);
  const withFileCount = useMemo(() => allVideos.filter((v: Video) => v.sourceUrl).length, [allVideos]);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 uppercase tracking-wider">Admin</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Video Management</h1>
          <p className="text-muted-foreground">Upload, tag, and manage the Swing Studio video library.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border mb-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("videos")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "videos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Film className="w-4 h-4 inline mr-2" />
          Videos
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="w-4 h-4 inline mr-2" />
          Users
        </button>
        <button
          onClick={() => setActiveTab("players")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "players"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Players
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "health"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          R2 Health
        </button>
        <button
          onClick={() => setActiveTab("blueprint")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "blueprint"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Blueprint
        </button>
      </div>

      {/* ── VIDEOS TAB ── */}
      {activeTab === "videos" && (
        <>
          <div className="flex flex-col gap-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Videos" value={allVideos.length} />
              <StatCard label="Pro Clips" value={proCount} />
              <StatCard label="User Uploads" value={uploadCount} />
              <StatCard label="With Files" value={withFileCount} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm("Reset ALL videos to visible in Library and Development?")) return;
                  await fetch("/api/admin/reset-visibility", { method: "POST" });
                  queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
                }}
              >
                Reset All Visible
              </Button>
              <Button
                onClick={() => setShowAddVideoForm(!showAddVideoForm)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-add-video"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Video
              </Button>
            </div>
          </div>

          {showAddVideoForm && (
            <AddVideoForm
              players={players}
              onClose={() => setShowAddVideoForm(false)}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
                setShowAddVideoForm(false);
              }}
            />
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                className="pl-9 bg-secondary/30 border-border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-admin-search"
              />
            </div>
            <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-1 shrink-0">
              {(["All", "L", "R", "S"] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setFilterBats(h)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    filterBats === h
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  title={h === "All" ? "All hitters" : h === "L" ? "Left-handed" : h === "R" ? "Right-handed" : "Switch hitters"}
                >
                  {h === "All" ? "All" : `Bats ${h}`}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterPill label="All" active={filterCategory === "All"} onClick={() => setFilterCategory("All")} count={allVideos.length} />
              {allCategories.map(cat => {
                const count = allVideos.filter((v: Video) => v.category === cat).length;
                return <FilterPill key={cat} label={cat} active={filterCategory === cat} onClick={() => setFilterCategory(cat)} count={count} />;
              })}
            </div>
          </div>

          {/* Videos Table */}
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <div className="min-w-[700px]">
            <div className="bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider items-center">
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Player</div>
              <div className="col-span-1">Category</div>
              <div className="col-span-1">Duration</div>
              <div className="col-span-1">File</div>
              <div className="col-span-2 text-center">Visibility</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
                {filtered.map((video: Video) => (
                  editingId === video.id ? (
                    <EditRow
                      key={video.id}
                      editData={editData}
                      setEditData={setEditData}
                      players={players}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      saving={updateMutation.isPending}
                    />
                  ) : trimmingId === video.id ? (
                    <TrimRow
                      key={video.id}
                      video={video}
                      onDone={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
                        setTrimmingId(null);
                      }}
                      onCancel={() => setTrimmingId(null)}
                    />
                  ) : (
                    <VideoRow
                      key={video.id}
                      video={video}
                      onEdit={() => startEdit(video)}
                      onTrim={() => { setTrimmingId(video.id); setEditingId(null); }}
                      onDelete={() => {
                        if (confirm(`Delete "${video.title}"?`)) {
                          deleteMutation.mutate(video.id);
                        }
                      }}
                      onToggle={(field, val) => updateMutation.mutate({ id: video.id, data: { [field]: val } as Partial<Video> })}
                      deleting={deleteMutation.isPending}
                    />
                  )
                ))}
                {filtered.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No videos match your filters.
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </>
      )}

      {/* ── USER UPLOADS TAB ── */}
      {activeTab === "users" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Users" value={(adminUsers as any[]).length} />
            <StatCard label="Paid" value={(adminUsers as any[]).filter((u: any) => u.subscriptionTier === "player" || u.subscriptionTier === "pro").length} />
            <StatCard label="Coaches / Parents" value={(adminUsers as any[]).filter((u: any) => u.accountType === "coach" || u.accountType === "parent").length} />
            <StatCard label="Incomplete Profile" value={(adminUsers as any[]).filter((u: any) => !u.profileComplete).length} />
          </div>

          {/* Sub-tabs + search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
              {([
                { key: "all", label: `All (${(adminUsers as any[]).length})` },
                { key: "players", label: `Players (${(adminUsers as any[]).filter((u: any) => u.accountType === "player" || !u.accountType).length})` },
                { key: "coaches", label: `Coaches (${(adminUsers as any[]).filter((u: any) => u.accountType === "coach").length})` },
                { key: "parents", label: `Parents (${(adminUsers as any[]).filter((u: any) => u.accountType === "parent").length})` },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setUserTypeTab(key); setUserPage(0); setUserSearch(""); }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    userTypeTab === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search username, email, city…"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(0); }}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {filteredUsers.length} result{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <div className="min-w-[900px]">
            <div className="bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
              <div className="col-span-2">Username</div>
              <div className="col-span-1">Tier</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Bats</div>
              <div className="col-span-1">Age</div>
              <div className="col-span-1">City</div>
              <div className="col-span-1">State</div>
              <div className="col-span-1 text-center">Uploads</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border/50">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {(adminUsers as any[]).length === 0 ? "No users yet." : "No users match your search."}
                </div>
              ) : pagedUsers.map((u: any) => (
                <>
                  <div key={u.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-secondary/20 min-w-[900px]">
                    <div className="col-span-2 text-sm font-semibold flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary uppercase">
                        {u.username[0]}
                      </div>
                      <span className="truncate">{u.username}</span>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${u.subscriptionTier === "pro" ? "bg-primary/20 text-primary" : u.subscriptionTier === "player" ? "bg-blue-500/10 text-blue-400" : "bg-secondary text-muted-foreground"}`}>
                        {u.subscriptionTier === "pro" ? "Pro" : u.subscriptionTier === "player" ? "Player" : "Rookie"}
                      </span>
                    </div>
                    <div className="col-span-2 flex flex-col gap-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit ${u.emailVerified ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                        {u.emailVerified ? "✓ Email" : "✗ Email"}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit ${u.profileComplete ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"}`}>
                        {u.profileComplete ? "✓ Profile" : "✗ Profile"}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit ${
                        u.accountType === "coach" ? "bg-purple-500/10 text-purple-400" :
                        u.accountType === "parent" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-blue-500/10 text-blue-400"
                      }`}>
                        {u.accountType === "coach" ? "Coach" : u.accountType === "parent" ? "Parent" : "Player"}
                      </span>
                    </div>
                    <div className="col-span-1 text-xs text-muted-foreground">{u.bats || "—"}</div>
                    <div className="col-span-1 text-xs text-muted-foreground">{u.age || "—"}</div>
                    <div className="col-span-1 text-xs text-muted-foreground truncate">{u.city || "—"}</div>
                    <div className="col-span-1 text-xs text-muted-foreground">{u.state || "—"}</div>
                    <div className="col-span-1 text-center">
                      <span className={`text-xs font-bold ${u.uploadCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {u.uploadCount}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                      >
                        {expandedUserId === u.id ? "Hide" : "View"}
                      </Button>
                    </div>
                  </div>
                  {expandedUserId === u.id && (
                    <div key={`${u.id}-detail`} className="bg-secondary/20 border-t border-border/50 px-4 py-4 space-y-4">
                      {/* Set Tier */}
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Set Tier</span>
                        <select
                          value={tierDraft[u.id] ?? u.subscriptionTier ?? "free"}
                          onChange={e => setTierDraft(d => ({ ...d, [u.id]: e.target.value }))}
                          className="text-sm bg-background border border-input rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {["free", "rookie", "player", "pro", "coach"].map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => setTierMutation.mutate({ userId: u.id, tier: tierDraft[u.id] ?? u.subscriptionTier ?? "free" })}
                          disabled={setTierMutation.isPending}
                          className="h-7 px-3 text-xs"
                        >
                          {setTierMutation.isPending ? "Saving…" : "Apply"}
                        </Button>
                      </div>
                      {/* Full profile fields — for player/coach accounts */}
                      {u.accountType !== "parent" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          {[
                            { label: "Tier", value: u.subscriptionTier === "pro" ? "Pro" : u.subscriptionTier === "player" ? "Player" : "Rookie" },
                            { label: "Bats", value: u.bats || "—" },
                            { label: "Throws", value: u.throws || "—" },
                            { label: "Skill", value: u.skillLevel?.replace(/_/g, " ") || "—" },
                            { label: "Age", value: u.age || "—" },
                            { label: "Height", value: u.heightInches ? `${Math.floor(u.heightInches / 12)}'${u.heightInches % 12}"` : "—" },
                            { label: "Weight", value: u.weightLbs ? `${u.weightLbs} lbs` : "—" },
                            { label: "Location", value: [u.city, u.state].filter(Boolean).join(", ") || "—" },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-secondary/50 rounded px-3 py-2">
                              <p className="text-muted-foreground mb-0.5">{label}</p>
                              <p className="font-semibold text-foreground capitalize">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Athletes — for parent accounts */}
                      {u.accountType === "parent" && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Athletes ({u.athletes?.length ?? 0})
                          </p>
                          {(!u.athletes || u.athletes.length === 0) ? (
                            <p className="text-xs text-muted-foreground">No athletes added yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {u.athletes.map((a: any) => (
                                <div key={a.id} className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-secondary/30 rounded-lg p-3">
                                  {[
                                    { label: "Name", value: `${a.firstName} ${a.lastName}` },
                                    { label: "Bats", value: a.bats || "—" },
                                    { label: "Throws", value: a.throws || "—" },
                                    { label: "Skill", value: a.skillLevel?.replace(/_/g, " ") || "—" },
                                    { label: "Age", value: a.age || "—" },
                                    { label: "Location", value: [a.city, a.state].filter(Boolean).join(", ") || "—" },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="bg-secondary/50 rounded px-3 py-2">
                                      <p className="text-muted-foreground mb-0.5">{label}</p>
                                      <p className="font-semibold text-foreground capitalize">{value}</p>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Video list */}
                      {u.videos.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Uploads ({u.videos.length})</p>
                          <div className="space-y-1.5">
                            {u.videos.map((v: any) => (
                              <div key={v.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                                  <span className="truncate text-xs font-medium">{v.title}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {v.sourceUrl ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-primary hover:text-primary/80"
                                      onClick={() => setPlayingVideo({ title: v.title, url: v.sourceUrl })}
                                    >
                                      <PlayCircle className="w-3 h-3 mr-1" /> Play
                                    </Button>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-yellow-500">
                                      <AlertCircle className="w-3 h-3" /> No file
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                                    onClick={() => { if (confirm(`Delete "${v.title}"?`)) deleteMutation.mutate(v.id); }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No uploads yet.</p>
                      )}
                    </div>
                  )}
                </>
              ))}
            </div>
            </div>
          </div>

          {/* Pagination */}
          {userPageCount > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">
                Page {userPage + 1} of {userPageCount} · {filteredUsers.length} users
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  disabled={userPage === 0}
                  onClick={() => setUserPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  disabled={userPage >= userPageCount - 1}
                  onClick={() => setUserPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Video Player Dialog */}
          <Dialog open={!!playingVideo} onOpenChange={(o) => { if (!o) setPlayingVideo(null); }}>
            <DialogContent className="max-w-3xl bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display uppercase tracking-wide truncate text-sm">
                  {playingVideo?.title}
                </DialogTitle>
              </DialogHeader>
              {playingVideo && (
                <video
                  src={playingVideo.url}
                  controls
                  autoPlay
                  className="w-full rounded-lg max-h-[70vh]"
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── PLAYERS TAB ── */}
      {activeTab === "players" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <StatCard label="Total Players" value={players.length} />
              <StatCard label="With Statcast" value={players.filter((p: MlbPlayer) => p.avgExitVelo != null).length} />
              <StatCard label="With Career Stats" value={players.filter((p: MlbPlayer) => p.battingAvg != null).length} />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                disabled={backfilling}
                onClick={async () => {
                  setBackfilling(true);
                  setBackfillResult(null);
                  try {
                    const res = await fetch("/api/admin/backfill-player-stats", { method: "POST" });
                    const data = await res.json();
                    setBackfillResult(data);
                    queryClient.invalidateQueries({ queryKey: ["/api/players"] });
                  } finally {
                    setBackfilling(false);
                  }
                }}
              >
                {backfilling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Backfill Stats
              </Button>
              <Button
                onClick={() => setShowAddPlayerForm(!showAddPlayerForm)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Player
              </Button>
            </div>
          </div>
          {backfillResult && (
            <div className="mb-4 p-3 rounded-lg border border-border bg-secondary/30 text-sm text-muted-foreground">
              Backfill complete: <span className="text-foreground font-medium">{backfillResult.updated}</span> updated,{" "}
              <span className="text-foreground font-medium">{backfillResult.failed}</span> failed,{" "}
              <span className="text-foreground font-medium">{backfillResult.total}</span> total processed.
            </div>
          )}

          {showAddPlayerForm && (
            <AddPlayerForm
              onClose={() => setShowAddPlayerForm(false)}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/players"] });
                setShowAddPlayerForm(false);
              }}
            />
          )}

          {/* Players Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                className="pl-9 bg-secondary/30 border-border"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-1 shrink-0">
              {(["All", "L", "R", "S"] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setPlayerBatsFilter(h)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    playerBatsFilter === h
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  title={h === "All" ? "All hitters" : h === "L" ? "Left-handed" : h === "R" ? "Right-handed" : "Switch hitters"}
                >
                  {h === "All" ? "All" : `Bats ${h}`}
                </button>
              ))}
            </div>
          </div>

          {/* Players Table */}
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <div className="min-w-[700px]">
            <div className="bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider items-center">
              <div className="col-span-1"></div>
              <div className="col-span-3">Name</div>
              <div className="col-span-1">Team</div>
              <div className="col-span-1">Pos</div>
              <div className="col-span-1">Bats</div>
              <div className="col-span-2">Avg EV</div>
              <div className="col-span-1">Barrel%</div>
              <div className="col-span-1">Bat Spd</div>
              <div className="col-span-1 text-right">Del</div>
            </div>
            <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
              {players.filter((p: MlbPlayer) => {
                const matchSearch = !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()) || (p.team?.toLowerCase().includes(playerSearch.toLowerCase()) ?? false);
                const matchBats = playerBatsFilter === "All" || p.bats === playerBatsFilter;
                return matchSearch && matchBats;
              }).map((player: MlbPlayer) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  onDelete={() => {
                    if (confirm(`Remove "${player.name}" from roster?`)) {
                      deletePlayerMutation.mutate(player.id);
                    }
                  }}
                />
              ))}
              {players.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No players in roster yet. Add your first player above.
                </div>
              )}
            </div>
            </div>
          </div>
        </>
      )}

      {/* ── R2 HEALTH TAB ── */}
      {activeTab === "health" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              <StatCard label="R2 Videos" value={r2Health?.total ?? 0} />
              <StatCard label="OK" value={r2Health?.ok ?? 0} />
              <StatCard label="Missing" value={r2Health?.missing ?? 0} />
              <StatCard label="Needs Transcode" value={r2Health?.videos.filter(v => /\.(mov|avi|webm)$/i.test(v.key)).length ?? 0} />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={startTranscode}
                disabled={!!transcodeProgress?.running}
              >
                {transcodeProgress?.running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {transcodeProgress?.running ? `Transcoding ${transcodeProgress.done + transcodeProgress.failed + 1}/${transcodeProgress.total}…` : "Transcode .mov → mp4"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchHealth()} disabled={r2Loading}>
                {r2Loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                {r2Loading ? "Checking..." : "Run Check"}
              </Button>
            </div>
          </div>

          {transcodeProgress && (
            <div className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {transcodeProgress.running ? `Transcoding: ${transcodeProgress.current}` : "Transcode complete"}
                </span>
                <span className="text-muted-foreground font-mono">
                  {transcodeProgress.done} done · {transcodeProgress.failed} failed · {transcodeProgress.total} total
                </span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((transcodeProgress.done + transcodeProgress.failed) / transcodeProgress.total) * 100}%` }}
                />
              </div>
              {transcodeProgress.errors.length > 0 && (
                <div className="text-xs text-destructive space-y-0.5 max-h-24 overflow-y-auto">
                  {transcodeProgress.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}

          {r2Error && (
            <div className="border border-destructive/40 bg-destructive/10 rounded-xl p-4 text-sm text-destructive">
              <span className="font-semibold">Health check failed:</span> {(r2Error as Error).message}
            </div>
          )}

          {r2Health && (
            <div className="text-xs text-muted-foreground mb-2">
              URL mode: <span className={`font-semibold ${r2Health.urlMode === "cdn" ? "text-green-500" : "text-yellow-500"}`}>{r2Health.urlMode}</span>
              {r2Health.urlMode === "cdn" && <span className="ml-1">({r2Health.r2PublicUrl})</span>}
              {r2Health.urlMode !== "cdn" && <span className="ml-1 text-yellow-500">— R2_PUBLIC_URL not set, using expiring presigned URLs</span>}
            </div>
          )}

          {!r2Health && !r2Error && !r2Loading && !transcodeProgress && (
            <div className="border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
              Click "Run Check" to scan all R2-stored videos for missing files.
            </div>
          )}

          {r2Health && (
            <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
              <div className="min-w-[700px]">
              <div className="bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
                <div className="col-span-1">Status</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Player</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-1">Format</div>
                <div className="col-span-4">R2 Key</div>
              </div>
              <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
                {r2Health.videos.map(v => {
                  const ext = v.key.split(".").pop()?.toLowerCase() ?? "?";
                  const needsTranscode = ["mov", "avi", "webm"].includes(ext);
                  return (
                    <div key={v.id} className="grid grid-cols-12 gap-2 p-3 items-center text-sm">
                      <div className="col-span-1">
                        {v.exists
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <AlertCircle className="w-4 h-4 text-destructive" />}
                      </div>
                      <div className={`col-span-3 font-medium truncate ${!v.exists ? "text-destructive" : ""}`}>{v.title}</div>
                      <div className="col-span-2 text-xs text-muted-foreground truncate">{v.playerName || "—"}</div>
                      <div className="col-span-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${v.isProVideo ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                          {v.isProVideo ? "Pro" : "User"}
                        </span>
                      </div>
                      <div className="col-span-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${needsTranscode ? "bg-orange-500/20 text-orange-400" : "bg-green-500/10 text-green-500"}`}>
                          .{ext}
                        </span>
                      </div>
                      <div className="col-span-4 text-xs text-muted-foreground font-mono truncate">{v.key}</div>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "blueprint" && (
        <BlueprintAdminTab />
      )}
    </Layout>
  );
}

function BlueprintAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState({
    phase: "foundation",
    contentType: "drill",
    title: "",
    description: "",
    sourceUrl: "",
  });

  const { data: content = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/blueprint/content"],
    queryFn: () => fetch("/api/blueprint/content").then(r => r.json()),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const fd = new FormData();
    fd.append("video", file);
    fd.append("title", form.title || file.name);
    fd.append("skipRecord", "1");
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      });
      const response = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", "/api/upload");
        xhr.send(fd);
      });
      setForm(prev => ({ ...prev, sourceUrl: response.sourceUrl, title: prev.title || file.name }));
      toast({ title: "Video uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/blueprint/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm({ phase: "foundation", contentType: "drill", title: "", description: "", sourceUrl: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/blueprint/content"] });
      toast({ title: "Content saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this blueprint content?")) return;
    await fetch(`/api/blueprint/content/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["/api/blueprint/content"] });
    toast({ title: "Deleted" });
  };

  const PHASES = [
    { value: "foundation", label: "Foundation" },
    { value: "gather", label: "Gather" },
    { value: "lag", label: "Lag" },
    { value: "on_plane", label: "On Plane" },
    { value: "contact", label: "Contact" },
    { value: "finish", label: "Finish" },
  ];

  const CONTENT_TYPES = [
    { value: "drill", label: "Drill" },
    { value: "reference", label: "Reference Clip" },
    { value: "voiceover", label: "Voiceover" },
  ];

  const typeColor = (t: string) => t === "drill" ? "bg-blue-500/20 text-blue-400" : t === "reference" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400";

  // Group content by phase
  const grouped = PHASES.map(p => ({
    ...p,
    items: content.filter(c => c.phase === p.value),
  }));

  return (
    <div className="space-y-6">
      {/* Quick action */}
      <div className="flex items-center gap-3">
        <Link href="/coach/session?mode=blueprint">
          <Button size="sm" className="gap-2">
            <Mic size={14} /> Record Pro Voiceover
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground">Pick a pro video and record your coaching analysis directly over it.</p>
      </div>

      {/* Add content form */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-bold text-base">Add Blueprint Content</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Phase</label>
            <select
              value={form.phase}
              onChange={e => setForm(p => ({ ...p, phase: e.target.value }))}
              className="w-full h-9 rounded-md bg-secondary/30 border border-border px-3 text-sm"
            >
              {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Type</label>
            <select
              value={form.contentType}
              onChange={e => setForm(p => ({ ...p, contentType: e.target.value }))}
              className="w-full h-9 rounded-md bg-secondary/30 border border-border px-3 text-sm"
            >
              {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Title</label>
          <Input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Back elbow drop drill"
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="What does this drill teach?"
            rows={2}
            className="w-full rounded-md bg-secondary/30 border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Video upload */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Video</label>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{uploadProgress}%</>
              ) : (
                <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload Video</>
              )}
            </Button>
            {form.sourceUrl && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Or paste a URL directly:</p>
          <Input
            value={form.sourceUrl}
            onChange={e => setForm(p => ({ ...p, sourceUrl: e.target.value }))}
            placeholder="https://... or leave blank"
            className="h-9"
          />
        </div>

        <Button onClick={handleSave} className="w-full">
          <Plus className="w-4 h-4 mr-1.5" /> Save Content
        </Button>
      </div>

      {/* Content library by phase */}
      <div className="space-y-4">
        <h3 className="font-bold text-base">Content Library</h3>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          grouped.map(group => (
            <div key={group.value} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label} ({group.items.length})</h4>
              {group.items.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-2">No content yet</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {group.items.map((item: any) => (
                    <div key={item.id} className="relative shrink-0 w-36 rounded-lg border border-border bg-secondary overflow-hidden group">
                      {/* Thumbnail / video placeholder */}
                      <div className="aspect-video bg-black flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : item.videoUrl ? (
                          <a href={item.videoUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors">
                            <PlayCircle className="w-7 h-7 opacity-60" />
                          </a>
                        ) : (
                          <Film className="w-6 h-6 text-muted-foreground opacity-30" />
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-1.5">
                        <p className="text-[11px] font-semibold leading-tight truncate">{item.title}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${typeColor(item.contentType)}`}>
                          {item.contentType}
                        </span>
                      </div>
                      {/* Delete button — shows on hover */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-2xl font-bold font-display text-primary">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function FilterPill({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary border border-border/50'
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-border'}`}>{count}</span>
    </button>
  );
}

// ── Video components ──────────────────────────────────────────────────────────

function VisibilityToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${active ? "Hide from" : "Show in"} ${label}`}
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
        active
          ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
          : "bg-secondary text-muted-foreground/50 border-border hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20"
      }`}
    >
      {label}
    </button>
  );
}

function VideoRow({ video, onEdit, onTrim, onDelete, onToggle, deleting }: {
  video: Video;
  onEdit: () => void;
  onTrim: () => void;
  onDelete: () => void;
  onToggle: (field: "showInLibrary" | "showInDevelopment", val: boolean) => void;
  deleting: boolean;
}) {
  return (
    <div className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-secondary/20 transition-colors text-sm" data-testid={`admin-row-${video.id}`}>
      <div className="col-span-3 font-medium flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
          {video.sourceUrl ? (
            <PlayCircle className="w-4 h-4 text-primary" />
          ) : (
            <Film className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>
        <span className="truncate">{video.title}</span>
      </div>
      <div className="col-span-2 text-muted-foreground truncate">{video.playerName || "—"}</div>
      <div className="col-span-1">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">{video.category}</span>
      </div>
      <div className="col-span-1 text-muted-foreground text-xs font-mono">{video.duration || "—"}</div>
      <div className="col-span-1">
        {video.sourceUrl ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-yellow-500/50" />
        )}
      </div>
      <div className="col-span-2 flex justify-center gap-1">
        <VisibilityToggle
          label="Library"
          active={video.showInLibrary !== false}
          onClick={() => onToggle("showInLibrary", !(video.showInLibrary !== false))}
        />
        <VisibilityToggle
          label="Dev"
          active={video.showInDevelopment !== false}
          onClick={() => onToggle("showInDevelopment", !(video.showInDevelopment !== false))}
        />
      </div>
      <div className="col-span-2 flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onEdit} data-testid={`button-edit-${video.id}`}>
          <Pencil className="w-4 h-4" />
        </Button>
        {video.sourceUrl && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-yellow-400" onClick={onTrim} title="Trim video" data-testid={`button-trim-${video.id}`}>
            <Scissors className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={onDelete} disabled={deleting} data-testid={`button-delete-${video.id}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function EditRow({ editData, setEditData, players, onSave, onCancel, saving }: {
  editData: Partial<Video>;
  setEditData: (d: Partial<Video>) => void;
  players: MlbPlayer[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="p-3 bg-primary/5 border-l-2 border-primary space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Title</label>
          <Input
            value={editData.title || ""}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            placeholder="Judge, Aaron – Full Swing – HR to RF 2024"
            className="h-9 bg-background"
            data-testid="edit-title"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Player</label>
          <select
            value={editData.playerId || ""}
            onChange={(e) => {
              const player = players.find(p => p.id === e.target.value);
              setEditData({
                ...editData,
                playerId: e.target.value || null,
                playerName: player?.name || editData.playerName,
              });
            }}
            className="w-full h-9 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="edit-player"
          >
            <option value="">No player linked</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Player Name (display)</label>
          <Input
            value={editData.playerName || ""}
            onChange={(e) => setEditData({ ...editData, playerName: e.target.value })}
            className="h-9 bg-background"
            data-testid="edit-player-name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Category</label>
          <select
            value={editData.category || ""}
            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
            className="w-full h-9 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="edit-category"
          >
            {allCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Duration</label>
          <Input
            value={editData.duration || ""}
            onChange={(e) => setEditData({ ...editData, duration: e.target.value })}
            placeholder="0:12"
            className="h-9 bg-background"
            data-testid="edit-duration"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Season / Year</label>
          <Input
            type="number"
            value={editData.season ?? ""}
            onChange={(e) => setEditData({ ...editData, season: parseInt(e.target.value) || null })}
            placeholder="2024"
            className="h-9 bg-background"
            data-testid="edit-season"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Pro Video</label>
          <select
            value={editData.isProVideo ? "true" : "false"}
            onChange={(e) => setEditData({ ...editData, isProVideo: e.target.value === "true" })}
            className="w-full h-9 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="edit-is-pro"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Source URL / File Path</label>
        <Input
          value={editData.sourceUrl || ""}
          onChange={(e) => setEditData({ ...editData, sourceUrl: e.target.value || null })}
          placeholder="/uploads/filename.mp4 or external URL"
          className="h-9 bg-background"
          data-testid="edit-source-url"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} data-testid="button-save-edit">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function TrimRow({ video, onDone, onCancel }: { video: Video; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [trimming, setTrimming] = useState(false);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
  };

  const markIn = () => {
    if (videoRef.current) setStartTime(videoRef.current.currentTime);
  };

  const markOut = () => {
    if (videoRef.current) setEndTime(videoRef.current.currentTime);
  };

  const applyTrim = async () => {
    if (endTime === null || endTime <= startTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }
    setTrimming(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/trim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime, endTime }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Trim failed");
      }
      toast({ title: "Video trimmed successfully" });
      onDone();
    } catch (err: any) {
      toast({ title: err.message || "Trim failed", variant: "destructive" });
    }
    setTrimming(false);
  };

  return (
    <div className="p-4 bg-yellow-500/5 border-l-2 border-yellow-500 space-y-3">
      <div className="flex items-center gap-2">
        <Scissors className="w-4 h-4 text-yellow-500 shrink-0" />
        <span className="font-semibold text-sm truncate">Trim: {video.title}</span>
        {duration !== null && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">Total: {fmt(duration)}</span>
        )}
      </div>

      {/* Inline video preview */}
      <video
        ref={videoRef}
        src={video.sourceUrl!}
        controls
        className="w-full max-h-56 rounded-lg bg-black"
        onLoadedMetadata={() => {
          if (videoRef.current) {
            const d = videoRef.current.duration;
            setDuration(d);
            setEndTime(d);
          }
        }}
      />

      {/* Mark In / Mark Out */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={markIn} className="border-green-500/50 text-green-400 hover:bg-green-500/10 font-mono">
          ▶ Mark In &nbsp;{fmt(startTime)}
        </Button>
        <Button size="sm" variant="outline" onClick={markOut} className="border-red-500/50 text-red-400 hover:bg-red-500/10 font-mono">
          ■ Mark Out &nbsp;{endTime !== null ? fmt(endTime) : "—"}
        </Button>
        {endTime !== null && endTime > startTime && (
          <span className="text-xs text-yellow-400 font-mono ml-auto">Clip length: {fmt(endTime - startTime)}</span>
        )}
      </div>

      {/* Visual range bar */}
      {duration !== null && endTime !== null && (
        <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-yellow-500/40 rounded-full"
            style={{
              left: `${(startTime / duration) * 100}%`,
              width: `${Math.max(0, ((endTime - startTime) / duration) * 100)}%`,
            }}
          />
          <div className="absolute top-0 h-full w-0.5 bg-green-500" style={{ left: `${(startTime / duration) * 100}%` }} />
          <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: `${(endTime / duration) * 100}%` }} />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={trimming}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={applyTrim}
          disabled={trimming || endTime === null || endTime <= startTime}
          className="bg-yellow-500 text-black hover:bg-yellow-400 font-semibold"
        >
          {trimming
            ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Trimming…</>
            : <><Scissors className="w-4 h-4 mr-1" /> Apply Trim</>
          }
        </Button>
      </div>
    </div>
  );
}

function AddVideoForm({ players, onClose, onSuccess }: { players: MlbPlayer[]; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    category: "Full Swing",
    playerName: "",
    playerId: "",
    source: "Upload",
    sourceUrl: "",
    duration: "",
    fps: "",
    season: "",
    isProVideo: true,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const fd = new FormData();
    fd.append("video", file);
    fd.append("title", formData.title || file.name);
    fd.append("category", formData.category);
    fd.append("playerName", formData.playerName);
    if (formData.fps) fd.append("fps", formData.fps);
    fd.append("skipRecord", "1"); // Admin uploads: just store the file, form creates the DB record

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      });

      const response = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", "/api/upload");
        xhr.send(fd);
      });

      setFormData(prev => ({ ...prev, sourceUrl: response.sourceUrl, title: prev.title || file.name }));
      toast({ title: "File uploaded successfully" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      const body: any = {
        title: formData.title,
        category: formData.category,
        source: formData.source,
        isProVideo: formData.isProVideo,
        playerName: formData.playerName || null,
        playerId: formData.playerId || null,
        sourceUrl: formData.sourceUrl || null,
        duration: formData.duration || null,
        fps: formData.fps ? parseInt(formData.fps) : null,
        season: formData.season ? parseInt(formData.season) : null,
        thumbnailUrl: null,
      };
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Create failed");
      toast({ title: "Video added to library" });
      onSuccess();
    } catch (err) {
      toast({ title: "Failed to add video", variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-6 mb-6 space-y-4 shadow-[0_0_20px_rgba(20,184,102,0.05)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-xl uppercase">Add New Video</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-2">Video File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleFileUpload}
          data-testid="input-admin-file"
        />
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-choose-file"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading {uploadProgress}%</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Choose File</>
            )}
          </Button>
          {formData.sourceUrl && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {formData.sourceUrl}
            </span>
          )}
        </div>
      </div>

      {/* Naming convention hint */}
      <div className="bg-secondary/30 border border-border/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/70 uppercase tracking-wider">Title Convention</p>
        <p><span className="text-foreground/60 font-mono">Last, First – Phase Tag – Brief Context Year</span></p>
        <p className="text-muted-foreground/60">e.g. <span className="font-mono">Judge, Aaron – Full Swing – HR to RF 2024</span> &nbsp;·&nbsp; <span className="font-mono">Ohtani, Shohei – Gather &gt; Touchdown – vs LHP 2023</span></p>
        <p className="text-muted-foreground/50">Context shorthand: <span className="font-mono">HR to [LF/CF/RF] · oppo gap · pull side · vs LHP/RHP · 2-strike · [mph] EV</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Title *</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Judge, Aaron – Full Swing – HR to RF 2024"
            className="bg-background"
            data-testid="input-add-title"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Linked Player</label>
          <select
            value={formData.playerId}
            onChange={(e) => {
              const player = players.find(p => p.id === e.target.value);
              setFormData(prev => ({
                ...prev,
                playerId: e.target.value,
                playerName: player?.name || prev.playerName,
              }));
            }}
            className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="select-add-player"
          >
            <option value="">None</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Player Name (display)</label>
          <Input
            value={formData.playerName}
            onChange={(e) => setFormData(prev => ({ ...prev, playerName: e.target.value }))}
            placeholder="Aaron Judge"
            className="bg-background"
            data-testid="input-add-player-name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Category / Phase Tag</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="select-add-category"
          >
            {allCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Duration</label>
          <Input
            value={formData.duration}
            onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
            placeholder="0:12"
            className="bg-background"
            data-testid="input-add-duration"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Season / Year</label>
          <Input
            type="number"
            value={formData.season}
            onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value }))}
            placeholder="2024"
            className="bg-background"
            data-testid="input-add-season"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Pro Video</label>
          <select
            value={formData.isProVideo ? "true" : "false"}
            onChange={(e) => setFormData(prev => ({ ...prev, isProVideo: e.target.value === "true" }))}
            className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="select-add-pro"
          >
            <option value="true">Yes (Pro Model)</option>
            <option value="false">No (User Upload)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">External URL (if not uploading file)</label>
        <Input
          value={formData.sourceUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, sourceUrl: e.target.value }))}
          placeholder="https://... or /uploads/filename.mp4"
          className="bg-background"
          data-testid="input-add-url"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} data-testid="button-submit-add">
          <Plus className="w-4 h-4 mr-2" /> Add to Library
        </Button>
      </div>
    </div>
  );
}

// ── Player components ─────────────────────────────────────────────────────────

function PlayerRow({ player, onDelete }: { player: MlbPlayer; onDelete: () => void }) {
  return (
    <div className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-secondary/20 transition-colors text-sm">
      <div className="col-span-1">
        {player.imageUrl ? (
          <img
            src={player.imageUrl}
            alt={player.name}
            className="w-8 h-8 rounded-full object-cover bg-secondary"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <Users className="w-4 h-4 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="col-span-3 font-medium truncate">{player.name}</div>
      <div className="col-span-1 text-muted-foreground text-xs">{player.team}</div>
      <div className="col-span-1">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">{player.position}</span>
      </div>
      <div className="col-span-1 text-muted-foreground text-xs">{player.bats}</div>
      <div className="col-span-2 text-muted-foreground font-mono text-xs">
        {player.avgExitVelo != null ? `${player.avgExitVelo.toFixed(1)} mph` : "—"}
      </div>
      <div className="col-span-1 text-muted-foreground font-mono text-xs">
        {player.barrelPct != null ? `${player.barrelPct.toFixed(1)}%` : "—"}
      </div>
      <div className="col-span-1 text-muted-foreground font-mono text-xs">
        {player.batSpeed != null ? `${player.batSpeed.toFixed(1)}` : "—"}
      </div>
      <div className="col-span-1 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-red-500"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function AddPlayerForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MlbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [savantAvailable, setSavantAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "", team: "", position: "", bats: "",
    height: "", weight: "", savantId: "", imageUrl: "",
    avgExitVelo: "", maxExitVelo: "", barrelPct: "", hardHitPct: "",
    avgExitVeloPercentile: "", maxExitVeloPercentile: "",
    barrelPctPercentile: "", hardHitPctPercentile: "",
    batSpeed: "", attackAngle: "", rotationalAccel: "",
    battingAvg: "", homeRuns: "", rbi: "", obp: "", slg: "", ops: "",
  });

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/mlb/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data: MlbSearchResult[] = await res.json();
          setSearchResults(data);
          setShowDropdown(data.length > 0);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (result: MlbSearchResult) => {
    setShowDropdown(false);
    setSearchQuery(result.name);
    setIsLookingUp(true);
    setSavantAvailable(null);
    try {
      const res = await fetch(`/api/mlb/lookup/${result.mlbId}`);
      if (!res.ok) throw new Error("Lookup failed");
      const data: MlbLookupResult = await res.json();
      setSavantAvailable(data.savantAvailable);
      setFormData({
        name:     data.name,
        team:     data.team,
        position: data.position,
        bats:     data.bats,
        height:   data.height ?? "",
        weight:   data.weight != null ? String(data.weight) : "",
        savantId: data.savantId,
        imageUrl: data.imageUrl,
        avgExitVelo:           data.avgExitVelo != null ? String(data.avgExitVelo) : "",
        maxExitVelo:           data.maxExitVelo != null ? String(data.maxExitVelo) : "",
        barrelPct:             data.barrelPct != null ? String(data.barrelPct) : "",
        hardHitPct:            data.hardHitPct != null ? String(data.hardHitPct) : "",
        avgExitVeloPercentile: "",
        maxExitVeloPercentile: "",
        barrelPctPercentile:   "",
        hardHitPctPercentile:  "",
        batSpeed:              data.batSpeed != null ? String(data.batSpeed) : "",
        attackAngle:           "",
        rotationalAccel:       "",
        battingAvg:  data.battingAvg != null ? String(data.battingAvg) : "",
        homeRuns:    data.homeRuns != null ? String(data.homeRuns) : "",
        rbi:         data.rbi != null ? String(data.rbi) : "",
        obp:         data.obp != null ? String(data.obp) : "",
        slg:         data.slg != null ? String(data.slg) : "",
        ops:         data.ops != null ? String(data.ops) : "",
      });
    } catch {
      toast({ title: "Failed to fetch player details", variant: "destructive" });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.team || !formData.position || !formData.bats) {
      toast({ title: "Name, team, position, and bats are required", variant: "destructive" });
      return;
    }
    const toFloat = (v: string) => v.trim() !== "" ? parseFloat(v) : null;
    const toInt   = (v: string) => v.trim() !== "" ? parseInt(v, 10) : null;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     formData.name,
          team:     formData.team,
          position: formData.position,
          bats:     formData.bats,
          height:   formData.height || null,
          weight:   toInt(formData.weight),
          savantId: formData.savantId || null,
          imageUrl: formData.imageUrl || null,
          avgExitVelo:           toFloat(formData.avgExitVelo),
          maxExitVelo:           toFloat(formData.maxExitVelo),
          barrelPct:             toFloat(formData.barrelPct),
          hardHitPct:            toFloat(formData.hardHitPct),
          avgExitVeloPercentile: toInt(formData.avgExitVeloPercentile),
          maxExitVeloPercentile: toInt(formData.maxExitVeloPercentile),
          barrelPctPercentile:   toInt(formData.barrelPctPercentile),
          hardHitPctPercentile:  toInt(formData.hardHitPctPercentile),
          batSpeed:              toFloat(formData.batSpeed),
          attackAngle:           toFloat(formData.attackAngle),
          rotationalAccel:       toFloat(formData.rotationalAccel),
          battingAvg:            toFloat(formData.battingAvg),
          homeRuns:              toInt(formData.homeRuns),
          rbi:                   toInt(formData.rbi),
          obp:                   toFloat(formData.obp),
          slg:                   toFloat(formData.slg),
          ops:                   toFloat(formData.ops),
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      toast({ title: `${formData.name} added to roster` });
      onSuccess();
    } catch {
      toast({ title: "Failed to add player", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-6 mb-6 space-y-5 shadow-[0_0_20px_rgba(20,184,102,0.05)]">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xl uppercase">Add Player</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* MLB Search */}
      <div ref={searchRef} className="relative">
        <label className="text-xs text-muted-foreground block mb-1">Search MLB Roster</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          {isSearching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a player name (e.g. Aaron Judge)..."
            className="pl-9 bg-background"
          />
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {searchResults.slice(0, 8).map((r) => (
              <button
                key={r.mlbId}
                className="w-full px-4 py-2.5 text-left hover:bg-secondary/50 transition-colors flex items-center justify-between text-sm"
                onClick={() => handleSelect(r)}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground text-xs">{r.team} · {r.position} · Bats {r.bats}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLookingUp && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Fetching stats from MLB & Baseball Savant...
        </div>
      )}

      {/* Savant badge */}
      {savantAvailable !== null && !isLookingUp && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          savantAvailable
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
        }`}>
          {savantAvailable ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Statcast data found — exit velocity &amp; bat speed auto-filled</>
          ) : (
            <><AlertCircle className="w-3.5 h-3.5" /> No Statcast data (player may be pre-2015 or below PA threshold) — enter stats manually</>
          )}
        </div>
      )}

      {/* Bio fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Name *</label>
          <Input value={formData.name} onChange={set("name")} placeholder="Aaron Judge" className="bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Team *</label>
          <Input value={formData.team} onChange={set("team")} placeholder="NYY" className="bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Position *</label>
          <Input value={formData.position} onChange={set("position")} placeholder="RF" className="bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Bats *</label>
          <select value={formData.bats} onChange={set("bats")} className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm">
            <option value="">—</option>
            <option value="R">Right</option>
            <option value="L">Left</option>
            <option value="S">Switch</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Height</label>
          <Input value={formData.height} onChange={set("height")} placeholder="6'7&quot;" className="bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Weight (lbs)</label>
          <Input type="number" value={formData.weight} onChange={set("weight")} placeholder="282" className="bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">MLB / Savant ID</label>
          <Input value={formData.savantId} onChange={set("savantId")} placeholder="592450" className="bg-background" />
        </div>
      </div>

      {/* Statcast fields */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statcast Metrics (2015+)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Avg Exit Velo</label>
            <Input type="number" step="0.1" value={formData.avgExitVelo} onChange={set("avgExitVelo")} placeholder="91.9" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max Exit Velo</label>
            <Input type="number" step="0.1" value={formData.maxExitVelo} onChange={set("maxExitVelo")} placeholder="114.4" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Barrel %</label>
            <Input type="number" step="0.1" value={formData.barrelPct} onChange={set("barrelPct")} placeholder="15.3" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hard Hit %</label>
            <Input type="number" step="0.1" value={formData.hardHitPct} onChange={set("hardHitPct")} placeholder="51.0" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Bat Speed (mph)</label>
            <Input type="number" step="0.1" value={formData.batSpeed} onChange={set("batSpeed")} placeholder="76.2" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Attack Angle (°)</label>
            <Input type="number" step="0.1" value={formData.attackAngle} onChange={set("attackAngle")} placeholder="12.5" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Rotational Accel</label>
            <Input type="number" step="0.1" value={formData.rotationalAccel} onChange={set("rotationalAccel")} placeholder="22.1" className="bg-background" />
          </div>
        </div>
      </div>

      {/* Traditional Stats */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Career Batting Stats</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">AVG</label>
            <Input type="number" step="0.001" min="0" max="1" value={formData.battingAvg} onChange={set("battingAvg")} placeholder=".285" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">HR</label>
            <Input type="number" min="0" value={formData.homeRuns} onChange={set("homeRuns")} placeholder="62" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">RBI</label>
            <Input type="number" min="0" value={formData.rbi} onChange={set("rbi")} placeholder="131" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">OBP</label>
            <Input type="number" step="0.001" min="0" max="1" value={formData.obp} onChange={set("obp")} placeholder=".376" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">SLG</label>
            <Input type="number" step="0.001" min="0" max="4" value={formData.slg} onChange={set("slg")} placeholder=".686" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">OPS</label>
            <Input type="number" step="0.001" min="0" max="5" value={formData.ops} onChange={set("ops")} placeholder=".1062" className="bg-background" />
          </div>
        </div>
      </div>

      {/* Percentile fields */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Percentile Rankings (enter manually from Savant)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Avg EV %ile</label>
            <Input type="number" min="0" max="100" value={formData.avgExitVeloPercentile} onChange={set("avgExitVeloPercentile")} placeholder="94" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max EV %ile</label>
            <Input type="number" min="0" max="100" value={formData.maxExitVeloPercentile} onChange={set("maxExitVeloPercentile")} placeholder="96" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Barrel %ile</label>
            <Input type="number" min="0" max="100" value={formData.barrelPctPercentile} onChange={set("barrelPctPercentile")} placeholder="98" className="bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hard Hit %ile</label>
            <Input type="number" min="0" max="100" value={formData.hardHitPctPercentile} onChange={set("hardHitPctPercentile")} placeholder="92" className="bg-background" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || isLookingUp}>
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
          Add to Roster
        </Button>
      </div>
    </div>
  );
}
