import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, FileVideo, MessageSquare } from "lucide-react";

export default function CoachSessionReviewPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("sessionId") ?? "";

  const { data: session, isLoading, error } = useQuery<any>({
    queryKey: ["/api/coaching/sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    enabled: !!sessionId,
  });

  if (!sessionId) return null;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading session…</div>
      </Layout>
    );
  }

  if (error || !session) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Session not found.</p>
          <Button variant="ghost" onClick={() => navigate(-1 as any)}><ArrowLeft size={16} className="mr-2" /> Back</Button>
        </div>
      </Layout>
    );
  }

  const date = new Date(session.sharedAt || session.createdAt).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wider">Session Review</h1>
            <p className="text-sm text-muted-foreground">{date}</p>
          </div>
        </div>

        {/* Videos */}
        <div className={`grid gap-4 ${session.playerVideoUrl && session.proVideoUrl ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {session.playerVideoUrl && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileVideo size={12} /> Player Video
              </p>
              <video
                src={session.playerVideoUrl}
                controls
                playsInline
                className="w-full aspect-video rounded-lg bg-black border border-border object-contain"
              />
            </div>
          )}
          {session.proVideoUrl && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileVideo size={12} /> Pro Comparison
              </p>
              <video
                src={session.proVideoUrl}
                controls
                playsInline
                className="w-full aspect-video rounded-lg bg-black border border-border object-contain"
              />
            </div>
          )}
        </div>

        {/* Voiceover */}
        {session.voiceoverUrl && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Mic size={12} /> Voiceover
            </p>
            <audio src={session.voiceoverUrl} controls className="w-full" />
          </div>
        )}

        {/* Notes */}
        {session.notes && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare size={12} /> Coaching Notes
            </p>
            <div className="p-4 rounded-lg border border-border bg-card text-sm whitespace-pre-wrap leading-relaxed">
              {session.notes}
            </div>
          </div>
        )}

        {!session.playerVideoUrl && !session.proVideoUrl && !session.voiceoverUrl && !session.notes && (
          <p className="text-muted-foreground text-sm">No content recorded for this session.</p>
        )}
      </div>
    </Layout>
  );
}
