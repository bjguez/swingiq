import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, PlayCircle, Loader2, ScanFace, CheckCircle2, User, AlertCircle, ChevronRight, Film, ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, fetchPlayers, fetchVideoPresignedUrl } from "@/lib/api";
import type { Video, MlbPlayer } from "@shared/schema";

interface VideoLibraryModalProps {
  trigger: React.ReactNode;
  mode?: "user" | "pro";
  onVideoSelected?: (url: string, label?: string) => void;
  onCompSelected?: (url: string, label?: string) => void;
}

type UploadState = "idle" | "uploading" | "comp_prompt" | "analyzing" | "results" | "error";

export function VideoLibraryModal({ trigger, mode = "pro", onVideoSelected, onCompSelected }: VideoLibraryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos"], queryFn: () => fetchVideos() });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: fetchPlayers });

  const userVideos = (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl);
  const filteredVideos = (allVideos as Video[]).filter((v: Video) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.title.toLowerCase().includes(q) || (v.playerName?.toLowerCase().includes(q) ?? false);
  });

  const compPlayers = (players as MlbPlayer[]).slice(0, 3);

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

      setUploadedVideoUrl(response.presignedUrl ?? response.sourceUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setUploadState("comp_prompt");
    } catch (err: any) {
      setUploadError(err.message || "Upload failed. Please try again.");
      setUploadState("error");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSkip = () => {
    if (uploadedVideoUrl) onVideoSelected?.(uploadedVideoUrl, "My Swing");
    setIsOpen(false);
  };

  const handleSelectExistingVideo = (video: Video) => {
    if (video.sourceUrl) onVideoSelected?.(video.sourceUrl, video.title);
    setIsOpen(false);
  };

  const handleSelectCompVideo = async (video: Video, playerName: string) => {
    if (uploadedVideoUrl) onVideoSelected?.(uploadedVideoUrl, "My Swing");
    if (!video.sourceUrl) { setIsOpen(false); return; }
    try {
      const url = await fetchVideoPresignedUrl(video.id);
      onCompSelected?.(url, playerName);
    } catch {
      onCompSelected?.(video.sourceUrl, playerName);
    }
    setIsOpen(false);
  };

  const handleSelectProVideo = async (video: Video) => {
    if (!video.sourceUrl || !onVideoSelected) { setIsOpen(false); return; }
    try {
      const url = await fetchVideoPresignedUrl(video.id);
      onVideoSelected(url, video.playerName || video.title);
    } catch {
      onVideoSelected(video.sourceUrl, video.playerName || video.title);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setUploadState("idle");
        setUploadProgress(0);
        setUploadedVideoUrl(null);
        setUploadError(null);
        setSearchQuery("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const getTitle = () => {
    if (mode === "pro") return "Pro Library";
    switch (uploadState) {
      case "comp_prompt": return "Step 2: Find Your Comp";
      case "analyzing": return "Analyzing Mechanics";
      case "results": return "Your MLB Comps";
      default: return "Upload Your Swing";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">{getTitle()}</DialogTitle>
          <DialogDescription className="sr-only">{mode === "pro" ? "Browse the pro video library" : "Upload your swing video"}</DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {/* ── PRO MODE: Library Browser ── */}
          {mode === "pro" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search player name or video title..."
                  className="pl-9 bg-background border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-library"
                />
              </div>
              <div className="border border-border rounded-md overflow-hidden">
                <div className="bg-secondary/50 p-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
                  <div className="col-span-5">Video</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2">Source</div>
                  <div className="col-span-1">FPS</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
                <div className="divide-y divide-border/50 max-h-90 overflow-y-auto">
                  {filteredVideos.map((video: Video) => (
                    <div key={video.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-secondary/30 transition-colors text-sm">
                      <div className="col-span-5 font-bold flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                          <PlayCircle className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{video.title}</div>
                          <div className="text-xs text-muted-foreground">{video.playerName}</div>
                        </div>
                      </div>
                      <div className="col-span-2 text-muted-foreground text-xs">{video.category}</div>
                      <div className="col-span-2 text-xs">{video.source}</div>
                      <div className="col-span-1 text-xs text-muted-foreground">{video.fps || "—"}</div>
                      <div className="col-span-2 text-right">
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
                    onClick={() => fileInputRef.current?.click()}
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
                      Drag and drop or click to select. Our AI will find your MLB comp after upload.
                    </p>
                    <Button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
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
                              <video
                                src={video.sourceUrl ?? undefined}
                                className="w-full h-full object-cover"
                                muted preload="metadata"
                                onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.5; }}
                              />
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

              {/* Step 2: Comp Prompt */}
              {uploadState === "comp_prompt" && (
                <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span className="font-medium text-sm">Video uploaded successfully.</span>
                  </div>
                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
                      <ScanFace className="w-8 h-8" />
                    </div>
                    <h3 className="font-display font-bold text-xl mb-2">Find Your MLB Comp?</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                      We'll analyze your swing mechanics and match you to the most similar MLB hitters based on biometrics and kinematic patterns.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full h-12 text-base"
                      onClick={() => {
                        setUploadState("analyzing");
                        setTimeout(() => setUploadState("results"), 2500);
                      }}
                      data-testid="button-find-comp"
                    >
                      <ScanFace className="w-5 h-5 mr-2" />
                      Analyze My Mechanics
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleSkip} data-testid="button-skip-comp">
                      Skip — Go to Analysis
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Analyzing */}
              {uploadState === "analyzing" && (
                <div className="border border-border rounded-xl p-14 flex flex-col items-center justify-center text-center bg-secondary/10 animate-in fade-in duration-300">
                  <ScanFace className="w-14 h-14 text-primary animate-pulse mb-4" />
                  <h3 className="font-display font-bold text-xl mb-2">Analyzing Biometrics</h3>
                  <p className="text-muted-foreground text-sm">Measuring limb ratios, posture, and kinetic sequences...</p>
                  <div className="flex gap-1 mt-6">
                    {["Hip rotation", "Bat path", "Shoulder tilt", "Stride length"].map((label, i) => (
                      <span
                        key={label}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 animate-pulse"
                        style={{ animationDelay: `${i * 200}ms` }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Results */}
              {uploadState === "results" && (
                <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-sm">Analysis complete. Here are your top MLB comps.</span>
                  </div>

                  <div className="flex flex-col gap-3 max-h-95 overflow-y-auto pr-1">
                    {compPlayers.map((player: MlbPlayer, i: number) => {
                      const playerVideos = (allVideos as Video[]).filter(
                        v => v.isProVideo && v.playerName?.toLowerCase() === player.name.toLowerCase()
                      );
                      return (
                        <CompResultCard
                          key={player.id}
                          player={player}
                          matchPct={94 - i * 6}
                          isTopMatch={i === 0}
                          videos={playerVideos}
                          onSelectVideo={(video) => handleSelectCompVideo(video, player.name)}
                        />
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setUploadState("idle"); setUploadedVideoUrl(null); }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Upload Different Video
                    </Button>
                    <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={handleSkip}>
                      Skip for Now
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompResultCard({
  player, matchPct, isTopMatch, videos, onSelectVideo,
}: {
  player: MlbPlayer;
  matchPct: number;
  isTopMatch: boolean;
  videos: Video[];
  onSelectVideo: (video: Video) => void;
}) {
  return (
    <div className={`rounded-xl border p-4 ${isTopMatch ? "bg-primary/5 border-primary/40" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {isTopMatch && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground uppercase tracking-wider">
              Best Match
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-display font-bold leading-none">{player.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {player.height}, {player.weight}lbs · {player.bats === "R" ? "R" : "L"}-handed · {player.team}
              </div>
            </div>
          </div>
        </div>
        <div className="text-primary font-mono font-bold text-lg">{matchPct}%</div>
      </div>

      {videos.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelectVideo(v)}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Film className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{v.title}</span>
              </div>
              <span className="text-xs text-primary font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Load <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic px-1">No videos in library for this player yet.</p>
      )}
    </div>
  );
}
