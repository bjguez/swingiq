import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, deleteVideo } from "@/lib/api";
import VideoTrimmer from "@/components/VideoTrimmer";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { Play, Trash2, Scissors, Upload, CheckSquare, Square, Film } from "lucide-react";
import type { Video } from "@shared/schema";

export default function MySwings() {
  const queryClient = useQueryClient();
  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });

  const userVideos = (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(userVideos.map(v => v.id)));
  const clearSelection = () => setSelected(new Set());

  const handleDelete = async (ids: string[]) => {
    setDeleting(new Set(ids));
    await Promise.allSettled(ids.map(id => deleteVideo(id)));
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    setSelected(new Set());
    setDeleting(new Set());
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    handleDelete([...selected]);
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
        <div className="flex items-center gap-2">
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {userVideos.map((video: Video) => {
            const isSelected = selected.has(video.id);
            const isDeleting = deleting.has(video.id);
            return (
              <div
                key={video.id}
                className={`relative bg-card border rounded-xl overflow-hidden transition-all group ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
              >
                {/* Bulk select checkbox */}
                {bulkMode && (
                  <button
                    onClick={() => toggleSelect(video.id)}
                    className="absolute top-2 left-2 z-20 text-white drop-shadow"
                  >
                    {isSelected
                      ? <CheckSquare className="w-5 h-5 text-primary" />
                      : <Square className="w-5 h-5 text-white/70" />
                    }
                  </button>
                )}

                <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                  <video
                    src={video.sourceUrl ?? undefined}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                    onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5; }}
                  />
                  {!bulkMode && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-primary rounded-full p-2">
                        <Play className="w-5 h-5 text-primary-foreground fill-current" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-sm font-medium truncate">{video.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Film className="w-3 h-3" />
                      <span>{video.category}</span>
                      {video.duration && <span>· {video.duration}</span>}
                    </div>
                    {!bulkMode && (
                      <div className="flex items-center gap-1">
                        {video.sourceUrl && (
                          <VideoTrimmer
                            videoId={video.id}
                            videoUrl={video.sourceUrl}
                            videoTitle={video.title}
                            trigger={
                              <button
                                className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                                title="Trim video"
                              >
                                <Scissors className="w-3.5 h-3.5" />
                              </button>
                            }
                          />
                        )}
                        <button
                          onClick={() => handleDelete([video.id])}
                          className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete video"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
