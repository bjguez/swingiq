import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPlayers, fetchVideos } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { ProfileSheet } from "@/components/ProfileSheet";
import { AuthGateModal } from "@/components/AuthGateModal";
import {
  Lock, Target, PlayCircle, RefreshCw, Loader2,
  UserPlus, X, Search, CheckCircle2, AlertCircle,
  TrendingUp, BookOpen,
} from "lucide-react";
import type { MlbPlayer, Video } from "@shared/schema";

function fmt(n: number | null | undefined, decimals = 3) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtAvg(n: number | null | undefined) {
  if (n == null) return "—";
  return "." + Math.round(n * 1000).toString().padStart(3, "0");
}

type SavedComp = {
  id: string;
  compType: "auto" | "manual";
  rank: number | null;
  player: MlbPlayer;
};

function CompCard({
  comp,
  proVideosByPlayer,
  onRemove,
}: {
  comp: SavedComp;
  proVideosByPlayer: Map<string, Video[]>;
  onRemove: (id: string) => void;
}) {
  const p = comp.player;
  const videos = proVideosByPlayer.get(p.id) ?? [];
  const isManual = comp.compType === "manual";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col relative group">
      {/* Remove button */}
      <button
        onClick={() => onRemove(comp.id)}
        className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={12} className="text-white" />
      </button>

      {/* Badge */}
      <div className="absolute top-2 right-2 z-10">
        {isManual ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Studying</span>
        ) : (
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-black/60 text-primary">#{comp.rank} match</span>
        )}
      </div>

      {/* Photo */}
      <div className="aspect-4/3 bg-secondary flex items-center justify-center overflow-hidden">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover object-top" />
        ) : (
          <span className="text-4xl font-bold text-primary/30">{p.name[0]}</span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        <div>
          <p className="font-bold text-sm leading-tight">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.team} · {p.position} · Bats {p.bats}</p>
        </div>

        {/* Physical */}
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="bg-secondary/50 rounded px-2 py-1">
            <p className="text-muted-foreground">Height</p>
            <p className="font-semibold">{p.height ?? "—"}</p>
          </div>
          <div className="bg-secondary/50 rounded px-2 py-1">
            <p className="text-muted-foreground">Weight</p>
            <p className="font-semibold">{p.weight ? `${p.weight} lbs` : "—"}</p>
          </div>
        </div>

        {/* Stats — same as analysis page */}
        {(p.battingAvg != null || p.homeRuns != null || p.obp != null || p.slg != null || p.ops != null) && (
          <div className="grid grid-cols-3 gap-1 text-xs">
            {p.battingAvg != null && (
              <div className="text-center bg-secondary/30 rounded py-1">
                <p className="text-muted-foreground text-[10px]">AVG</p>
                <p className="font-mono font-bold">{fmtAvg(p.battingAvg)}</p>
              </div>
            )}
            {p.homeRuns != null && (
              <div className="text-center bg-secondary/30 rounded py-1">
                <p className="text-muted-foreground text-[10px]">HR</p>
                <p className="font-mono font-bold">{p.homeRuns}</p>
              </div>
            )}
            {p.obp != null && (
              <div className="text-center bg-secondary/30 rounded py-1">
                <p className="text-muted-foreground text-[10px]">OBP</p>
                <p className="font-mono font-bold">{fmtAvg(p.obp)}</p>
              </div>
            )}
            {p.slg != null && (
              <div className="text-center bg-secondary/30 rounded py-1">
                <p className="text-muted-foreground text-[10px]">SLG</p>
                <p className="font-mono font-bold">{fmtAvg(p.slg)}</p>
              </div>
            )}
            {p.ops != null && (
              <div className="text-center bg-secondary/30 rounded py-1">
                <p className="text-muted-foreground text-[10px]">OPS</p>
                <p className="font-mono font-bold">{fmt(p.ops, 3)}</p>
              </div>
            )}
          </div>
        )}

        {/* Swing video link */}
        {videos.length > 0 && (
          <div className="mt-auto pt-2 border-t border-border">
            <a
              href={`/?proVideoId=${videos[0].id}`}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {videos.length} swing clip{videos.length !== 1 ? "s" : ""} — load swing
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileGate({ missing, onOpenProfile }: { missing: string[]; onOpenProfile: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Complete your profile to find your comps</p>
          <p className="text-xs text-muted-foreground mt-0.5">We need a few more details to match you to the right MLB players.</p>
        </div>
      </div>
      <ul className="space-y-2">
        {["Age", "Height", "Weight", "Batting hand"].map(field => {
          const needed = missing.includes(field);
          return (
            <li key={field} className="flex items-center gap-2 text-sm">
              {needed
                ? <X size={14} className="text-destructive shrink-0" />
                : <CheckCircle2 size={14} className="text-primary shrink-0" />}
              <span className={needed ? "text-foreground" : "text-muted-foreground line-through"}>{field}</span>
            </li>
          );
        })}
      </ul>
      <Button size="sm" onClick={onOpenProfile}>
        Complete Profile
      </Button>
    </div>
  );
}

export default function Biometrics() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isPaid = user?.isAdmin || user?.subscriptionTier === "player" || user?.subscriptionTier === "pro" || user?.subscriptionTier === "coach";
  const [, navigate] = useLocation();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Missing profile fields check
  const missing: string[] = [];
  if (!user?.age) missing.push("Age");
  if (!user?.heightInches) missing.push("Height");
  if (!user?.weightLbs) missing.push("Weight");
  if (!user?.bats) missing.push("Batting hand");
  const profileComplete = missing.length === 0;

  // Load saved comps
  const { data: comps = [], isLoading: compsLoading } = useQuery<SavedComp[]>({
    queryKey: ["/api/biometrics/comps"],
    enabled: isPaid && !!user,
  });

  // Load all MLB players (for search)
  const { data: allPlayers = [] } = useQuery<MlbPlayer[]>({
    queryKey: ["/api/players"],
    queryFn: fetchPlayers,
    enabled: isPaid && !!user,
  });

  // Load pro videos for swing links
  const { data: allVideos = [] } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
    enabled: isPaid && !!user,
  });

  const proVideosByPlayer = useMemo(() => {
    const map = new Map<string, Video[]>();
    (allVideos as Video[]).filter(v => v.isProVideo && v.playerId).forEach(v => {
      const list = map.get(v.playerId!) ?? [];
      list.push(v);
      map.set(v.playerId!, list);
    });
    return map;
  }, [allVideos]);

  // Find comps mutation
  const findCompsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/biometrics/find-comps", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/biometrics/comps"] }),
  });

  // Add favorite
  const addFavoriteMutation = useMutation({
    mutationFn: async (mlbPlayerId: string) => {
      const res = await fetch("/api/biometrics/comps/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlbPlayerId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/biometrics/comps"] });
      setPlayerSearch("");
      setShowSearch(false);
    },
  });

  // Remove comp
  const removeCompMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/biometrics/comps/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/biometrics/comps"] }),
  });

  const autoComps = comps.filter(c => c.compType === "auto");
  const studyingComps = comps.filter(c => c.compType === "manual");

  // Already-saved player IDs (to avoid duplicates in search)
  const savedPlayerIds = new Set(comps.map(c => c.player?.id).filter(Boolean));

  const searchResults = useMemo(() => {
    if (!playerSearch.trim()) return [];
    const q = playerSearch.toLowerCase();
    return (allPlayers as MlbPlayer[])
      .filter(p => !savedPlayerIds.has(p.id) && (p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [playerSearch, allPlayers, savedPlayerIds]);

  // Paywall
  if (!isPaid) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display uppercase mb-2">Biometrics</h1>
            <p className="text-muted-foreground max-w-md">
              Find your pro comparison based on your height, weight, age, and batting hand.
              Upgrade to unlock personalized pro comps.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={() => navigate("/pricing")}>Upgrade to Unlock</Button>
            {!user && (
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>Sign In</Button>
            )}
          </div>
        </div>
        <AuthGateModal open={authGateOpen} onOpenChange={setAuthGateOpen} reason="Create an account and upgrade to access Biometrics." />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Biometrics</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Your Pro Comp</h1>
        <p className="text-muted-foreground">Find MLB hitters who match your physical profile.</p>
      </div>

      {/* Profile gate */}
      {!profileComplete && (
        <ProfileGate missing={missing} onOpenProfile={() => setProfileOpen(true)} />
      )}

      {/* My Comps */}
      {profileComplete && (
        <div>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display uppercase">My Comps</h2>
              {user?.heightInches && user?.weightLbs && (
                <span className="text-xs text-muted-foreground ml-1">
                  {Math.floor(user.heightInches / 12)}'{user.heightInches % 12}" · {user.weightLbs} lbs · Bats {user.bats}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => findCompsMutation.mutate()}
              disabled={findCompsMutation.isPending}
            >
              {findCompsMutation.isPending
                ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Finding…</>
                : autoComps.length === 0
                  ? <><Target size={14} className="mr-1.5" /> Find My Comps</>
                  : <><RefreshCw size={14} className="mr-1.5" /> Recalculate</>}
            </Button>
          </div>

          {compsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-4/3 bg-secondary" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-secondary rounded w-3/4" />
                    <div className="h-3 bg-secondary rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : autoComps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              <Target className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>Click "Find My Comps" to match your profile to MLB players.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {autoComps.map(comp => (
                <CompCard
                  key={comp.id}
                  comp={comp}
                  proVideosByPlayer={proVideosByPlayer}
                  onRemove={id => removeCompMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Players I'm Studying */}
      {profileComplete && (
        <div>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold font-display uppercase">Players I'm Studying</h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSearch(s => !s)}
            >
              <UserPlus size={14} className="mr-1.5" />
              Add Player
            </Button>
          </div>

          {/* Player search */}
          {showSearch && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  placeholder="Search by player name or team…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 border border-border rounded-lg bg-card overflow-hidden shadow-lg">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addFavoriteMutation.mutate(p.id)}
                      disabled={addFavoriteMutation.isPending}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover object-top shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{p.name[0]}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.team} · Bats {p.bats}</p>
                      </div>
                      <UserPlus size={14} className="text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {playerSearch.trim() && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2 px-1">No players found.</p>
              )}
            </div>
          )}

          {studyingComps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              <BookOpen className="w-7 h-7 mx-auto mb-3 opacity-30" />
              <p>Add players you're studying or want to model your swing after.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {studyingComps.map(comp => (
                <CompCard
                  key={comp.id}
                  comp={comp}
                  proVideosByPlayer={proVideosByPlayer}
                  onRemove={id => removeCompMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Sheet for completing profile */}
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Layout>
  );
}
