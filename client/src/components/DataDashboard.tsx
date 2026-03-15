import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, ChevronRight, Film, User, Search, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { UserVideoCard } from "./UserVideoCard";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import type { MlbPlayer, Video } from "@shared/schema";
import { fetchVideos, fetchPlayersPage, fetchVideoPresignedUrl } from "@/lib/api";

interface AwardEntry {
  award: { id: string; name: string };
  season: string;
}

function getAwardDisplay(award: { id: string; name: string } | null | undefined): { emoji: string; label: string } | null {
  if (!award) return null;
  const id = (award.id ?? "").toUpperCase();
  const name = (award.name ?? "").toLowerCase();
  if (id === "ALMVP" || id === "NLMVP" || name.includes("most valuable player")) return { emoji: "🏆", label: "MVP" };
  if (id === "ALSS" || id === "NLSS" || name.includes("silver slugger")) return { emoji: "🥈", label: "Silver Slugger" };
  if (id === "ALGG" || id === "NLGG" || name.includes("gold glove")) return { emoji: "🥇", label: "Gold Glove" };
  if (id === "ALROY" || id === "NLROY" || name.includes("rookie of the year")) return { emoji: "🌟", label: "Rookie of the Year" };
  if (name.includes("hank aaron")) return { emoji: "👑", label: "Hank Aaron Award" };
  if (id.includes("AS") || name.includes("all-star") || name.includes("all star")) return { emoji: "⭐", label: "All-Star" };
  return null;
}

interface DataDashboardProps {
  player: MlbPlayer | null;
  onSelectVideo?: (videoUrl: string, label?: string) => void;
  onSelectProVideo?: (videoUrl: string, label?: string) => void;
  onPlayerSelected?: (playerName: string) => void;
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function DataDashboard({ player, onSelectVideo, onSelectProVideo, onPlayerSelected }: DataDashboardProps) {
  const { data: allVideos = [] } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
  });
  const userVideos = allVideos.filter(v => !v.isProVideo && v.sourceUrl);

  const { data: awards = [] } = useQuery<AwardEntry[]>({
    queryKey: ["/api/mlb/players/awards", player?.savantId],
    queryFn: () => fetch(`/api/mlb/players/${player!.savantId}/awards`).then(r => r.json()),
    enabled: !!player?.savantId,
  });

  if (!player) {
    return (
      <div className="space-y-6">
        <PlayerCardGrid onPlayerSelected={onPlayerSelected} />
        {userVideos.length > 0 && <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerHeader player={player} onBack={() => onPlayerSelected?.("")} awards={awards} />
      <PlayerStatsSection player={player} awards={awards} />
      <PlayerClipsSection player={player} allVideos={allVideos} onSelectProVideo={onSelectProVideo} />
      {userVideos.length > 0 && <UserVideosSection videos={userVideos} onSelectVideo={onSelectVideo} />}
      <PlayerCardGrid onPlayerSelected={onPlayerSelected} />
    </div>
  );
}

// ─── Player Card Grid (empty state) ──────────────────────────────────────────

function useVisibleCount() {
  const [count, setCount] = useState(() => {
    if (typeof window === "undefined") return 9;
    if (window.innerWidth < 640) return 3;
    if (window.innerWidth < 1024) return 6;
    return 9;
  });
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCount(3);
      else if (window.innerWidth < 1024) setCount(6);
      else setCount(9);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
}

function PlayerCardGrid({ onPlayerSelected }: { onPlayerSelected?: (name: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [batsFilter, setBatsFilter] = useState<"" | "L" | "R" | "S">("");
  const visibleCount = useVisibleCount();

  // Stable random seed per session — different order every visit
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const isFiltering = !!debouncedSearch || !!batsFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/players/page", { search: debouncedSearch, bats: batsFilter, limit: isFiltering ? 200 : visibleCount, seed }],
    queryFn: () => fetchPlayersPage({
      search: debouncedSearch || undefined,
      bats: batsFilter || undefined,
      limit: isFiltering ? 200 : visibleCount,
      seed,
    }),
  });

  const players = data?.players ?? [];
  const total = data?.total ?? 0;
  const visible = players;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-display">Compare Against a Pro</h2>
        <span className="text-xs text-muted-foreground">{total} players</span>
      </div>

      {/* Search + Bats filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search players or teams..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          {(["", "L", "R", "S"] as const).map(v => (
            <button
              key={v}
              onClick={() => setBatsFilter(v)}
              className={`px-3 h-9 text-xs font-semibold rounded-md border transition-colors ${
                batsFilter === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "" ? "All" : `Bats ${v}`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
              <div className="h-8 bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          No players match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04, ease: "easeOut" }}
            >
              <PlayerCard player={p} onPlayerSelected={onPlayerSelected} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Player Card ─────────────────────────────────────────────────────────────

function PlayerCard({ player: p, onPlayerSelected }: { player: MlbPlayer; onPlayerSelected?: (name: string) => void }) {
  const headshot = p.savantId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.savantId}/headshot/67/current`
    : null;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center">
          {headshot ? (
            <img src={headshot} alt={p.name} className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <User className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{p.name}</p>
          <p className="text-xs text-muted-foreground truncate">{p.team} · {p.position}</p>
        </div>
      </div>
      {(p.height || p.weight || p.bats) && (
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {p.height && <span className="bg-secondary/50 px-2 py-0.5 rounded">{p.height}</span>}
          {p.weight && <span className="bg-secondary/50 px-2 py-0.5 rounded">{p.weight} lbs</span>}
          {p.bats && <span className="bg-secondary/50 px-2 py-0.5 rounded">Bats {p.bats === "R" ? "R" : p.bats === "L" ? "L" : "S"}</span>}
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="w-full group-hover:bg-primary/10 group-hover:border-primary/40 group-hover:text-primary transition-colors"
        onClick={() => onPlayerSelected?.(p.name)}
      >
        View Profile
      </Button>
    </motion.div>
  );
}

// ─── Award Badges ─────────────────────────────────────────────────────────────

function AwardBadges({ awards }: { awards: AwardEntry[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { emoji: string; label: string; years: string[] }>();
    for (const a of awards) {
      const display = getAwardDisplay(a.award);
      if (!display) continue;
      const key = display.emoji + display.label;
      if (!map.has(key)) map.set(key, { ...display, years: [] });
      map.get(key)!.years.push(a.season);
    }
    return Array.from(map.values());
  }, [awards]);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {groups.map(({ emoji, label, years }) => (
        <span
          key={emoji + label}
          className="flex items-center gap-1 bg-secondary/60 border border-border/60 rounded-full px-2 py-0.5 text-xs text-muted-foreground"
          title={`${label}: ${years.sort().join(", ")}`}
        >
          <span>{emoji}</span>
          <span>{years.length > 1 ? `${years.length}×` : years[0]}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Player Header ────────────────────────────────────────────────────────────

function PlayerHeader({ player, onBack, awards = [] }: { player: MlbPlayer; onBack?: () => void; awards?: AwardEntry[] }) {
  const headshotUrl = player.savantId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.savantId}/headshot/67/current`
    : player.imageUrl ?? null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-5">
      <div className="w-16 h-16 rounded-full bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {headshotUrl ? (
          <img
            src={headshotUrl}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">
            {player.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold font-display">{player.name}</h2>
        <p className="text-muted-foreground text-sm">
          {player.team} · {player.position} · Bats {player.bats === "R" ? "Right" : player.bats === "L" ? "Left" : "Switch"}
          {player.height && ` · ${player.height}`}
          {player.weight && `, ${player.weight} lbs`}
        </p>
        <AwardBadges awards={awards} />
      </div>
      {onBack && (
        <button
          onClick={onBack}
          className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Change Player
        </button>
      )}
    </div>
  );
}

// ─── Player Stats ─────────────────────────────────────────────────────────────

// Baseball convention: strip leading zero from rate stats (.309 not 0.309)
function fmtRate(v: number | null | undefined): string | null {
  if (v == null) return null;
  return v.toFixed(3).replace(/^0\./, ".");
}

type StatKey = "avg" | "hr" | "rbi" | "obp" | "slg" | "ops";

function statColor(stat: StatKey, value: string | number | null | undefined): string {
  if (value == null) return "";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "";
  switch (stat) {
    case "avg": return n >= 0.300 ? "text-green-400" : n >= 0.275 ? "text-orange-400" : "";
    case "hr":  return n >= 30   ? "text-green-400" : n >= 20    ? "text-orange-400" : "";
    case "rbi": return n >= 100  ? "text-green-400" : n >= 75    ? "text-orange-400" : "";
    case "obp": return n >= 0.400 ? "text-green-400" : n >= 0.350 ? "text-orange-400" : "";
    case "slg": return n >= 0.550 ? "text-green-400" : n >= 0.475 ? "text-orange-400" : "";
    case "ops": return n >= 0.900 ? "text-green-400" : n >= 0.800 ? "text-orange-400" : "";
  }
}

function StatTile({ label, value, isRate = false, stat }: { label: string; value: number | null | undefined; isRate?: boolean; stat?: StatKey }) {
  if (value == null) return null;
  const display = isRate ? fmtRate(value)! : String(value);
  const color = stat ? statColor(stat, value) : "";
  return (
    <div className="bg-secondary/40 rounded-lg p-3 flex flex-col gap-1">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold leading-tight">{label}</p>
      <p className={`text-2xl font-bold font-mono leading-none ${color || "text-foreground"}`}>{display}</p>
    </div>
  );
}

interface SeasonSplit {
  season: string;
  team: { name: string };
  stat: {
    gamesPlayed: number;
    atBats: number;
    avg: string;
    homeRuns: number;
    rbi: number;
    obp: string;
    slg: string;
    ops: string;
  };
}

function PlayerStatsSection({ player, awards = [] }: { player: MlbPlayer; awards?: AwardEntry[] }) {
  const [showTable, setShowTable] = useState(false);

  const { data: statsData, isLoading } = useQuery<{ seasons: SeasonSplit[]; career: any }>({
    queryKey: ["/api/mlb/players/stats", player.savantId],
    queryFn: () => fetch(`/api/mlb/players/${player.savantId}/stats`).then(r => r.json()),
    enabled: !!player.savantId && showTable,
  });

  // Extract 4-digit year from whatever format the awards API returns
  const yearOf = (s: string | number) => String(s).match(/\d{4}/)?.[0] ?? String(s);

  const awardsByYear = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of awards) {
      const display = getAwardDisplay(a.award);
      if (!display) continue;
      const key = yearOf(a.season);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(display.emoji);
    }
    return map;
  }, [awards]);

  const hasStats = player.battingAvg != null || player.homeRuns != null || player.rbi != null ||
    player.obp != null || player.slg != null || player.ops != null;

  if (!hasStats && !player.savantId) return null;

  const seasons = (statsData?.seasons ?? []).slice().reverse(); // most recent first

  // Strip leading zero from MLB API rate strings (e.g. ".309" → keep, "0.309" → ".309")
  const fmt = (v: string | number | null | undefined) => {
    if (v == null) return "—";
    const s = String(v);
    return s.replace(/^0(\.\d+)$/, "$1");
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Career Stats</h3>
        {player.savantId && (
          <button
            onClick={() => setShowTable(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            {showTable ? "Hide" : "Year-by-Year"}
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showTable ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>

      {hasStats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatTile label="AVG" value={player.battingAvg} isRate stat="avg" />
          <StatTile label="HR" value={player.homeRuns} stat="hr" />
          <StatTile label="RBI" value={player.rbi} stat="rbi" />
          <StatTile label="OBP" value={player.obp} isRate stat="obp" />
          <StatTile label="SLG" value={player.slg} isRate stat="slg" />
          <StatTile label="OPS" value={player.ops} isRate stat="ops" />
        </div>
      )}

      {showTable && (
        <div className="overflow-x-auto rounded-lg border border-border">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading season stats…</div>
          ) : seasons.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No season data available.</div>
          ) : (
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="bg-secondary/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2 font-semibold">Year</th>
                  <th className="text-left px-3 py-2 font-semibold">Team</th>
                  <th className="text-right px-3 py-2 font-semibold">G</th>
                  <th className="text-right px-3 py-2 font-semibold">AB</th>
                  <th className="text-right px-3 py-2 font-semibold">AVG</th>
                  <th className="text-right px-3 py-2 font-semibold">HR</th>
                  <th className="text-right px-3 py-2 font-semibold">RBI</th>
                  <th className="text-right px-3 py-2 font-semibold">OBP</th>
                  <th className="text-right px-3 py-2 font-semibold">SLG</th>
                  <th className="text-right px-3 py-2 font-semibold">OPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {seasons.map((s, i) => (
                  <tr key={`${s.season}-${i}`} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-3 py-2 font-bold text-foreground whitespace-nowrap">
                      {s.season}
                      {(awardsByYear.get(yearOf(s.season)) ?? []).map((e, j) => (
                        <span key={j} className="ml-0.5">{e}</span>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-25">{s.team?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{s.stat.gamesPlayed ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{s.stat.atBats ?? "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${statColor("avg", s.stat.avg) || "text-foreground"}`}>{fmt(s.stat.avg)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${statColor("hr", s.stat.homeRuns) || "text-foreground"}`}>{s.stat.homeRuns ?? "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${statColor("rbi", s.stat.rbi) || "text-foreground"}`}>{s.stat.rbi ?? "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${statColor("obp", s.stat.obp) || "text-foreground"}`}>{fmt(s.stat.obp)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${statColor("slg", s.stat.slg) || "text-foreground"}`}>{fmt(s.stat.slg)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${statColor("ops", s.stat.ops) || "text-foreground"}`}>{fmt(s.stat.ops)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Legend */}
      {(hasStats || awards.length > 0) && (
        <div className="border-t border-border/40 pt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Legend</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span><span className="text-orange-400 font-semibold">Orange</span> = Great &nbsp;<span className="text-green-400 font-semibold">Green</span> = Elite</span>
            <span>AVG <span className="text-orange-400">.275+</span> / <span className="text-green-400">.300+</span></span>
            <span>HR <span className="text-orange-400">20+</span> / <span className="text-green-400">30+</span></span>
            <span>RBI <span className="text-orange-400">75+</span> / <span className="text-green-400">100+</span></span>
            <span>OBP <span className="text-orange-400">.350+</span> / <span className="text-green-400">.400+</span></span>
            <span>SLG <span className="text-orange-400">.475+</span> / <span className="text-green-400">.550+</span></span>
            <span>OPS <span className="text-orange-400">.800+</span> / <span className="text-green-400">.900+</span></span>
          </div>
          {awards.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>⭐ All-Star</span>
              <span>🏆 MVP</span>
              <span>🥈 Silver Slugger</span>
              <span>🥇 Gold Glove</span>
              <span>🌟 Rookie of the Year</span>
              <span>👑 Hank Aaron Award</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Player Clips ─────────────────────────────────────────────────────────────

function PlayerClipsSection({
  player, allVideos, onSelectProVideo,
}: {
  player: MlbPlayer;
  allVideos: Video[];
  onSelectProVideo?: (url: string, label?: string) => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState<string>("all");

  const playerClips = allVideos.filter(
    v => v.isProVideo && v.sourceUrl &&
      (v.playerId === player.id || v.playerName?.toLowerCase() === player.name.toLowerCase())
  );

  const availableSeasons = [...new Set(
    playerClips.map(v => (v as any).season).filter(Boolean) as number[]
  )].sort((a, b) => b - a).map(String);

  const visibleClips = selectedSeason === "all"
    ? playerClips
    : playerClips.filter(v => String((v as any).season) === selectedSeason);

  if (playerClips.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
        No clips in library for {player.name} yet.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 pt-5 pb-0 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Pro Clips</h3>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">{visibleClips.length}</span>
        </div>
        {availableSeasons.length > 0 && (
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            <SeasonTab label="All" active={selectedSeason === "all"} onClick={() => setSelectedSeason("all")} />
            {availableSeasons.map(year => (
              <SeasonTab key={year} label={year} active={selectedSeason === year} onClick={() => setSelectedSeason(year)} />
            ))}
          </div>
        )}
      </div>
      <div className="p-5">
        {visibleClips.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleClips.map(video => (
              <UserVideoCard
                key={video.id}
                video={video}
                onSelect={onSelectProVideo ? async (v) => {
                  try {
                    const url = await fetchVideoPresignedUrl(v.id);
                    onSelectProVideo(url, player.name);
                  } catch {
                    onSelectProVideo(v.sourceUrl!, player.name);
                  }
                } : undefined}
                playLabel="Analyze"
                showDelete={false}
                showTrim={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clips tagged to {selectedSeason}.</p>
        )}
      </div>
    </div>
  );
}

function SeasonTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground bg-primary/10"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Recent User Swings ───────────────────────────────────────────────────────

function UserVideosSection({ videos, onSelectVideo }: {
  videos: Video[];
  onSelectVideo?: (videoUrl: string, label?: string) => void;
}) {
  const recent = videos.slice(0, 4);
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-xl uppercase text-muted-foreground">Recent Swings</h3>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">{videos.length}</span>
        </div>
        <Link href="/my-swings">
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {recent.map(video => (
          <UserVideoCard
            key={video.id}
            video={video}
            onSelect={onSelectVideo ? (v) => onSelectVideo(v.sourceUrl!, v.title) : undefined}
            showDelete={false}
            showTrim={true}
          />
        ))}
      </div>
    </div>
  );
}
