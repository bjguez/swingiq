import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Target, Loader2, Lock, MessageSquare, Video, Send, GraduationCap, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVideos } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import type { Video as VideoType, MlbPlayer } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AuthGateModal } from "@/components/AuthGateModal";
import { apiRequest } from "@/lib/queryClient";
import { CompTrainer } from "@/components/CompTrainer";

type Tab = "blueprint" | "sessions" | "messages";

type CompRow = {
  id: string;
  compType: string;
  rank: number | null;
  player: MlbPlayer;
};

type CoachSessionRow = {
  id: string;
  notes: string | null;
  sharedAt: string;
  playerVideoId: string | null;
  proVideoId: string | null;
  highlightStart: number | null;
  highlightEnd: number | null;
  voiceoverUrl: string | null;
  coachFirstName: string | null;
  coachLastName: string | null;
  coachUsername: string;
  coachOrganization: string | null;
};

type MessageRow = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderUsername: string;
};

type RelationshipRow = {
  id: string;
  coachId: string;
  playerId: string | null;
  status: string;
};

export default function Development() {
  const { user } = useAuth();
  const isProOrAdmin = user?.isAdmin || user?.subscriptionTier === "pro" || user?.subscriptionTier === "coach";
  const isPaidAny = user?.isAdmin || ["player", "pro", "coach"].includes(user?.subscriptionTier ?? "");
  const [, navigate] = useLocation();
  const search = useSearch();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<CompRow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const s = new URLSearchParams(search).get("session");
    return s ? "sessions" : "blueprint";
  });
  const [messageInput, setMessageInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(new URLSearchParams(search).get("session"));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: allVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
    enabled: isProOrAdmin,
  });

  const { data: comps = [], isLoading: compsLoading } = useQuery<CompRow[]>({
    queryKey: ["/api/biometrics/comps"],
    enabled: !!user && isProOrAdmin,
  });

  const { data: coachSessions = [], isLoading: sessionsLoading } = useQuery<CoachSessionRow[]>({
    queryKey: ["/api/coaching/sessions/received"],
    enabled: !!user && isPaidAny,
  });

  const { data: relationships = [] } = useQuery<RelationshipRow[]>({
    queryKey: ["/api/coaching/relationships"],
    enabled: !!user && isPaidAny,
  });

  // For messaging, pick the first active relationship (can expand later)
  const myRelationship = relationships.find(r => r.playerId === user?.id);

  const { data: msgs = [], isLoading: msgsLoading } = useQuery<MessageRow[]>({
    queryKey: ["/api/coaching/messages", myRelationship?.id],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/messages/${myRelationship!.id}`);
      return res.json();
    },
    enabled: !!myRelationship && activeTab === "messages",
    refetchInterval: activeTab === "messages" ? 5000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/coaching/messages", { coachPlayerId: myRelationship!.id, content });
      if (!res.ok) throw new Error("Failed to send");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/messages", myRelationship?.id] });
      setMessageInput("");
    },
  });

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, activeTab]);

  const hasCoach = relationships.length > 0;

  // Separate user uploads from pro library videos
  const userVideos = (allVideos as VideoType[]).filter(v => !v.isProVideo);
  const proVideos = (allVideos as VideoType[]).filter(v => v.isProVideo);

  // Tab list — show Sessions/Messages only if player has a coach
  const tabs: { id: Tab; label: string }[] = [
    ...(hasCoach ? [
      { id: "sessions" as Tab, label: `Coaching Sessions${coachSessions.length > 0 ? ` (${coachSessions.length})` : ""}` },
    ] : []),
    { id: "blueprint", label: "Blueprint" },
    ...(hasCoach ? [
      { id: "messages" as Tab, label: "Messages" },
    ] : []),
  ];

  // Gate: no subscription
  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
          <Lock className="w-12 h-12 text-primary opacity-40" />
          <div>
            <h1 className="text-3xl font-bold font-display uppercase mb-2">Development</h1>
            <p className="text-muted-foreground max-w-md">Sign in to access your development tools.</p>
          </div>
          <Button size="lg" onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
        <AuthGateModal open={authGateOpen} onOpenChange={setAuthGateOpen} reason="Sign in to access Development." />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Training</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Development</h1>
          <p className="text-muted-foreground">Your training plan, coach sessions, and messages.</p>
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-border mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── BLUEPRINT TAB ── */}
      {activeTab === "blueprint" && !isProOrAdmin && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
          <Lock className="w-12 h-12 text-primary opacity-40" />
          <div>
            <h2 className="text-2xl font-bold font-display uppercase mb-2">Pro Feature</h2>
            <p className="text-muted-foreground max-w-md">
              Mirror your biometric comps and analyze your mechanics gap with a Pro subscription.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/pricing")}>Upgrade to Pro</Button>
        </div>
      )}

      {activeTab === "blueprint" && isProOrAdmin && (
        <>
          {selectedComp ? (
            <CompTrainer
              comp={selectedComp}
              compVideos={proVideos.filter(v =>
                v.playerName?.toLowerCase() === selectedComp.player.name.toLowerCase()
              )}
              userVideos={userVideos}
              onBack={() => setSelectedComp(null)}
            />
          ) : (
            <div className="space-y-6 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold font-display uppercase flex items-center gap-2">
                    <Target className="text-primary w-6 h-6" /> Mirror Your Comp
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pick a biometric comp and compare your swing mechanics side-by-side or overlaid.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/biometrics")}>
                  Manage Comps
                </Button>
              </div>

              {(compsLoading || videosLoading) ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : comps.length === 0 ? (
                <div className="border border-border rounded-xl p-10 text-center space-y-3">
                  <Target className="w-10 h-10 text-primary/30 mx-auto" />
                  <p className="font-semibold">No comps set up yet</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Head to Biometrics to find your MLB physical comps. Then come back here to mirror their mechanics.
                  </p>
                  <Button onClick={() => navigate("/biometrics")}>Go to Biometrics</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {comps.map(comp => {
                    const videoCount = proVideos.filter(v =>
                      v.playerName?.toLowerCase() === comp.player.name.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedComp(comp)}
                        className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {comp.player.imageUrl ? (
                            <img
                              src={comp.player.imageUrl}
                              alt={comp.player.name}
                              className="w-12 h-12 rounded-full object-contain bg-secondary border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 text-lg font-bold text-muted-foreground">
                              {comp.player.name[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-sm leading-tight truncate">{comp.player.name}</p>
                            <p className="text-xs text-muted-foreground">{comp.player.team}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              comp.compType === "auto"
                                ? "bg-primary/20 text-primary"
                                : "bg-blue-500/10 text-blue-400"
                            }`}>
                              {comp.compType === "auto" ? `#${comp.rank} Comp` : "Studying"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {videoCount} video{videoCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className="text-xs text-primary font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                            Train <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SESSIONS TAB ── */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : coachSessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No sessions yet</p>
              <p className="text-sm mt-1">Your coach will share analysis sessions here.</p>
            </div>
          ) : coachSessions.map(session => {
            const coachName = [session.coachFirstName, session.coachLastName].filter(Boolean).join(" ") || session.coachUsername;
            const isSelected = selectedSessionId === session.id;
            return (
              <div key={session.id} className={`border rounded-xl overflow-hidden transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <button
                  className="w-full flex items-start justify-between p-4 text-left"
                  onClick={() => setSelectedSessionId(isSelected ? null : session.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <GraduationCap size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Session from {coachName}</p>
                      {session.coachOrganization && <p className="text-xs text-muted-foreground">{session.coachOrganization}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(session.sharedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="text-xs text-primary font-semibold shrink-0">
                    {isSelected ? "Close" : "View Session →"}
                  </span>
                </button>
                {isSelected && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {/* Coach recording video — shown first and full-width */}
                    {session.voiceoverUrl && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach Recording</p>
                        <video src={session.voiceoverUrl} controls className="w-full aspect-video rounded-lg bg-black border border-border object-contain" />
                      </div>
                    )}
                    {/* Reference videos */}
                    {(session.playerVideoId || session.proVideoId) && (
                      <div className="grid grid-cols-2 gap-3">
                        {session.playerVideoId && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Swing</p>
                            <PlayerVideo videoId={session.playerVideoId} highlightStart={session.highlightStart} highlightEnd={session.highlightEnd} />
                          </div>
                        )}
                        {session.proVideoId && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pro Comparison</p>
                            <PlayerVideo videoId={session.proVideoId} />
                          </div>
                        )}
                      </div>
                    )}
                    {/* Notes */}
                    {session.notes && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
                        <p className="text-sm leading-relaxed">{session.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MESSAGES TAB ── */}
      {activeTab === "messages" && (
        <div className="flex flex-col h-[60vh] max-w-2xl">
          {!myRelationship ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No coach connected</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : msgs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hi!</p>
                ) : msgs.map(m => {
                  const isMe = m.senderId === user?.id;
                  const name = [m.senderFirstName, m.senderLastName].filter(Boolean).join(" ") || m.senderUsername;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                        {!isMe && <p className="text-xs font-semibold mb-0.5 opacity-70">{name}</p>}
                        <p>{m.content}</p>
                        <p className={`text-xs mt-1 opacity-60 ${isMe ? "text-right" : ""}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form
                onSubmit={e => { e.preventDefault(); if (messageInput.trim()) sendMutation.mutate(messageInput); }}
                className="flex gap-2 mt-4 border-t border-border pt-4"
              >
                <input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" size="icon" disabled={sendMutation.isPending || !messageInput.trim()}>
                  <Send size={15} />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}

function PlayerVideo({ videoId, highlightStart, highlightEnd }: { videoId: string; highlightStart?: number | null; highlightEnd?: number | null }) {
  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos"], queryFn: () => fetchVideos() });
  const video = (allVideos as VideoType[]).find(v => v.id === videoId);
  if (!video?.sourceUrl) return <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center"><Video size={20} className="text-muted-foreground opacity-30" /></div>;
  const src = highlightStart != null ? `${video.sourceUrl}#t=${highlightStart},${highlightEnd ?? ""}` : video.sourceUrl;
  return (
    <div className="space-y-1">
      <video src={src} controls className="w-full aspect-video rounded-lg bg-black object-contain" />
      {highlightStart != null && (
        <p className="text-[10px] text-primary font-semibold">⚑ Coach highlighted {highlightStart.toFixed(1)}s – {(highlightEnd ?? 0).toFixed(1)}s</p>
      )}
    </div>
  );
}

