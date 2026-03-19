import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Trash2, Clock, CheckCircle, Mail, ChevronRight, Video, ArrowLeft, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";

type PlayerRow = {
  id: string;
  status: "pending" | "active";
  inviteEmail: string;
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
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);

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

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/coach/invite", { email });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
      setInviteEmail(""); setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    },
    onError: (err: Error) => setInviteError(err.message),
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
            <button onClick={() => setSelectedPlayer(null)} className="text-muted-foreground hover:text-foreground transition-colors">
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

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Their Swings</p>
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
        </div>
      </Layout>
    );
  }

  // ── Player list ──
  return (
    <Layout>
      <div className="max-w-3xl mx-auto w-full py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wider">My Players</h1>
          <p className="text-muted-foreground mt-1">{activeCount} connected · {pendingCount} pending</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus size={16} /> Invite a Player</CardTitle>
            <CardDescription>Enter their email. They'll get an invitation to connect with you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); setInviteError(null); if (inviteEmail) inviteMutation.mutate(inviteEmail); }} className="flex gap-2">
              <Input type="email" placeholder="player@example.com" value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }} className="flex-1" required />
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
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
        ) : (
          <div className="space-y-2">
            {players.map((p) => {
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
        )}
      </div>
    </Layout>
  );
}
