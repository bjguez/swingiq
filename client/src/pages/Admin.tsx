import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, fetchPlayers } from "@/lib/api";
import { useState, useRef } from "react";
import type { Video, MlbPlayer } from "@shared/schema";
import {
  Upload, Trash2, Pencil, Save, X, Plus, PlayCircle,
  Film, Loader2, CheckCircle2, AlertCircle, Search, Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const allCategories = [
  "Gather", "Touchdown", "Thrust", "Contact", "Post-Contact",
  "Hand Path", "Head Position", "Scissor Kick", "Full Swings"
];

const sourceOptions = ["MLB.com", "YouTube", "Upload", "Baseball Savant", "Other"];

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Video>>({});
  const [showAddForm, setShowAddForm] = useState(false);

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
    const matchCat = filterCategory === "All" || v.category === filterCategory;
    const matchSearch = !searchQuery ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.playerName?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

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
    updateMutation.mutate({ id: editingId, data: editData });
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
          <p className="text-muted-foreground">Upload, tag, and manage the SwingIQ video library.</p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="button-add-video"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Video
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Videos" value={allVideos.length} />
        <StatCard label="Pro Clips" value={proCount} />
        <StatCard label="User Uploads" value={uploadCount} />
        <StatCard label="With Files" value={withFileCount} />
      </div>

      {/* Add Video Form */}
      {showAddForm && (
        <AddVideoForm
          players={players}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
            setShowAddForm(false);
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
              ) : (
                <VideoRow
                  key={video.id}
                  video={video}
                  onEdit={() => startEdit(video)}
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
    </Layout>
  );
}

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

function VideoRow({ video, onEdit, onDelete, deleting }: { video: Video; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
            Pro Video
          </label>
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

      {/* File Upload */}
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

      {/* Meta Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Title *</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Judge - Powerful Drive to RF"
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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