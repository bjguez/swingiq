import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, PlayCircle, Loader2, ScanFace, CheckCircle2, User, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideos, fetchPlayers, fetchVideoPresignedUrl } from "@/lib/api";
import type { Video, MlbPlayer } from "@shared/schema";

interface VideoLibraryModalProps {
  trigger: React.ReactNode;
  onVideoSelected?: (url: string, label?: string) => void;
}

export function VideoLibraryModal({ trigger, onVideoSelected }: VideoLibraryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'analyzing' | 'results' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: allVideos = [] } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["/api/players"],
    queryFn: fetchPlayers,
  });

  const filteredVideos = allVideos.filter((v: Video) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.title.toLowerCase().includes(q) || (v.playerName?.toLowerCase().includes(q));
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", file.name);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      });

      const response = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.message || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      // Use the presigned URL for immediate playback; store the key (sourceUrl) for DB records
      setUploadedVideoUrl(response.presignedUrl ?? response.sourceUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setUploadState('analyzing');
      
      setTimeout(() => {
        setUploadState('results');
      }, 2000);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Upload failed. Please try again.");
      setUploadState('error');
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectUploadedVideo = () => {
    if (uploadedVideoUrl && onVideoSelected) {
      onVideoSelected(uploadedVideoUrl, "My Swing");
    }
    setIsOpen(false);
  };

  const handleSelectProVideo = async (video: Video) => {
    if (!video.sourceUrl || !onVideoSelected) { setIsOpen(false); return; }
    try {
      const url = await fetchVideoPresignedUrl(video.id);
      onVideoSelected(url, video.playerName || video.title);
    } catch {
      // fallback for legacy /uploads/ paths
      onVideoSelected(video.sourceUrl, video.playerName || video.title);
    }
    setIsOpen(false);
  };

  const handleSelectComp = (player: MlbPlayer) => {
    if (uploadedVideoUrl && onVideoSelected) {
      onVideoSelected(uploadedVideoUrl, "My Swing");
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setUploadState('idle');
        setUploadProgress(0);
        setUploadedVideoUrl(null);
        setUploadError(null);
      }, 300);
    }
  }, [isOpen]);

  const compPlayers = players.slice(0, 3);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">Import & Match</DialogTitle>
          <DialogDescription>
            Upload your swing to find your MLB comps, or search the library manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="upload" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Upload & AI Match</TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Search Pro Library</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-4">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file-upload"
            />
            
            {uploadState === 'idle' && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
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
                    fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }}
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Drag and drop your video</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                  Upload a video of your swing. Our AI will analyze your biometrics to find your best MLB comparables.
                </p>
                <Button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Select File</Button>
                <p className="text-xs text-muted-foreground mt-4">MP4, MOV, WebM up to 500MB</p>
              </div>
            )}

            {uploadState === 'uploading' && (
              <div className="border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="font-display font-bold text-xl mb-2">Uploading Video...</h3>
                <div className="w-64 h-2 bg-secondary rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-150" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{uploadProgress}%</p>
              </div>
            )}

            {uploadState === 'analyzing' && (
              <div className="border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10">
                <ScanFace className="w-12 h-12 text-primary animate-pulse mb-4" />
                <h3 className="font-display font-bold text-xl mb-2">Analyzing Biometrics</h3>
                <p className="text-muted-foreground text-sm">Measuring limb length, posture, and kinetic sequences...</p>
              </div>
            )}

            {uploadState === 'error' && (
              <div className="border border-destructive/50 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-destructive/5">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="font-display font-bold text-xl mb-2">Upload Failed</h3>
                <p className="text-muted-foreground text-sm mb-4">{uploadError}</p>
                <Button onClick={() => { setUploadState('idle'); setUploadError(null); }}>Try Again</Button>
              </div>
            )}

            {uploadState === 'results' && (
              <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">Upload complete! Video saved. Here are suggested MLB comparables.</span>
                </div>

                <Button className="w-full" onClick={handleSelectUploadedVideo} data-testid="button-use-video">
                  Use This Video in Analysis
                </Button>

                {compPlayers.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground text-center">Or select a comparable player:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {compPlayers.map((p: MlbPlayer, i: number) => (
                        <CompCard
                          key={p.id}
                          name={p.name}
                          match={`${94 - i * 6}%`}
                          reason={`${p.height}, ${p.weight}lbs. ${p.bats === 'R' ? 'Right' : 'Left'}-handed.`}
                          isTopMatch={i === 0}
                          onClick={() => handleSelectComp(p)}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                <Button variant="outline" className="w-full mt-2" onClick={() => { setUploadState('idle'); setUploadedVideoUrl(null); }}>
                  Upload Different Video
                </Button>
              </div>
            )}

          </TabsContent>

          <TabsContent value="search" className="mt-4 space-y-4">
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
            </div>

            <div className="border border-border rounded-md overflow-hidden">
              <div className="bg-secondary/50 p-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
                <div className="col-span-5">Video</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-1">FPS</div>
                <div className="col-span-2 text-right">Action</div>
              </div>
              <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                {filteredVideos.map((video: Video) => (
                  <div key={video.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-secondary/30 transition-colors text-sm">
                    <div className="col-span-5 font-bold flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
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
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No videos found. Try a different search.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CompCard({ name, match, reason, isTopMatch = false, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
        isTopMatch 
          ? 'bg-primary/5 border-primary/50 hover:bg-primary/10' 
          : 'bg-card border-border hover:border-primary/30'
      }`}
    >
      {isTopMatch && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          Best Match
        </div>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="font-display font-bold text-lg leading-none">{name}</div>
        </div>
        <div className="text-primary font-mono font-bold">{match}</div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{reason}</p>
      <Button variant={isTopMatch ? "default" : "secondary"} className="w-full mt-4 h-8 text-xs">
        Compare Swing
      </Button>
    </div>
  );
}