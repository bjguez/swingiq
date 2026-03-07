import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import VideoComparison from "@/components/VideoComparison";
import DataDashboard from "@/components/DataDashboard";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers } from "@/lib/api";
import { useState, useCallback, useRef } from "react";
import type { MlbPlayer } from "@shared/schema";

export default function Home() {
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: fetchPlayers });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [externalVideo, setExternalVideo] = useState<{ src: string; label: string } | null>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = selectedPlayerId 
    ? players.find((p: MlbPlayer) => p.id === selectedPlayerId) ?? null 
    : players[0] ?? null;

  const handleSelectUserVideo = useCallback((videoUrl: string, label: string) => {
    setExternalVideo({ src: videoUrl, label });
    comparisonRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Analysis Mode</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Swing Comparison</h1>
          <p className="text-muted-foreground">Syncing amateur mechanics against pro models for kinematic breakdown.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Player Selector */}
          <div className="flex gap-1 flex-wrap">
            {players.map((p: MlbPlayer) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                data-testid={`button-player-${p.id}`}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  (selectedPlayer?.id === p.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="border-border">Save Session</Button>
        </div>
      </div>

      <div ref={comparisonRef}>
        <VideoComparison
          externalLeftSrc={externalVideo?.src}
          externalLeftLabel={externalVideo?.label}
        />
      </div>

      <DataDashboard player={selectedPlayer} onSelectVideo={handleSelectUserVideo} />
    </Layout>
  );
}