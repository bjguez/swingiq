import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FREE_CATEGORIES, PRO_CATEGORIES } from "@/lib/categories";
import { useLazySrc } from "@/hooks/use-lazy-src";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, PlayCircle, Loader2, AlertCircle, Lock, Scissors, Play, Pause } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, fetchPlayers, fetchVideoPresignedUrl } from "@/lib/api";
import type { Video, MlbPlayer } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AuthGateModal } from "@/components/AuthGateModal";

function ModalThumb({ src }: { src: string }) {
  const { ref, lazySrc } = useLazySrc(src);
  return (
    <video
      ref={ref}
      src={lazySrc}
      className="w-full h-full object-cover"
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5; }}
    />
  );
}

const FREE_UPLOAD_LIMIT = 5;
const MAX_CLIP_DURATION = 5;

interface VideoLibraryModalProps {
  trigger: React.ReactNode;
  mode?: "user" | "pro";
  onVideoSelected?: (url: string, label?: string, id?: string, thumbnailUrl?: string | null) => void;
  onCompSelected?: (url: string, label?: string) => void;
}

type UploadState = "idle" | "trim_required" | "uploading" | "error" | "limit_reached";

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration); v.src = ""; };
    v.onerror = () => resolve(0);
    v.src = url;
  });
}

export function VideoLibraryModal({ trigger, mode = "pro", onVideoSelected }: VideoLibraryModalProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isPaid = user?.isAdmin || user?.subscriptionTier === "player" || user?.subscriptionTier === "pro";

  const [isOpen, setIsOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [pendingProVideo, setPendingProVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [handFilter, setHandFilter] = useState<"all" | "L" | "R" | "S">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState("Full Swing");

  const availableCategories = [
    ...FREE_CATEGORIES,
    ...(user?.isAdmin || user?.subscriptionTier === "pro" ? PRO_CATEGORIES : []),
  ];

  // Trim state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [trimObjectUrl, setTrimObjectUrl] = useState<string | null>(null);
  const [trimDuration, setTrimDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_CLIP_DURATION);
  const [trimPlaying, setTrimPlaying] = useState(false);
  const trimVideoRef = useRef<HTMLVideoElement>(null);
  const trimTrackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | "middle" | null>(null);
  const dragAnchorRef = useRef<{ x: number; start: number; end: number } | null>(null);

  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos", mode === "pro" ? "coaching" : undefined], queryFn: () => mode === "pro" ? fetchVideos(undefined, "coaching") : fetchVideos(), enabled: mode === "pro" || !!user });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: fetchPlayers });

  const userVideos = (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl);

  const playerBatsMap = new Map<string, string>(
    (players as MlbPlayer[]).map(p => [p.name.toLowerCase(), p.bats ?? ""])
  );

  const filteredVideos = (allVideos as Video[]).filter((v: Video) => {
    if (!v.isProVideo || !v.sourceUrl) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!v.title.toLowerCase().includes(q) && !(v.playerName?.toLowerCase().includes(q) ?? false)) return false;
    }
    if (handFilter !== "all" && v.playerName) {
      const bats = playerBatsMap.get(v.playerName.toLowerCase());
      if (bats !== handFilter) return false;
    }
    return true;
  });

  const doUpload = useCallback(async (file: File, startTime?: number, endTime?: number) => {
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadError(null);

    const needsTrim = startTime !== undefined && endTime !== undefined;

    try {
      let url: string;
      let thumbnailUrl: string | null = null;

      if (needsTrim) {
        // Trim requires server-side FFmpeg — send to server as before
        const formData = new FormData();
        formData.append("video", file);
        formData.append("category", uploadCategory);
        formData.append("startTime", startTime!.toString());
        formData.append("endTime", endTime!.toString());

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        });

        const response = await new Promise<any>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else { try { reject(new Error(JSON.parse(xhr.responseText).message || "Upload failed")); } catch { reject(new Error("Upload failed")); } }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        url = response.presignedUrl ?? response.sourceUrl;
        thumbnailUrl = response.thumbnailUrl ?? null;
      } else {
        // Streaming upload: browser → our server (same-origin, no CORS) → R2 (streamed, no buffering)
        // Step 1: PUT file to our server which streams it straight to R2
        const { key } = await new Promise<{ key: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (ev) => {
            if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          });
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else { try { reject(new Error(JSON.parse(xhr.responseText).message || "Upload failed")); } catch { reject(new Error("Upload failed")); } }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.open("PUT", "/api/upload/direct");
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.send(file);
        });

        // Step 2: confirm — server creates the DB record
        const confirmRes = await fetch("/api/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, category: uploadCategory }),
        });
        if (!confirmRes.ok) {
          const err = await confirmRes.json().catch(() => ({}));
          throw new Error((err as any).message || "Failed to save video");
        }
        const video = await confirmRes.json();
        url = video.presignedUrl ?? video.sourceUrl;
        thumbnailUrl = video.thumbnailUrl ?? null;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      onVideoSelected?.(url, "My Swing", undefined, thumbnailUrl);
      setIsOpen(false);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed. Please try again.");
      setUploadState("error");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onVideoSelected, queryClient, uploadCategory]);

  const handleUploadClick = () => {
    if (!user) { setAuthGateOpen(true); return; }
    if (!isPaid && userVideos.length >= FREE_UPLOAD_LIMIT) { setUploadState("limit_reached"); return; }
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const objectUrl = URL.createObjectURL(file);
    const duration = await getVideoDuration(objectUrl);

    if (duration > MAX_CLIP_DURATION) {
      setPendingFile(file);
      setTrimObjectUrl(objectUrl);
      setTrimDuration(duration);
      setTrimStart(0);
      setTrimEnd(MAX_CLIP_DURATION);
      setUploadState("trim_required");
    } else {
      URL.revokeObjectURL(objectUrl);
      await doUpload(file);
    }
  };

  const handleSelectExistingVideo = (video: Video) => {
    if (video.sourceUrl) onVideoSelected?.(video.sourceUrl, video.title, video.id, video.thumbnailUrl);
    setIsOpen(false);
  };

  const doImportProVideo = async (video: Video) => {
    if (!video.sourceUrl || !onVideoSelected) { setIsOpen(false); return; }
    try {
      const url = await fetchVideoPresignedUrl(video.id);
      onVideoSelected(url, video.playerName || video.title, video.id, video.thumbnailUrl);
    } catch {
      onVideoSelected(video.sourceUrl, video.playerName || video.title, video.id, video.thumbnailUrl);
    }
    setIsOpen(false);
  };

  const handleSelectProVideo = (video: Video) => {
    if (!user) { setPendingProVideo(video); setAuthGateOpen(true); }
    else if (!isPaid) { setUpgradePromptOpen(true); }
    else doImportProVideo(video);
  };

  // Trim drag handlers
  const handleTrimPointerDown = (handle: "start" | "end" | "middle") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = handle;
    dragAnchorRef.current = { x: e.clientX, start: trimStart, end: trimEnd };

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current || !trimTrackRef.current || !dragAnchorRef.current) return;
      const rect = trimTrackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const t = ratio * trimDuration;

      if (draggingRef.current === "start") {
        const newStart = Math.max(0, Math.min(t, trimEnd - 0.1));
        setTrimStart(newStart);
        if (trimEnd - newStart > MAX_CLIP_DURATION) setTrimEnd(newStart + MAX_CLIP_DURATION);
        if (trimVideoRef.current) trimVideoRef.current.currentTime = newStart;
      } else if (draggingRef.current === "end") {
        const newEnd = Math.min(trimDuration, Math.max(t, trimStart + 0.1));
        setTrimEnd(newEnd);
        if (newEnd - trimStart > MAX_CLIP_DURATION) {
          setTrimStart(Math.max(0, newEnd - MAX_CLIP_DURATION));
        }
        if (trimVideoRef.current && trimVideoRef.current.currentTime > newEnd) {
          trimVideoRef.current.currentTime = Math.max(0, newEnd - MAX_CLIP_DURATION);
        }
      } else {
        // Middle drag: slide the entire window
        const delta = ((ev.clientX - dragAnchorRef.current.x) / rect.width) * trimDuration;
        const windowSize = dragAnchorRef.current.end - dragAnchorRef.current.start;
        const newStart = Math.max(0, Math.min(trimDuration - windowSize, dragAnchorRef.current.start + delta));
        const newEnd = newStart + windowSize;
        setTrimStart(newStart);
        setTrimEnd(newEnd);
        if (trimVideoRef.current) trimVideoRef.current.currentTime = newStart;
      }
    };

    const onUp = () => {
      draggingRef.current = null;
      dragAnchorRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  // Keep trim video within bounds during playback
  const handleTrimTimeUpdate = () => {
    const v = trimVideoRef.current;
    if (!v) return;
    if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimStart; setTrimPlaying(false); }
  };

  const toggleTrimPlay = () => {
    const v = trimVideoRef.current;
    if (!v) return;
    if (trimPlaying) { v.pause(); setTrimPlaying(false); }
    else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart;
      v.play(); setTrimPlaying(true);
    }
  };

  const pct = (t: number) => trimDuration > 0 ? (t / trimDuration) * 100 : 0;
  const clipDuration = trimEnd - trimStart;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setUploadState("idle");
        setUploadProgress(0);
        setUploadError(null);
        setSearchQuery("");
        if (trimObjectUrl) { URL.revokeObjectURL(trimObjectUrl); setTrimObjectUrl(null); }
        setPendingFile(null);
        setTrimPlaying(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, trimObjectUrl]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">
            {mode === "pro" ? "Pro Library" : uploadState === "trim_required" ? "Trim Your Clip" : "Upload Your Swing"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "pro" ? "Browse the pro video library" : "Upload your swing video"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {/* ── PRO MODE ── */}
          {mode === "pro" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search player name or video title..."
                    className="pl-9 bg-background border-border"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-library"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-1 shrink-0">
                  {(["all", "L", "R", "S"] as const).map(h => (
                    <button
                      key={h}
                      onClick={() => setHandFilter(h)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        handFilter === h
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                      title={h === "all" ? "All hitters" : h === "L" ? "Left-handed" : h === "R" ? "Right-handed" : "Switch hitters"}
                    >
                      {h === "all" ? "All" : `Bats ${h}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-border rounded-md overflow-hidden">
                <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
                  {filteredVideos.map((video: Video) => (
                    <button
                      key={video.id}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/30 active:bg-secondary/50 transition-colors text-left"
                      onClick={() => handleSelectProVideo(video)}
                      data-testid={`button-import-${video.id}`}
                    >
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
                        {video.thumbnailUrl
                          ? <img src={video.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                          : <PlayCircle className="w-5 h-5 text-primary" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-foreground truncate">{video.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          {video.playerName}
                          {video.playerName && playerBatsMap.get(video.playerName.toLowerCase()) && (
                            <span className="px-1 py-0.5 rounded text-[10px] bg-secondary/70 font-mono">
                              {playerBatsMap.get(video.playerName.toLowerCase())}
                            </span>
                          )}
                        </div>
                      </div>
                      <PlayCircle className="w-5 h-5 text-primary shrink-0" />
                    </button>
                  ))}
                  {filteredVideos.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">No videos found.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── USER MODE ── */}
          {mode === "user" && (
            <>
              {/* Limit reached */}
              {uploadState === "limit_reached" && (
                <div className="border border-yellow-500/30 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-yellow-500/5">
                  <Lock className="w-12 h-12 text-yellow-500 mb-4" />
                  <h3 className="font-display font-bold text-xl mb-2">Free Limit Reached</h3>
                  <p className="text-muted-foreground text-sm mb-4">You've used all {FREE_UPLOAD_LIMIT} free swing uploads. Upgrade to continue uploading and unlock all features.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate("/pricing")}>Upgrade</Button>
                    <Button variant="outline" onClick={() => setUploadState("idle")}>Go Back</Button>
                  </div>
                </div>
              )}

              {/* Trim required */}
              {uploadState === "trim_required" && trimObjectUrl && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your video is <span className="text-foreground font-semibold">{formatTime(trimDuration)}</span> long. Select a <span className="text-primary font-semibold">5-second clip</span> to upload.
                  </p>

                  <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
                    <video
                      ref={trimVideoRef}
                      src={trimObjectUrl}
                      className="w-full h-full object-contain"
                      playsInline
                      muted
                      preload="auto"
                      onTimeUpdate={handleTrimTimeUpdate}
                    />
                    <button
                      onClick={toggleTrimPlay}
                      className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/80 rounded-full p-2 transition-colors"
                    >
                      {trimPlaying
                        ? <Pause className="w-4 h-4 text-white" />
                        : <Play className="w-4 h-4 text-white" />}
                    </button>
                  </div>

                  {/* Trim track */}
                  <div
                    ref={trimTrackRef}
                    className="relative h-12 bg-secondary rounded-lg overflow-hidden select-none"
                  >
                    {/* Selected region — draggable middle */}
                    <div
                      className="absolute inset-y-0 bg-primary/20 border-x-2 border-primary cursor-grab active:cursor-grabbing z-10"
                      style={{ left: `${pct(trimStart)}%`, width: `${pct(trimEnd) - pct(trimStart)}%` }}
                      onPointerDown={handleTrimPointerDown("middle")}
                    />
                    {/* Start handle */}
                    <div
                      className="absolute top-0 bottom-0 w-4 cursor-col-resize z-20 flex items-center justify-center group"
                      style={{ left: `calc(${pct(trimStart)}% - 8px)` }}
                      onPointerDown={handleTrimPointerDown("start")}
                    >
                      <div className="w-1.5 h-8 bg-primary rounded-full group-hover:bg-primary/80 shadow-lg" />
                    </div>
                    {/* End handle */}
                    <div
                      className="absolute top-0 bottom-0 w-4 cursor-col-resize z-20 flex items-center justify-center group"
                      style={{ left: `calc(${pct(trimEnd)}% - 8px)` }}
                      onPointerDown={handleTrimPointerDown("end")}
                    >
                      <div className="w-1.5 h-8 bg-primary rounded-full group-hover:bg-primary/80 shadow-lg" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex gap-3">
                      <span className="text-muted-foreground">Start: <span className="text-foreground">{formatTime(trimStart)}</span></span>
                      <span className="text-muted-foreground">End: <span className="text-foreground">{formatTime(trimEnd)}</span></span>
                    </div>
                    <span className={`font-bold ${clipDuration > MAX_CLIP_DURATION ? "text-destructive" : "text-primary"}`}>
                      Clip: {formatTime(clipDuration)}
                    </span>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setUploadState("idle"); if (trimObjectUrl) URL.revokeObjectURL(trimObjectUrl); setTrimObjectUrl(null); setPendingFile(null); }}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => pendingFile && doUpload(pendingFile, trimStart, trimEnd)}
                      disabled={clipDuration > MAX_CLIP_DURATION || !pendingFile}
                      className="gap-2"
                    >
                      <Scissors className="w-4 h-4" />
                      Upload {formatTime(clipDuration)} Clip
                    </Button>
                  </div>
                </div>
              )}

              {/* Idle: upload drop zone + previous swings */}
              {uploadState === "idle" && (
                <div className="flex flex-col gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-file-upload"
                  />
                  {/* Category picker */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Swing Type</p>
                    <div className="flex flex-wrap gap-2">
                      {availableCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setUploadCategory(cat)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${uploadCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    onClick={handleUploadClick}
                    className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
                    data-testid="dropzone-upload"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file && fileInputRef.current) {
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        fileInputRef.current.files = dt.files;
                        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                      }
                    }}
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-3 text-primary">
                      <Upload className="w-7 h-7" />
                    </div>
                    <h3 className="font-display font-bold text-xl mb-1">Upload New Swing</h3>
                    <p className="text-muted-foreground text-sm max-w-xs mb-4">
                      Drag and drop or click to select a video file. Max 5 seconds.
                    </p>
                    <Button onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
                      Select File
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">MP4, MOV, WebM · Max 5 seconds</p>
                  </div>

                  {userVideos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Or load a previous swing</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-45 overflow-y-auto pr-1">
                        {userVideos.map((video: Video) => (
                          <button
                            key={video.id}
                            onClick={() => handleSelectExistingVideo(video)}
                            className="text-left bg-secondary/30 border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group"
                          >
                            <div className="aspect-video bg-black relative flex items-center justify-center">
                              {video.sourceUrl && <ModalThumb src={video.sourceUrl} />}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-primary rounded-full p-1.5">
                                  <PlayCircle className="w-4 h-4 text-primary-foreground" />
                                </div>
                              </div>
                            </div>
                            <div className="p-2">
                              <p className="text-xs font-medium truncate">{video.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Uploading */}
              {uploadState === "uploading" && (
                <div className="border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <h3 className="font-display font-bold text-xl mb-4">Uploading Video...</h3>
                  <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{uploadProgress}%</p>
                </div>
              )}

              {/* Error */}
              {uploadState === "error" && (
                <div className="border border-destructive/50 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-destructive/5">
                  <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                  <h3 className="font-display font-bold text-xl mb-2">Upload Failed</h3>
                  <p className="text-muted-foreground text-sm mb-4">{uploadError}</p>
                  <Button onClick={() => { setUploadState("idle"); setUploadError(null); }}>Try Again</Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen}>
      <DialogContent className="max-w-sm bg-card border-border text-foreground text-center">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wider">Upgrade to Compare</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mt-1">
            Side-by-side pro comparisons are available on the <strong className="text-foreground">Player</strong> plan. Upgrade to unlock the full pro library and compare your swing against any MLB hitter.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button className="w-full" onClick={() => { setUpgradePromptOpen(false); setIsOpen(false); navigate("/pricing"); }}>
            View Plans
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setUpgradePromptOpen(false)}>
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <AuthGateModal
      open={authGateOpen}
      onOpenChange={setAuthGateOpen}
      reason={pendingProVideo ? "Sign in to load a pro swing for comparison." : "Free to analyze — no credit card required. Create an account to upload and save your swings."}
      onSuccess={() => {
        if (pendingProVideo) { doImportProVideo(pendingProVideo); setPendingProVideo(null); }
        else fileInputRef.current?.click();
      }}
    />
    </>
  );
}
