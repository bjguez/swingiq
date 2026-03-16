import { useState, useRef, useEffect } from "react";
import { Play, Pencil, Check, X, Trash2, Scissors, Film } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { renameVideo, deleteVideo } from "@/lib/api";
import VideoTrimmer from "./VideoTrimmer";
import type { Video } from "@shared/schema";
import { useLazySrc } from "@/hooks/use-lazy-src";

interface UserVideoCardProps {
  video: Video;
  onSelect?: (video: Video) => void;
  onDeleted?: (id: string) => void;
  showDelete?: boolean;
  showTrim?: boolean;
  selectable?: boolean;
  selected?: boolean;
  bulkMode?: boolean;
  onToggleSelect?: (id: string) => void;
  playLabel?: string;
}

export function UserVideoCard({
  video,
  onSelect,
  showDelete = true,
  showTrim = true,
  selectable = false,
  selected = false,
  bulkMode = false,
  onToggleSelect,
  playLabel,
}: UserVideoCardProps) {
  const queryClient = useQueryClient();
  const { ref: thumbRef, lazySrc: thumbSrc } = useLazySrc(video.sourceUrl);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleSaveTitle = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === video.title) {
      setTitle(video.title);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await renameVideo(video.id, trimmed);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    } catch {
      setTitle(video.title);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteVideo(video.id);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`relative bg-card border rounded-xl overflow-hidden transition-all group ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
      } ${deleting ? "opacity-40 pointer-events-none" : ""}`}
      onClick={bulkMode && onToggleSelect ? () => onToggleSelect(video.id) : undefined}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
        <video
          ref={thumbRef}
          src={thumbSrc}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5; }}
        />
        {!bulkMode && onSelect && (
          <button
            onClick={() => onSelect(video)}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {playLabel ? (
              <div className="bg-primary rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-primary-foreground fill-current" />
                <span className="text-primary-foreground text-xs font-semibold">{playLabel}</span>
              </div>
            ) : (
              <div className="bg-primary rounded-full p-2">
                <Play className="w-5 h-5 text-primary-foreground fill-current" />
              </div>
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {/* Editable title */}
        {editing ? (
          <div className="flex items-center gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") { setTitle(video.title); setEditing(false); }
              }}
              className="flex-1 text-sm font-medium bg-secondary/50 border border-border rounded px-2 py-0.5 focus:outline-none focus:border-primary min-w-0"
              disabled={saving}
            />
            <button onClick={handleSaveTitle} disabled={saving} className="p-1 rounded hover:bg-primary/20 text-primary">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setTitle(video.title); setEditing(false); }} className="p-1 rounded hover:bg-secondary text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mb-1 group/title">
            <p className="text-sm font-medium truncate flex-1">{title}</p>
            {!bulkMode && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="p-1 rounded opacity-0 group-hover/title:opacity-100 hover:bg-secondary text-muted-foreground transition-opacity shrink-0"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Film className="w-3 h-3 shrink-0" />
            <span>{video.category}</span>
            {(video as any).createdAt && (
              <span className="text-muted-foreground/60">· {formatDate((video as any).createdAt)}</span>
            )}
          </div>

          {!bulkMode && (showTrim || showDelete) && (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              {showTrim && video.sourceUrl && (
                <VideoTrimmer
                  videoId={video.id}
                  videoUrl={video.sourceUrl}
                  videoTitle={video.title}
                  trigger={
                    <button className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors" title="Trim">
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              )}
              {showDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
