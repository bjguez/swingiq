import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, fetchPlayers } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import type { Video, MlbPlayer } from "@shared/schema";
import {
  Upload, Trash2, Pencil, Save, X, Plus, PlayCircle,
  Film, Loader2, CheckCircle2, AlertCircle, Search, Filter,
  Users, UserPlus, Scissors,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const allCategories = [
  "Gather > Touchdown", "Touchdown > Finish",
  "Hand Path", "Head Position", "Scissor Kick", "Thrust", "Full Swings"
];

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
  savantAvailable: boolean;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"videos" | "uploads" | "players">("videos");

  // Video state
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Video>>({});
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);

  // Player state
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);

  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["/api/players"],
    queryFn: fetchPlayers,
  });

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

  const filtered = allVideos.filter((v: Video) => {
    if (!v.isProVideo) return false;
    const matchCat = filterCategory === "All" || v.category === filterCategory;
    const matchSearch = !searchQuery ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.playerName?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const userUploads = (allVideos as Video[]).filter(v => !v.isProVideo);

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
    };
    updateMutation.mutate({ id: editingId, data: payload as Partial<Video> });
  };

  const proCount = allVideos.filter((v: Video) => v.isProVideo).length;
  const uploadCount = allVideos.filter((v: Video) => !v.isProVideo).length;
  const withFileCount = allVideos.filter((v: Video) => v.sourceUrl).length;

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
      <div className="flex border-b border-border mb-6">
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
          onClick={() => setActiveTab("uploads")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "uploads"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          User Uploads
          {uploadCount > 0 && (
            <span className="ml-2 text-xs bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">{uploadCount}</span>
          )}
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
      </div>

      {/* ── VIDEOS TAB ── */}
      {activeTab === "videos" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 mr-4">
              <StatCard label="Total Videos" value={allVideos.length} />
              <StatCard label="Pro Clips" value={proCount} />
              <StatCard label="User Uploads" value={uploadCount} />
              <StatCard label="With Files" value={withFileCount} />
            </div>
            <Button
              onClick={() => setShowAddVideoForm(!showAddVideoForm)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              data-testid="button-add-video"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Video
            </Button>
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
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterPill label="All" active={filterCategory === "All"} onClick={() => setFilterCategory("All")} count={allVideos.length} />
              {allCategories.map(cat => {
                const count = allVideos.filter((v: Video) => v.category === cat).length;
                return <FilterPill key={cat} label={cat} active={filterCategory === cat} onClick={() => setFilterCategory(cat)} count={count} />;
              })}
            </div>
          </div>

          {/* Videos Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider items-center">
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Player</div>
              <div className="col-span-1">Category</div>
              <div className="col-span-1">Source</div>
              <div className="col-span-1">FPS</div>
              <div className="col-span-1">Duration</div>
              <div className="col-span-1">File</div>
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
                      video={video}
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
        </>
      )}

      {/* ── USER UPLOADS TAB ── */}
      {activeTab === "uploads" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Uploads" value={uploadCount} />
            <StatCard label="With Files" value={userUploads.filter(v => !!v.sourceUrl).length} />
            <StatCard label="With Source URL" value={userUploads.filter(v => !!v.sourceUrl).length} />
          </div>
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
              <div className="col-span-4">Title</div>
              <div className="col-span-3">Uploaded</div>
              <div className="col-span-3">File</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
              {userUploads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No user uploads yet.</div>
              ) : userUploads.map((video: Video) => (
                <div key={video.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-secondary/20">
                  <div className="col-span-4 text-sm font-medium truncate">{video.title}</div>
                  <div className="col-span-3 text-xs text-muted-foreground">
                    {(video as any).createdAt
                      ? new Date((video as any).createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </div>
                  <div className="col-span-3 text-xs text-muted-foreground truncate">
                    {video.sourceUrl ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> R2 stored
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" /> No file
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete "${video.title}"?`)) deleteMutation.mutate(video.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── PLAYERS TAB ── */}
      {activeTab === "players" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 mr-4">
              <StatCard label="Total Players" value={players.length} />
              <StatCard label="With Statcast" value={players.filter((p: MlbPlayer) => p.avgExitVelo != null).length} />
              <StatCard label="With Bat Speed" value={players.filter((p: MlbPlayer) => p.batSpeed != null).length} />
            </div>
            <Button
              onClick={() => setShowAddPlayerForm(!showAddPlayerForm)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </div>

          {showAddPlayerForm && (
            <AddPlayerForm
              onClose={() => setShowAddPlayerForm(false)}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/players"] });
                setShowAddPlayerForm(false);
              }}
            />
          )}

          {/* Players Table */}
          <div className="border border-border rounded-xl overflow-hidden">
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
              {players.map((player: MlbPlayer) => (
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
        </>
      )}
    </Layout>
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

function VideoRow({ video, onEdit, onTrim, onDelete, deleting }: { video: Video; onEdit: () => void; onTrim: () => void; onDelete: () => void; deleting: boolean }) {
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
      <div className="col-span-1 text-muted-foreground text-xs">{video.source}</div>
      <div className="col-span-1 text-muted-foreground text-xs font-mono">{video.fps || "—"}</div>
      <div className="col-span-1 text-muted-foreground text-xs font-mono">{video.duration || "—"}</div>
      <div className="col-span-1">
        {video.sourceUrl ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-yellow-500/50" />
        )}
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

function EditRow({ video, editData, setEditData, players, onSave, onCancel, saving }: {
  video: Video;
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
          <label className="text-xs text-muted-foreground block mb-1">Source</label>
          <select
            value={editData.source || ""}
            onChange={(e) => setEditData({ ...editData, source: e.target.value })}
            className="w-full h-9 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="edit-source"
          >
            {sourceOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">FPS</label>
          <Input
            type="number"
            value={editData.fps || ""}
            onChange={(e) => setEditData({ ...editData, fps: parseInt(e.target.value) || null })}
            className="h-9 bg-background"
            data-testid="edit-fps"
          />
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
    category: "Full Swings",
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
          <label className="text-xs text-muted-foreground block mb-1">Source</label>
          <select
            value={formData.source}
            onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
            className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm"
            data-testid="select-add-source"
          >
            {sourceOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">FPS</label>
          <Input
            type="number"
            value={formData.fps}
            onChange={(e) => setFormData(prev => ({ ...prev, fps: e.target.value }))}
            placeholder="120"
            className="bg-background"
            data-testid="input-add-fps"
          />
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
