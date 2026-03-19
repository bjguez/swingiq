import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Trash2, Clock, CheckCircle, Mail, ChevronRight, Video, ArrowLeft, MessageSquare, FileVideo, Mic, Users, Pencil, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";

type CoachSession = {
  id: string;
  playerId: string;
  playerVideoId: string | null;
  proVideoId: string | null;
  notes: string | null;
  voiceoverUrl: string | null;
  sharedAt: string;
  createdAt: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  playerUsername: string | null;
};

type PlayerRow = {
  id: string;
  status: "pending" | "active";
  inviteEmail: string;
  teamName: string | null;
  createdAt: string;
  playerId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  skillLevel: string | null;
};

function statusBadge(status: string) {
  if (status === "active")
    return <span className="flex items-center gap-1 text-xs text-green-500 font-semibold"><CheckCircle size={12} /> Connected</span>;
  return <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold"><Clock size={12} /> Pending</span>;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeam, setInviteTeam] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null); // relationship id being edited
  const [teamDraft, setTeamDraft] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [playerTab, setPlayerTab] = useState<"swings" | "sessions">("swings");

  const { data: players = [], isLoading } = useQuery<PlayerRow[]>({
    queryKey: ["/api/coach/players"],
    enabled: !!user,
  });

  const { data: playerVideos = [], isLoading: videosLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/coaching/players", selectedPlayer?.playerId, "videos"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/players/${selectedPlayer!.playerId}/videos`);
      if (!res.ok) throw new Error("Failed to load videos");
      return res.json();
    },
    enabled: !!selectedPlayer?.playerId,
  });

  const { data: coachSessions = [], isLoading: sessionsLoading } = useQuery<CoachSession[]>({
    queryKey: ["/api/coaching/sessions", selectedPlayer?.playerId],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/sessions?playerId=${selectedPlayer!.playerId}`);
      if (!res.ok) throw new Error("Failed to load sessions");
      return res.json();
    },
    enabled: !!selectedPlayer?.playerId,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, teamName }: { email: string; teamName?: string }) => {
      const res = await apiRequest("POST", "/api/coach/invite", { email, teamName: teamName || null });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
      setInviteEmail(""); setInviteTeam(""); setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    },
    onError: (err: Error) => setInviteError(err.message),
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, teamName }: { id: string; teamName: string }) => {
      const res = await apiRequest("PATCH", `/api/coach/players/${id}`, { teamName: teamName.trim() || null });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
      setEditingTeam(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/coach/players/${id}`, undefined); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] }); setSelectedPlayer(null); },
  });

  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/coach/invite/resend/${id}`, undefined);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: (_d, id) => { setResendSuccess(id); setTimeout(() => setResendSuccess(null), 3000); },
  });

  const activeCount = players.filter(p => p.status === "active").length;
  const pendingCount = players.filter(p => p.status === "pending").length;

  // ── Player video view ──
  if (selectedPlayer) {
    const playerName = [selectedPlayer.firstName, selectedPlayer.lastName].filter(Boolean).join(" ") || selectedPlayer.inviteEmail;
    return (
      <Layout>
        <div className="max-w-3xl mx-auto w-full py-8 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedPlayer(null); setPlayerTab("swings"); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display text-2xl uppercase tracking-wider">{playerName}</h1>
              <p className="text-sm text-muted-foreground">{selectedPlayer.email || selectedPlayer.inviteEmail}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/coach/session?playerId=${selectedPlayer.playerId}`)}
              >
                <Video size={14} className="mr-2" /> New Session
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/coach/messages?relationshipId=${selectedPlayer.id}`)}
              >
                <MessageSquare size={14} className="mr-2" /> Message
              </Button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border">
            <button
              onClick={() => setPlayerTab("swings")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${playerTab === "swings" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Player Swings
            </button>
            <button
              onClick={() => setPlayerTab("sessions")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${playerTab === "sessions" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Coaching Sessions
              {coachSessions.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{coachSessions.length}</span>
              )}
            </button>
          </div>

          {/* Their Swings tab */}
          {playerTab === "swings" && (
            <div>
              {videosLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : playerVideos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                  <Video size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">This player hasn't uploaded any swings yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {playerVideos.map(v => (
                    <button
                      key={v.id}
                      onClick={() => navigate(`/coach/session?playerId=${selectedPlayer.playerId}&videoId=${v.id}`)}
                      className="group relative aspect-video rounded-lg overflow-hidden border border-border bg-secondary hover:border-primary/50 transition-colors text-left"
                    >
                      {v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video size={24} className="text-muted-foreground opacity-40" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs text-white font-semibold truncate">{v.title}</p>
                        {v.category && <p className="text-xs text-white/60">{v.category}</p>}
                      </div>
                      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded">Start Session</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Coaching Sessions tab */}
          {playerTab === "sessions" && (
            <div>
              {sessionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : coachSessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                  <FileVideo size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No coaching sessions sent yet.</p>
                  <p className="text-xs mt-1">Click "New Session" to create one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {coachSessions.map(s => (
                    <div key={s.id} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <FileVideo size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">
                            {new Date(s.sharedAt || s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {s.voiceoverUrl && (
                            <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              <Mic size={10} /> Voiceover
                            </span>
                          )}
                          {s.playerVideoId && (
                            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Player video</span>
                          )}
                          {s.proVideoId && (
                            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Pro comparison</span>
                          )}
                        </div>
                        {s.notes && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── Player list ──
  return (
    <Layout>
      <div className="max-w-3xl mx-auto w-full py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wider">My Teams</h1>
          <p className="text-muted-foreground mt-1">{activeCount} connected · {pendingCount} pending</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus size={16} /> Invite a Player</CardTitle>
            <CardDescription>Enter their email. They'll get an invitation to connect with you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); setInviteError(null); if (inviteEmail) inviteMutation.mutate({ email: inviteEmail, teamName: inviteTeam }); }} className="space-y-2">
              <div className="flex gap-2">
                <Input type="email" placeholder="player@example.com" value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }} className="flex-1" required />
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </div>
              <Input placeholder="Team name (optional, e.g. Varsity, JV)" value={inviteTeam}
                onChange={(e) => setInviteTeam(e.target.value)} />
            </form>
            {inviteError && <p className="text-sm text-destructive mt-2">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-500 mt-2">Invitation sent!</p>}
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : players.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No players yet</p>
            <p className="text-sm mt-1">Send an invite above to get started.</p>
          </div>
        ) : (() => {
          // Group players by team name; null team = "Unassigned"
          const grouped = players.reduce<Record<string, PlayerRow[]>>((acc, p) => {
            const key = p.teamName?.trim() || "__none__";
            (acc[key] ??= []).push(p);
            return acc;
          }, {});
          // Sort: named teams first (alphabetical), unassigned last
          const teamKeys = Object.keys(grouped).sort((a, b) => {
            if (a === "__none__") return 1;
            if (b === "__none__") return -1;
            return a.localeCompare(b);
          });

          return (
            <div className="space-y-6">
              {teamKeys.map(teamKey => (
                <div key={teamKey}>
                  {/* Team header */}
                  <div className="flex items-center gap-2 mb-2">
                    {editingTeam === teamKey ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={e => {
                          e.preventDefault();
                          // Update all players in this team
                          grouped[teamKey].forEach(p => updateTeamMutation.mutate({ id: p.id, teamName: teamDraft }));
                        }}
                      >
                        <Input
                          autoFocus
                          value={teamDraft}
                          onChange={e => setTeamDraft(e.target.value)}
                          placeholder="Team name"
                          className="h-7 text-sm w-40"
                        />
                        <button type="submit" className="text-primary hover:text-primary/80 transition-colors" title="Save">
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={() => setEditingTeam(null)} className="text-muted-foreground hover:text-foreground transition-colors text-xs">Cancel</button>
                      </form>
                    ) : (
                      <>
                        <Users size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {teamKey === "__none__" ? "Unassigned" : teamKey}
                        </span>
                        <span className="text-xs text-muted-foreground/60">· {grouped[teamKey].length}</span>
                        <button
                          onClick={() => { setEditingTeam(teamKey); setTeamDraft(teamKey === "__none__" ? "" : teamKey); }}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-1"
                          title="Rename team"
                        >
                          <Pencil size={11} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Players in team */}
                  <div className="space-y-2 pl-0">
                    {grouped[teamKey].map((p) => {
                      const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || null;
                      const displayEmail = p.email || p.inviteEmail;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                          <button
                            className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                            onClick={() => p.status === "active" ? setSelectedPlayer(p) : undefined}
                            disabled={p.status !== "active"}
                          >
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {name ? name[0].toUpperCase() : <Mail size={14} />}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{name || displayEmail}</p>
                              {name && <p className="text-xs text-muted-foreground">{displayEmail}</p>}
                              <div className="mt-0.5">{statusBadge(p.status)}</div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            {p.status === "active" && (
                              <ChevronRight size={16} className="text-muted-foreground" />
                            )}
                            {p.status === "pending" && (
                              <button onClick={() => resendMutation.mutate(p.id)} disabled={resendMutation.isPending}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors">
                                {resendSuccess === p.id ? "Sent!" : "Resend"}
                              </button>
                            )}
                            <button onClick={() => removeMutation.mutate(p.id)} disabled={removeMutation.isPending}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Remove player">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}
