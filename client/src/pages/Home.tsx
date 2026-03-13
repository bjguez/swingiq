import Layout from "@/components/Layout";
import VideoComparison from "@/components/VideoComparison";
import DataDashboard from "@/components/DataDashboard";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers, fetchVideos } from "@/lib/api";
import { useState, useCallback, useRef, useMemo } from "react";
import { useSearch } from "wouter";
import type { MlbPlayer } from "@shared/schema";

export default function Home() {
  const search = useSearch();
  const proVideoId = useMemo(() => new URLSearchParams(search).get("proVideoId"), [search]);

  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: fetchPlayers });
  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos"], queryFn: () => fetchVideos(), enabled: !!proVideoId });

  const proVideo = useMemo(() => proVideoId ? allVideos.find((v: any) => v.id === proVideoId) ?? null : null, [proVideoId, allVideos]);

  const [externalVideo, setExternalVideo] = useState<{ src: string; label: string } | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = (
    selectedPlayerName
      ? (players as MlbPlayer[]).find(p => p.name.toLowerCase() === selectedPlayerName.toLowerCase()) ?? null
      : null
  );

  const handleSelectUserVideo = useCallback((videoUrl: string, label: string) => {
    setExternalVideo({ src: videoUrl, label });
    comparisonRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleRightVideoSelected = useCallback((label: string) => {
    setSelectedPlayerName(label);
  }, []);

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Analysis Mode</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Swing Comparison</h1>
        <p className="text-muted-foreground">Syncing amateur mechanics against pro models for kinematic breakdown.</p>
      </div>

      <div ref={comparisonRef}>
        <VideoComparison
          externalLeftSrc={externalVideo?.src}
          externalLeftLabel={externalVideo?.label}
          externalRightSrc={proVideo?.sourceUrl ?? null}
          externalRightLabel={proVideo?.playerName ?? undefined}
          onRightVideoSelected={handleRightVideoSelected}
        />
      </div>

      <DataDashboard player={selectedPlayer} onSelectVideo={handleSelectUserVideo} />
    </Layout>
  );
}