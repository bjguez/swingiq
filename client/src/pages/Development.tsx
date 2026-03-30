import Layout from "@/components/Layout";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, MessageSquare, Video, Send, GraduationCap, CheckCircle2, PlayCircle, BookOpen, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVideos } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import type { Video as VideoType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AuthGateModal } from "@/components/AuthGateModal";
import { apiRequest } from "@/lib/queryClient";
import { MovingWatermark } from "@/components/MovingWatermark";

type Tab = "blueprint" | "sessions" | "messages";

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

type BlueprintItem = {
  id: string;
  phase: string;
  contentType: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
};

// ── Static blueprint curriculum ─────────────────────────────────────────────
type PhaseId = "foundation" | "gather" | "lag" | "on_plane" | "contact" | "finish";

const BLUEPRINT_PHASES: {
  id: PhaseId;
  label: string;
  subtitle: string;
  feelCue: string;
  checkpoint?: string;
  points: string[];
}[] = [
  {
    id: "foundation",
    label: "Foundation",
    subtitle: "The Two Non-Negotiables",
    feelCue: "Everything in the swing is generated from the ground up.",
    points: [
      "Your core drives weight from back side to front side — but only if your feet stay connected to the ground.",
      "The moment you try to generate power with your knee or upper body, you relax the glutes — your primary power movers.",
      "Get your posture right first. Everything else is built on top of it.",
      "Enter every swing as if you're going to hit the hardest fastball as deep in the zone as possible.",
    ],
  },
  {
    id: "gather",
    label: "Gather",
    subtitle: "Phase 1 — Generate Controlled Inertia",
    feelCue: "Controlled forward energy — like a coil winding toward the pitcher, not away from it. The inertia you generate here is what the rest of the swing feeds off of.",
    points: [
      "The head stays more forward — don't let it drift back with the load.",
      "The front foot and lower leg come under the front hip, not out in front of it.",
      "There's a controlled forward move toward the pitcher — building momentum into the swing, not away from it.",
      "The landing position is more or less square to home plate: knees out, toes out, athletic stance.",
    ],
  },
  {
    id: "lag",
    label: "Lag",
    subtitle: "Phase 2 — Load and Set",
    feelCue: "Like you're winding up to skip a rock or make a sidearm throw — slow and deliberate. The aggression comes later.",
    checkpoint: "A clean 90-degree angle from elbow to hand, up through the shoulder. Palm up, barrel deep, front elbow quiet.",
    points: [
      "The first move is the back elbow dropping independently, without dragging the hands or shoulders with it.",
      "The front elbow stays quiet and still — it waits for the back elbow to catch up.",
      "The back shoulder rolls back toward the spine, like a pitcher getting into external rotation.",
      "As the elbow drops, the knob follows it down and in — behind the back hip.",
      "The arm forms a right angle: elbow to hand, up through the shoulder. Palm faces up.",
      "The barrel points back toward the backstop — not flat toward the dugout.",
    ],
  },
  {
    id: "on_plane",
    label: "On Plane",
    subtitle: "Phase 3 — Getting On Plane Early and Deep",
    feelCue: "Being 'short to the ball' means being short to the path of the pitch — not to a fixed contact point out in front of the plate.",
    points: [
      "From the lag position, the barrel gets onto the plane of the pitch — whatever angle that specific pitch is traveling on.",
      "Faster pitches = catch deeper. Slower/offspeed = same path, catch it further out front.",
      "The shoulders tilt like a Ferris wheel (vertical rotation), not a merry-go-round (flat rotation).",
      "The goal is to be on plane as early as possible and stay there as long as possible.",
    ],
  },
  {
    id: "contact",
    label: "Contact",
    subtitle: "Phase 4 — Through Contact, The Snap",
    feelCue: "Snap so late it feels like you'd wrap the towel around the ball and flip it back over your shoulder.",
    points: [
      "Accelerate through the ball — peak bat speed comes just after contact, not at it.",
      "Think of snapping a towel: you can't snap it by coming around, only by staying direct and whipping out in front at the last second.",
      "The wrist rollover happens late — almost as a byproduct of extension, not a deliberate action.",
      "Maintain the gap between your arms through contact. Daylight between elbows proves you're extending rather than rolling.",
    ],
  },
  {
    id: "finish",
    label: "Finish",
    subtitle: "Phase 5 — The Finish",
    feelCue: "It should feel like your front shoulder is being pulled out of its socket.",
    points: [
      "The back shoulder gets pulled through as a passive result of good hand path — don't actively rotate it.",
      "It should feel like your front shoulder is being pulled out of its socket.",
      "The finish comes over the body, not around it.",
      "If you're doing this right, the finish takes care of itself.",
    ],
  },
];

const TYPE_COLORS: Record<string, string> = {
  drill: "bg-blue-500/20 text-blue-400",
  reference: "bg-green-500/20 text-green-400",
  voiceover: "bg-purple-500/20 text-purple-400",
};

// ── Main page ────────────────────────────────────────────────────────────────
export default function Development() {
  usePageMeta({ title: "Development Blueprint", description: "A structured, phase-by-phase hitting development program with drills, video breakdowns, and coach feedback.", path: "/development" });
  const { user } = useAuth();
  const isPaidAny = user?.isAdmin || ["player", "pro", "coach"].includes(user?.subscriptionTier ?? "");
  const [, navigate] = useLocation();
  const search = useSearch();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const s = new URLSearchParams(search).get("session");
    return s ? "sessions" : "blueprint";
  });
  const [blueprintPhase, setBlueprintPhase] = useState<PhaseId>("foundation");
  const [messageInput, setMessageInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(new URLSearchParams(search).get("session"));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: coachSessions = [], isLoading: sessionsLoading } = useQuery<CoachSessionRow[]>({
    queryKey: ["/api/coaching/sessions/received"],
    enabled: !!user && isPaidAny,
  });

  const { data: relationships = [] } = useQuery<RelationshipRow[]>({
    queryKey: ["/api/coaching/relationships"],
    enabled: !!user && isPaidAny,
  });

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

  const { data: blueprintContent = [] } = useQuery<BlueprintItem[]>({
    queryKey: ["/api/blueprint/content"],
    queryFn: () => fetch("/api/blueprint/content").then(r => r.json()),
    enabled: !!user,
  });

  const { data: focusPhases = [] } = useQuery<string[]>({
    queryKey: ["/api/blueprint/focus"],
    queryFn: () => fetch("/api/blueprint/focus").then(r => r.json()),
    enabled: !!user,
  });

  const toggleFocus = useMutation({
    mutationFn: (phase: string) =>
      fetch(`/api/blueprint/focus/${phase}`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/blueprint/focus"] }),
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "blueprint", label: "Blueprint" },
    ...(hasCoach ? [
      { id: "sessions" as Tab, label: `Sessions${coachSessions.length > 0 ? ` (${coachSessions.length})` : ""}` },
      { id: "messages" as Tab, label: "Messages" },
    ] : []),
  ];

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

  const currentPhaseData = BLUEPRINT_PHASES.find(p => p.id === blueprintPhase)!;
  const phaseContent = blueprintContent.filter(c => c.phase === blueprintPhase);
  const isWorkingOn = focusPhases.includes(blueprintPhase);

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

      {/* Top-level tabs (Blueprint / Sessions / Messages) */}
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── BLUEPRINT TAB ─────────────────────────────────────────────────── */}
      {activeTab === "blueprint" && (
        <div className="space-y-5">
          {/* Intro */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">The SwingStudio Hitting Blueprint</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Elite hitting isn't one big secret — it's a collection of small pieces, each containing its own depth.
              Work through each phase, absorb the feel cues, and use the content library to build toward each position.
            </p>
          </div>

          {/* Focus banner */}
          {focusPhases.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
              <Star className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-primary">Currently working on:</span>
              {focusPhases.map(p => {
                const phase = BLUEPRINT_PHASES.find(x => x.id === p);
                return phase ? (
                  <span key={p} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                    {phase.label}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Phase tab bar */}
          <div className="flex border-b border-border overflow-x-auto scrollbar-none">
            {BLUEPRINT_PHASES.map(phase => (
              <button
                key={phase.id}
                onClick={() => setBlueprintPhase(phase.id)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  blueprintPhase === phase.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {phase.label}
                {focusPhases.includes(phase.id) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                )}
              </button>
            ))}
          </div>

          {/* Phase content */}
          <div className="space-y-5 pb-6">
            {/* Phase title */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-display uppercase">{currentPhaseData.label}</h2>
                <p className="text-sm text-muted-foreground">{currentPhaseData.subtitle}</p>
              </div>
              <button
                onClick={() => toggleFocus.mutate(blueprintPhase)}
                disabled={toggleFocus.isPending}
                className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
                  isWorkingOn
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isWorkingOn ? "fill-primary" : ""}`} />
                {isWorkingOn ? "Working on this" : "Add to focus"}
              </button>
            </div>

            {/* Feel cue */}
            <div className="bg-primary/5 border-l-2 border-primary rounded-r-xl px-5 py-4">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">The Feel</p>
              <p className="text-base leading-relaxed font-medium italic">"{currentPhaseData.feelCue}"</p>
            </div>

            {/* Checkpoint callout */}
            {currentPhaseData.checkpoint && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-1">The Checkpoint</p>
                <p className="text-sm leading-relaxed">{currentPhaseData.checkpoint}</p>
              </div>
            )}

            {/* Key points */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Key Points</p>
              <div className="space-y-2">
                {currentPhaseData.points.map((point, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
                    <p className="text-sm leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Content library for this phase */}
            {phaseContent.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Content Library</p>
                <div className="grid grid-cols-3 gap-2">
                  {phaseContent.map(item => (
                    <ContentCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Coming soon if no content */}
            {phaseContent.length === 0 && (
              <div className="border border-border/50 rounded-xl p-6 text-center text-muted-foreground space-y-1">
                <PlayCircle className="w-8 h-8 mx-auto opacity-20 mb-2" />
                <p className="text-sm font-semibold">Content coming soon</p>
                <p className="text-xs">Drills and reference clips for this phase will appear here.</p>
              </div>
            )}

            {/* Individual variation note (last phase only, but shown always as a footer) */}
            {blueprintPhase === "finish" && (
              <div className="bg-secondary/30 border border-border rounded-xl px-4 py-4 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">A Note on Individual Variation</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every hitter gets to this framework differently. Body type, arm length, vision, and ingrained habits all affect how you build toward these positions. The framework describes <em>where</em> elite hitters arrive — not a rigid sequence that looks identical on everyone. The job in development is figuring out which pieces belong to your puzzle.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SESSIONS TAB ─────────────────────────────────────────────────── */}
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
                    {session.voiceoverUrl && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach Recording</p>
                        <video src={session.voiceoverUrl} controls className="w-full aspect-video rounded-lg bg-black border border-border object-contain" />
                      </div>
                    )}
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

      {/* ── MESSAGES TAB ─────────────────────────────────────────────────── */}
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

// ── Content card ─────────────────────────────────────────────────────────────
function ContentCard({ item }: { item: BlueprintItem }) {
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [scrubPct, setScrubPct] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typeColor = TYPE_COLORS[item.contentType] ?? "bg-secondary text-muted-foreground";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!vid || !rect || !vid.duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    vid.currentTime = pct * vid.duration;
    setScrubPct(pct * 100);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden group">
      {item.videoUrl ? (
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-black overflow-hidden cursor-pointer"
          onMouseEnter={() => !playing && setHovered(true)}
          onMouseLeave={() => { setHovered(false); if (videoRef.current && !playing) videoRef.current.currentTime = 0; setScrubPct(0); }}
          onMouseMove={e => !playing && handleMouseMove(e)}
          onClick={() => !playing && setPlaying(true)}
        >
          {playing ? (
            <video
              src={item.videoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={item.videoUrl}
              className="w-full h-full object-contain"
              preload="metadata"
              muted
            />
          )}
          <MovingWatermark />
          {!playing && !hovered && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlayCircle className="w-4 h-4 text-white" />
              </div>
            </div>
          )}
          {!playing && hovered && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-border/50 pointer-events-none">
              <div className="h-full bg-primary transition-none" style={{ width: `${scrubPct}%` }} />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video bg-secondary/40 flex items-center justify-center">
          <PlayCircle className="w-5 h-5 text-muted-foreground opacity-30" />
        </div>
      )}
      {playing && item.description && (
        <div className="px-2 py-1.5 border-t border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        </div>
      )}
      <div className="p-1.5 space-y-0.5">
        <p className="text-[11px] font-semibold leading-tight truncate">{item.title}</p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${typeColor}`}>
          {item.contentType}
        </span>
      </div>
    </div>
  );
}

// ── PlayerVideo (for Sessions tab) ───────────────────────────────────────────
function PlayerVideo({ videoId, highlightStart, highlightEnd }: { videoId: string; highlightStart?: number | null; highlightEnd?: number | null }) {
  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos"], queryFn: () => fetchVideos() });
  const video = (allVideos as VideoType[]).find(v => v.id === videoId);
  if (!video?.sourceUrl) return (
    <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center">
      <Video size={20} className="text-muted-foreground opacity-30" />
    </div>
  );
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
