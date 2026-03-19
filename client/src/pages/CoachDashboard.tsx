import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Trash2, Clock, CheckCircle, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
    return (
      <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
        <CheckCircle size={12} /> Connected
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
      <Clock size={12} /> Pending
    </span>
  );
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const { data: players = [], isLoading } = useQuery<PlayerRow[]>({
    queryKey: ["/api/coach/players"],
    enabled: !!user,
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/coach/invite", { email });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send invite");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
      setInviteEmail("");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setInviteError(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/coach/players/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/players"] });
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    if (!inviteEmail) return;
    inviteMutation.mutate(inviteEmail);
  }

  const activeCount = players.filter(p => p.status === "active").length;
  const pendingCount = players.filter(p => p.status === "pending").length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto w-full py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wider">My Players</h1>
          <p className="text-muted-foreground mt-1">
            {activeCount} connected · {pendingCount} pending
          </p>
        </div>

        {/* Invite form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus size={16} /> Invite a Player
            </CardTitle>
            <CardDescription>
              Enter their email address. They'll receive an invitation to connect with you on Swing Studio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="player@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                className="flex-1"
                required
              />
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </form>
            {inviteError && <p className="text-sm text-destructive mt-2">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-500 mt-2">Invitation sent!</p>}
          </CardContent>
        </Card>

        {/* Player list */}
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
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {name ? name[0].toUpperCase() : <Mail size={14} />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{name || displayEmail}</p>
                      {name && <p className="text-xs text-muted-foreground">{displayEmail}</p>}
                      <div className="mt-0.5">{statusBadge(p.status)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeMutation.mutate(p.id)}
                    disabled={removeMutation.isPending}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Remove player"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
