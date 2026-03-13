import { useQuery } from "@tanstack/react-query";

interface GameScore {
  gamePk: number;
  status: "Preview" | "Live" | "Final";
  detailedState: string;
  awayTeam: string;
  awayScore: number;
  homeTeam: string;
  homeScore: number;
  inning: number | null;
  isTopInning: boolean;
  gameDate: string;
  sportId: number;
}

function formatGameTime(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}

function InningArrow({ isTop }: { isTop: boolean }) {
  return (
    <span className={`inline-block text-[8px] leading-none ${isTop ? "translate-y-[-1px]" : "translate-y-[1px]"}`}>
      {isTop ? "▲" : "▼"}
    </span>
  );
}

function GameChip({ game }: { game: GameScore }) {
  const isSpring = game.sportId === 17;

  return (
    <div className="flex items-center gap-2 px-3 shrink-0 border-r border-white/10 last:border-0">
      {isSpring && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-400/70 shrink-0">ST</span>
      )}

      {game.status === "Preview" ? (
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <span className="font-semibold text-white/80">{game.awayTeam}</span>
          <span>vs</span>
          <span className="font-semibold text-white/80">{game.homeTeam}</span>
          <span className="text-white/40 text-[10px]">{formatGameTime(game.gameDate)}</span>
        </div>
      ) : game.status === "Live" ? (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-white">{game.awayTeam}</span>
          <span className="font-bold text-primary tabular-nums">{game.awayScore}</span>
          <span className="text-white/30">·</span>
          <span className="font-bold text-white">{game.homeTeam}</span>
          <span className="font-bold text-primary tabular-nums">{game.homeScore}</span>
          <span className="text-white/50 text-[10px] flex items-center gap-0.5">
            <InningArrow isTop={game.isTopInning} />
            {game.inning}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <span className="font-semibold text-white/80">{game.awayTeam}</span>
          <span className="tabular-nums">{game.awayScore}</span>
          <span className="text-white/30">·</span>
          <span className="font-semibold text-white/80">{game.homeTeam}</span>
          <span className="tabular-nums">{game.homeScore}</span>
          <span className="text-[10px] text-white/40 font-bold">F</span>
        </div>
      )}
    </div>
  );
}

export default function ScoreTicker() {
  const { data, isLoading } = useQuery<{ games: GameScore[]; date: string }>({
    queryKey: ["/api/mlb/scores"],
    queryFn: () => fetch("/api/mlb/scores").then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const games = data?.games ?? [];

  if (!isLoading && games.length === 0) return null;

  const hasLive = games.some(g => g.status === "Live");

  // Duplicate games for seamless infinite scroll when there aren't many
  const displayGames = games.length > 0 && games.length < 6 ? [...games, ...games] : games;

  return (
    <div className="border-t border-white/5 bg-black/30 h-8 flex items-center overflow-hidden relative">
      {/* Left label */}
      <div className="flex items-center gap-1.5 px-3 shrink-0 border-r border-white/10 h-full bg-black/20">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          {hasLive ? "Live" : "Scores"}
        </span>
      </div>

      {/* Scrolling games */}
      {isLoading ? (
        <div className="flex items-center px-4 gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-3 bg-white/10 rounded animate-pulse w-24" />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden relative">
          <div
            className="flex items-center h-8 animate-ticker"
            style={{ width: "max-content" }}
          >
            {displayGames.map((game, i) => (
              <GameChip key={`${game.gamePk}-${i}`} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
