import { useState, useRef, useEffect } from "react";
import { Play, Pencil, Check, X, Trash2, Scissors, Film, StickyNote, Tag, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { renameVideo, deleteVideo, updateVideoNotes } from "@/lib/api";
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

  // Swing Notes
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState((video as any).notes || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>((video as any).tags || []);
  const [savingNotes, setSavingNotes] = useState(false);

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

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateVideoNotes(video.id, notes, tags);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setNotesOpen(false);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

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

          {!bulkMode && (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); setNotesOpen(o => !o); }}
                    className={`p-1.5 rounded transition-colors ${notesOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-50 space-y-1">
                  {notes ? (
                    <p className="text-xs leading-snug line-clamp-4">{notes}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No notes yet</p>
                  )}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {tags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">#{tag}</span>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
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

        {/* Existing tags preview (collapsed) */}
        {!notesOpen && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">#{tag}</span>
            ))}
          </div>
        )}
        {!notesOpen && notes && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">{notes}</p>
        )}

        {/* Swing Notes panel */}
        {notesOpen && !bulkMode && (
          <div className="mt-2 space-y-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note about this swing..."
              className="w-full text-xs bg-secondary/30 border border-border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              rows={2}
            />
            <div>
              <div className="flex flex-wrap gap-1 mb-1">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-destructive ml-0.5"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag, press Enter"
                className="w-full text-xs bg-secondary/30 border border-border rounded-md px-2 py-1.5 focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-1.5 justify-end">
              <button onClick={() => setNotesOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md font-semibold disabled:opacity-50"
              >
                {savingNotes ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
