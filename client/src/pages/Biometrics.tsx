import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers, fetchVideos } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AuthGateModal } from "@/components/AuthGateModal";
import { Lock, Ruler, Weight, Zap, Target, PlayCircle, ChevronRight } from "lucide-react";
import type { MlbPlayer, Video } from "@shared/schema";

// Parse "6'2"" or "6' 2\"" → total inches
function parseHeightToInches(h: string): number {
  const m = h.match(/(\d+)'\s*(\d*)/);
  if (!m) return 0;
  return parseInt(m[1]) * 12 + (parseInt(m[2]) || 0);
}

function inchesToDisplay(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function similarityScore(
  userH: number, userW: number, userBats: string | null | undefined,
  pro: MlbPlayer
): number {
  // If bats mismatch (both known), exclude
  if (userBats && pro.bats && userBats !== pro.bats && pro.bats !== "S") return -1;

  const proH = pro.height ? parseHeightToInches(pro.height) : 0;
  const proW = pro.weight ?? 0;

  const heightScore = proH > 0 ? Math.max(0, 1 - Math.abs(userH - proH) / 8) : 0.5;
  const weightScore = proW > 0 ? Math.max(0, 1 - Math.abs(userW - proW) / 40) : 0.5;

  return (heightScore * 0.5 + weightScore * 0.5);
}

export default function Biometrics() {
  const { user, updateProfile, isUpdatingProfile } = useAuth();
  const isPaid = user?.isAdmin || user?.subscriptionTier === "player" || user?.subscriptionTier === "pro";
  const [, navigate] = useLocation();
  const [authGateOpen, setAuthGateOpen] = useState(false);

  const [heightFt, setHeightFt] = useState(() => user?.heightInches ? String(Math.floor(user.heightInches / 12)) : "");
  const [heightIn, setHeightIn] = useState(() => user?.heightInches ? String(user.heightInches % 12) : "");
  const [weight, setWeight] = useState(() => user?.weightLbs ? String(user.weightLbs) : "");
  const [saved, setSaved] = useState(false);

  const { data: players = [] } = useQuery({
    queryKey: ["/api/players"],
    queryFn: fetchPlayers,
    enabled: isPaid,
  });

  const { data: allVideos = [] } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
    enabled: isPaid,
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

  const totalInches = parseInt(heightFt || "0") * 12 + parseInt(heightIn || "0");
  const weightNum = parseInt(weight || "0");
  const hasMetrics = totalInches > 0 && weightNum > 0;

  const comps = useMemo(() => {
    if (!hasMetrics) return [];
    return (players as MlbPlayer[])
      .map(p => ({ player: p, score: similarityScore(totalInches, weightNum, user?.bats, p) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [players, totalInches, weightNum, user?.bats, hasMetrics]);

  const handleSave = async () => {
    if (!totalInches || !weightNum) return;
    await updateProfile({ heightInches: totalInches, weightLbs: weightNum });
    setSaved(true);
  };

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
              Find your pro comparison based on your height, weight, and batting hand.
              Upgrade to unlock personalized pro comps.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={() => navigate("/pricing")}>
              Upgrade to Unlock
            </Button>
            {!user && (
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
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

      {/* Measurements Input */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Your Measurements</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Height */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-primary" /> Height
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="number" min={4} max={7} placeholder="6"
                  value={heightFt}
                  onChange={e => { setHeightFt(e.target.value); setSaved(false); }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
              </div>
              <div className="relative flex-1">
                <Input
                  type="number" min={0} max={11} placeholder="2"
                  value={heightIn}
                  onChange={e => { setHeightIn(e.target.value); setSaved(false); }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
              </div>
            </div>
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5">
              <Weight className="w-4 h-4 text-primary" /> Weight
            </label>
            <div className="relative">
              <Input
                type="number" min={80} max={400} placeholder="185"
                value={weight}
                onChange={e => { setWeight(e.target.value); setSaved(false); }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">lbs</span>
            </div>
          </div>

          {/* Bats (display only from profile) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">Bats</label>
            <div className="h-10 flex items-center px-3 bg-secondary/50 border border-border rounded-md text-sm">
              {user?.bats ? (
                <span className="font-semibold">{user.bats === "L" ? "Left" : "Right"}</span>
              ) : (
                <span className="text-muted-foreground text-xs">Set in your profile</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleSave} disabled={!hasMetrics || isUpdatingProfile}>
            {isUpdatingProfile ? "Saving..." : "Save & Find Comps"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          {saved && <p className="text-xs text-primary">Saved!</p>}
        </div>
      </div>

      {/* Pro Comps */}
      {comps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 border-b border-border pb-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold font-display uppercase">Your Best Comps</h2>
            <span className="text-xs text-muted-foreground ml-1">
              Matched on {inchesToDisplay(totalInches)} · {weightNum} lbs{user?.bats ? ` · Bats ${user.bats}` : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {comps.map(({ player, score }) => {
              const videos = proVideosByPlayer.get(player.id) ?? [];
              const matchPct = Math.round(score * 100);
              return (
                <div key={player.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors flex flex-col">
                  {/* Player image */}
                  <div className="relative aspect-[4/3] bg-secondary flex items-center justify-center overflow-hidden">
                    {player.imageUrl ? (
                      <img src={player.imageUrl} alt={player.name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{player.name[0]}</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-bold text-primary">
                      {matchPct}% match
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="font-bold text-sm">{player.name}</p>
                      <p className="text-xs text-muted-foreground">{player.team} · {player.position}</p>
                    </div>

                    {/* Physical comparison */}
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="bg-secondary/50 rounded px-2 py-1">
                        <p className="text-muted-foreground">Height</p>
                        <p className="font-semibold">{player.height ?? "—"}</p>
                      </div>
                      <div className="bg-secondary/50 rounded px-2 py-1">
                        <p className="text-muted-foreground">Weight</p>
                        <p className="font-semibold">{player.weight ? `${player.weight} lbs` : "—"}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    {(player.avgExitVelo || player.batSpeed) && (
                      <div className="flex gap-1 text-xs flex-wrap">
                        {player.avgExitVelo && (
                          <span className="flex items-center gap-0.5 bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold">
                            <Zap className="w-3 h-3" />{player.avgExitVelo.toFixed(1)} EV
                          </span>
                        )}
                        {player.batSpeed && (
                          <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold text-xs">
                            {player.batSpeed.toFixed(0)} mph bat
                          </span>
                        )}
                        {player.barrelPct && (
                          <span className="bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-mono text-xs">
                            {player.barrelPct.toFixed(1)}% brl
                          </span>
                        )}
                      </div>
                    )}

                    {/* Swing videos */}
                    {videos.length > 0 && (
                      <div className="mt-auto pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1.5">{videos.length} swing clip{videos.length !== 1 ? "s" : ""} available</p>
                        <a href={`/?proVideoId=${videos[0].id}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold">
                          <PlayCircle className="w-3.5 h-3.5" /> Load swing
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hasMetrics && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Enter your height and weight above to find your pro comparisons.
        </div>
      )}
    </Layout>
  );
}
