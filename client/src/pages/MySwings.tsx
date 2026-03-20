import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, deleteVideo } from "@/lib/api";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { UserVideoCard } from "@/components/UserVideoCard";
import { Trash2, Upload, Film, Search } from "lucide-react";
import type { Video } from "@shared/schema";
import { ALL_USER_CATEGORIES } from "@/lib/categories";

export default function MySwings() {
  const queryClient = useQueryClient();
  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const userVideos = (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl);

  const filteredVideos = userVideos.filter(v => {
    const matchCategory = activeCategory === "All" || v.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      v.title.toLowerCase().includes(q) ||
      ((v as any).notes?.toLowerCase().includes(q)) ||
      ((v as any).tags?.some((t: string) => t.toLowerCase().includes(q)));
    return matchCategory && matchSearch;
  });

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
    const ids = [...selected];
    setDeleting(new Set(ids));
    await Promise.allSettled(ids.map(id => deleteVideo(id)));
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    setSelected(new Set());
    setDeleting(new Set());
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">My Library</span>
            <span className="text-sm text-muted-foreground">{userVideos.length} swing{userVideos.length !== 1 ? "s" : ""}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">My Swings</h1>
          <p className="text-muted-foreground">Your uploaded swing videos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {userVideos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => { setBulkMode(b => !b); clearSelection(); }}
            >
              {bulkMode ? "Cancel" : "Manage"}
            </Button>
          )}
          {bulkMode && selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting.size > 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selected.size} selected
            </Button>
          )}
          {bulkMode && (
            <Button variant="ghost" size="sm" onClick={selected.size === userVideos.length ? clearSelection : selectAll}>
              {selected.size === userVideos.length ? "Deselect All" : "Select All"}
            </Button>
          )}
          <VideoLibraryModal
            mode="user"
            trigger={
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                <Upload className="w-4 h-4 mr-2" />
                Upload Swing
              </Button>
            }
          />
        </div>
      </div>

      {/* Search + category filter */}
      {userVideos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, notes, tags…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["All", ...ALL_USER_CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
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
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-semibold text-lg">No swings uploaded yet</p>
            <p className="text-muted-foreground text-sm mt-1">Upload a swing from the Analysis page or use the button above.</p>
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <p className="text-muted-foreground text-sm">No swings match your search.</p>
          <button onClick={() => { setSearchQuery(""); setActiveCategory("All"); }} className="text-xs text-primary hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {bulkMode && (
            <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
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
              showDelete={true}
              showTrim={true}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
