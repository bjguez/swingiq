import { useState, useRef, useEffect } from "react";
import { useLazySrc } from "@/hooks/use-lazy-src";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, PlayCircle, Loader2, AlertCircle, Lock } from "lucide-react";
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

interface VideoLibraryModalProps {
  trigger: React.ReactNode;
  mode?: "user" | "pro";
  onVideoSelected?: (url: string, label?: string) => void;
  onCompSelected?: (url: string, label?: string) => void;
}

type UploadState = "idle" | "uploading" | "error" | "limit_reached";

export function VideoLibraryModal({ trigger, mode = "pro", onVideoSelected }: VideoLibraryModalProps) {
  const { user } = useAuth();
  const isPaid = user?.subscriptionTier === "paid";

  const [isOpen, setIsOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [pendingProVideo, setPendingProVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [handFilter, setHandFilter] = useState<"all" | "L" | "R" | "S">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos"], queryFn: () => fetchVideos(), enabled: mode === "pro" || !!user });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: fetchPlayers });

  const userVideos = (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl);

  // Build a name→bats lookup for filtering by handedness
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

  const handleUploadClick = () => {
    if (!user) {
      setAuthGateOpen(true);
      return;
    }
    if (!isPaid && userVideos.length >= FREE_UPLOAD_LIMIT) {
      setUploadState("limit_reached");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState("uploading");
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", file.name);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      });

      const response = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).message || "Upload failed")); }
            catch { reject(new Error("Upload failed")); }
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      const url = response.presignedUrl ?? response.sourceUrl;
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      onVideoSelected?.(url, "My Swing");
      setIsOpen(false);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed. Please try again.");
      setUploadState("error");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectExistingVideo = (video: Video) => {
    if (video.sourceUrl) onVideoSelected?.(video.sourceUrl, video.title);
    setIsOpen(false);
  };

  const doImportProVideo = async (video: Video) => {
    if (!video.sourceUrl || !onVideoSelected) { setIsOpen(false); return; }
    try {
      const url = await fetchVideoPresignedUrl(video.id);
      onVideoSelected(url, video.playerName || video.title);
    } catch {
      onVideoSelected(video.sourceUrl, video.playerName || video.title);
    }
    setIsOpen(false);
  };

  const handleSelectProVideo = (video: Video) => {
    if (!user) {
      setPendingProVideo(video);
      setAuthGateOpen(true);
    } else {
      doImportProVideo(video);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setUploadState("idle");
        setUploadProgress(0);
        setUploadError(null);
        setSearchQuery("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">
            {mode === "pro" ? "Pro Library" : "Upload Your Swing"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "pro" ? "Browse the pro video library" : "Upload your swing video"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {/* ── PRO MODE: Library Browser ── */}
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
                <div className="bg-secondary/50 p-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
                  <div className="col-span-7">Video</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-3 text-right">Action</div>
                </div>
                <div className="divide-y divide-border/50 max-h-90 overflow-y-auto">
                  {filteredVideos.map((video: Video) => (
                    <div key={video.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-secondary/30 transition-colors text-sm">
                      <div className="col-span-7 font-bold flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                          <PlayCircle className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{video.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            {video.playerName}
                            {video.playerName && playerBatsMap.get(video.playerName.toLowerCase()) && (
                              <span className="px-1 py-0.5 rounded text-[10px] bg-secondary/70 text-muted-foreground font-mono">
                                {playerBatsMap.get(video.playerName.toLowerCase())}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 text-muted-foreground text-xs">{video.category}</div>
                      <div className="col-span-3 text-right">
                        <Button
                          size="sm" variant="outline"
                          className="border-primary/50 text-primary hover:bg-primary/20 hover:text-primary h-8"
                          onClick={() => handleSelectProVideo(video)}
                          data-testid={`button-import-${video.id}`}
                        >
                          Import
                        </Button>
                      </div>
                    </div>
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
                  <Button onClick={() => setUploadState("idle")}>Go Back</Button>
                </div>
              )}

              {/* Step 1: Upload */}
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
                      Drag and drop or click to select a video file.
                    </p>
                    <Button onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
                      Select File
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">MP4, MOV, WebM up to 500MB</p>
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
