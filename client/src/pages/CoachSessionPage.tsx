import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { ArrowLeft, Send, Video, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";

export default function CoachSessionPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const playerId = params.get("playerId") ?? "";
  const initialVideoId = params.get("videoId") ?? "";

  const [notes, setNotes] = useState("");
  const [playerVideoId, setPlayerVideoId] = useState<string>(initialVideoId);
  const [proVideoId, setProVideoId] = useState<string>("");
  const [playerVideoSrc, setPlayerVideoSrc] = useState<string>("");
  const [proVideoSrc, setProVideoSrc] = useState<string>("");
  const [shared, setShared] = useState(false);

  // Load player videos to find the pre-selected one
  const { data: playerVideos = [] } = useQuery<VideoType[]>({
    queryKey: ["/api/coaching/players", playerId, "videos"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/players/${playerId}/videos`);
      return res.json();
    },
    enabled: !!playerId,
  });

  useEffect(() => {
    if (initialVideoId && playerVideos.length > 0) {
      const v = playerVideos.find(v => v.id === initialVideoId);
      if (v?.sourceUrl) setPlayerVideoSrc(v.sourceUrl);
    }
  }, [initialVideoId, playerVideos]);

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/coaching/sessions", {
        playerId,
        playerVideoId: playerVideoId || null,
        proVideoId: proVideoId || null,
        notes: notes.trim() || null,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => setShared(true),
  });

  if (shared) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="font-display text-2xl uppercase tracking-wider">Session Shared</h2>
          <p className="text-muted-foreground">The player has been notified via email and in-app notification.</p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate("/coach")}>Back to My Players</Button>
            <Button onClick={() => { setShared(false); setNotes(""); }}>Share Another</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto w-full py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-2xl uppercase tracking-wider">New Coaching Session</h1>
        </div>

        {/* Video pickers */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Player swing */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Player's Swing</p>
            {playerVideoSrc ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
                <video src={playerVideoSrc} controls className="w-full h-full object-contain" />
                <button
                  onClick={() => { setPlayerVideoSrc(""); setPlayerVideoId(""); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >✕</button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Pick from player's library */}
                {playerVideos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {playerVideos.map(v => (
                      <button
                        key={v.id}
                        onClick={() => { setPlayerVideoId(v.id); setPlayerVideoSrc(v.sourceUrl ?? ""); }}
                        className="relative aspect-video rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors bg-secondary"
                      >
                        {v.thumbnailUrl
                          ? <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          : <Video size={16} className="absolute inset-0 m-auto text-muted-foreground opacity-40" />
                        }
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-0.5">
                          <p className="text-white text-[10px] truncate">{v.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {playerVideos.length === 0 && (
                  <div className="aspect-video rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Player has no swings uploaded yet</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pro video */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pro Comparison (optional)</p>
            {proVideoSrc ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
                <video src={proVideoSrc} controls className="w-full h-full object-contain" />
                <button
                  onClick={() => { setProVideoSrc(""); setProVideoId(""); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >✕</button>
              </div>
            ) : (
              <VideoLibraryModal
                mode="pro"
                trigger={
                  <div className="aspect-video rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-foreground transition-colors">
                    <Video size={28} className="opacity-40" />
                    <p className="text-sm">Choose a pro video</p>
                  </div>
                }
                onVideoSelected={(src, _label, id) => {
                  setProVideoSrc(src);
                  if (id) setProVideoId(id);
                }}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Write your coaching feedback, cues, and observations for this player..."
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Share */}
        {shareMutation.isError && (
          <p className="text-sm text-destructive">{(shareMutation.error as Error).message}</p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/coach")}>Cancel</Button>
          <Button
            onClick={() => shareMutation.mutate()}
            disabled={shareMutation.isPending || (!playerVideoId && !notes.trim())}
            className="flex-1 sm:flex-none"
          >
            <Send size={15} className="mr-2" />
            {shareMutation.isPending ? "Sharing..." : "Share with Player"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
