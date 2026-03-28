import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Trash2, Clock, CheckCircle, Mail, ChevronRight, Video, ArrowLeft, MessageSquare, FileVideo, Users, Plus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";

type CoachTeam = { id: string; name: string; createdAt: string };

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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState<string>("__none__");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // New team form
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamError, setNewTeamError] = useState<string | null>(null);

  // Player detail
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [playerTab, setPlayerTab] = useState<"swings" | "sessions">("swings");

  // ── Queries ──
  const { data: teams = [], isLoading: teamsLoading } = useQuery<CoachTeam[]>({
    queryKey: ["/api/coach/teams"],
    enabled: !!user,
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<PlayerRow[]>({
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

  // ── Mutations ──
  const inviteMutation = useMutation({
    mutationFn: async ({ email, teamName }: { email: string; teamName: string | null }) => {
      const res = await apiRequest("POST", "/api/coach/invite", { email, teamName });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
      setInviteEmail(""); setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    },
    onError: (err: Error) => setInviteError(err.message),
  });

  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/coach/teams", { name });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json() as Promise<CoachTeam>;
    },
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/teams"] });
      setNewTeamName(""); setShowNewTeam(false); setNewTeamError(null);
      setInviteTeamId(team.id);
    },
    onError: (err: Error) => setNewTeamError(err.message),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/coach/teams/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
    },
  });

  const movePlayerMutation = useMutation({
    mutationFn: async ({ id, teamName }: { id: string; teamName: string | null }) => {
      const res = await apiRequest("PATCH", `/api/coach/players/${id}`, { teamName });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] }),
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

  // Derive team name for invite from selected team id
  function teamNameForInvite(): string | null {
    if (inviteTeamId === "__none__") return null;
    return teams.find(t => t.id === inviteTeamId)?.name ?? null;
  }

  // ── Player detail view ──
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
              <Button size="sm" variant="outline" onClick={() => navigate(`/coach/session?playerId=${selectedPlayer.playerId}`)}>
                <Video size={14} className="mr-2" /> New Session
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/coach/messages?relationshipId=${selectedPlayer.id}`)}>
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

          {/* Player Swings tab */}
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
                      className="group flex flex-col rounded-lg overflow-hidden border border-border bg-secondary hover:border-primary/50 transition-colors text-left"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video w-full bg-black">
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video size={24} className="text-muted-foreground opacity-40" />
                          </div>
                        )}
                        {v.duration && (
                          <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 py-0.5 rounded">
                            {v.duration}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded">Start Session</span>
                        </div>
                      </div>
                      {/* Metadata */}
                      <div className="px-2 py-2 flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-foreground truncate">{v.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {v.category && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {v.category}
                            </span>
                          )}
                          {v.tags && v.tags.length > 0 && v.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] bg-secondary text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </p>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">
                            {new Date(s.sharedAt || s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {s.voiceoverUrl && (
                            <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              <Video size={10} /> Recording
                            </span>
                          )}
                          {s.playerVideoId && <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Player video</span>}
                          {s.proVideoId && <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Pro comparison</span>}
                        </div>
                        {s.notes && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.notes}</p>}
                      </div>
                      <button
                        onClick={() => navigate(`/coach/session/review?sessionId=${s.id}`)}
                        className="cursor-pointer shrink-0 text-xs text-primary hover:underline font-semibold mt-0.5"
                      >
                        View
                      </button>
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

  // ── Main list view ──
  const isLoading = teamsLoading || playersLoading;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto w-full py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wider">My Teams</h1>
          <p className="text-muted-foreground mt-1">{activeCount} connected · {pendingCount} pending</p>
        </div>

        {/* Invite a player */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus size={16} /> Invite a Player</CardTitle>
            <CardDescription>Enter their email and assign them to a team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setInviteError(null);
                if (inviteEmail) inviteMutation.mutate({ email: inviteEmail, teamName: teamNameForInvite() });
              }}
              className="space-y-2"
            >
              <div className="flex gap-2">
                <Input type="email" placeholder="player@example.com" value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }} className="flex-1" required />
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </div>
              <select
                value={inviteTeamId}
                onChange={e => setInviteTeamId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="__none__">No team (Unassigned)</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </form>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-500">Invitation sent!</p>}
          </CardContent>
        </Card>

        {/* Add new team */}
        {showNewTeam ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (newTeamName.trim()) createTeamMutation.mutate(newTeamName); }}
            className="flex items-center gap-2"
          >
            <Input
              autoFocus
              placeholder="Team name (e.g. Varsity, JV, U14)"
              value={newTeamName}
              onChange={e => { setNewTeamName(e.target.value); setNewTeamError(null); }}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={createTeamMutation.isPending}>
              {createTeamMutation.isPending ? "Creating..." : "Create"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewTeam(false); setNewTeamName(""); setNewTeamError(null); }}>
              <X size={14} />
            </Button>
            {newTeamError && <p className="text-sm text-destructive">{newTeamError}</p>}
          </form>
        ) : (
          <button
            onClick={() => setShowNewTeam(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={14} /> Add a new team
          </button>
        )}

        {/* Teams + players */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : (
          <div className="space-y-8">
            {/* Named teams */}
            {teams.map(team => {
              const teamPlayers = players.filter(p => p.teamName === team.name);
              return (
                <div key={team.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm">{team.name}</span>
                    <span className="text-xs text-muted-foreground">· {teamPlayers.length} player{teamPlayers.length !== 1 ? "s" : ""}</span>
                    <button
                      onClick={() => { if (confirm(`Delete "${team.name}"? Players will move to Unassigned.`)) deleteTeamMutation.mutate(team.id); }}
                      className="ml-auto text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Delete team"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {teamPlayers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg text-sm">
                      No players on this team yet — invite one above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamPlayers.map(p => (
                        <PlayerCard
                          key={p.id}
                          p={p}
                          teams={teams}
                          resendSuccess={resendSuccess}
                          onSelect={() => setSelectedPlayer(p)}
                          onResend={() => resendMutation.mutate(p.id)}
                          onRemove={() => removeMutation.mutate(p.id)}
                          onMove={(teamName) => movePlayerMutation.mutate({ id: p.id, teamName })}
                          resendPending={resendMutation.isPending}
                          removePending={removeMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned */}
            {(() => {
              const unassigned = players.filter(p => !p.teamName);
              if (unassigned.length === 0 && teams.length > 0) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm text-muted-foreground">Unassigned</span>
                    <span className="text-xs text-muted-foreground">· {unassigned.length}</span>
                  </div>
                  {unassigned.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg text-sm">
                      No players yet — send an invite above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unassigned.map(p => (
                        <PlayerCard
                          key={p.id}
                          p={p}
                          teams={teams}
                          resendSuccess={resendSuccess}
                          onSelect={() => setSelectedPlayer(p)}
                          onResend={() => resendMutation.mutate(p.id)}
                          onRemove={() => removeMutation.mutate(p.id)}
                          onMove={(teamName) => movePlayerMutation.mutate({ id: p.id, teamName })}
                          resendPending={resendMutation.isPending}
                          removePending={removeMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </Layout>
  );
}

function PlayerCard({
  p, teams, resendSuccess,
  onSelect, onResend, onRemove, onMove,
  resendPending, removePending,
}: {
  p: PlayerRow;
  teams: CoachTeam[];
  resendSuccess: string | null;
  onSelect: () => void;
  onResend: () => void;
  onRemove: () => void;
  onMove: (teamName: string | null) => void;
  resendPending: boolean;
  removePending: boolean;
}) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || null;
  const displayEmail = p.email || p.inviteEmail;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card gap-3">
      <button
        className="flex items-center gap-3 flex-1 text-left min-w-0 hover:opacity-80 transition-opacity"
        onClick={() => p.status === "active" ? onSelect() : undefined}
        disabled={p.status !== "active"}
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {name ? name[0].toUpperCase() : <Mail size={14} />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{name || displayEmail}</p>
          {name && <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>}
          <div className="mt-0.5">{statusBadge(p.status)}</div>
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {/* Move to team dropdown */}
        {teams.length > 0 && (
          <select
            value={p.teamName ?? "__none__"}
            onChange={e => onMove(e.target.value === "__none__" ? null : e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            title="Move to team"
          >
            <option value="__none__">Unassigned</option>
            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        )}

        {p.status === "active" && <ChevronRight size={16} className="text-muted-foreground" />}
        {p.status === "pending" && (
          <button onClick={onResend} disabled={resendPending}
            className="text-xs text-muted-foreground hover:text-primary transition-colors">
            {resendSuccess === p.id ? "Sent!" : "Resend"}
          </button>
        )}
        <button onClick={onRemove} disabled={removePending}
          className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Remove player">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
