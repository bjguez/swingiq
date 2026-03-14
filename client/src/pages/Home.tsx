import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import VideoComparison from "@/components/VideoComparison";
import DataDashboard from "@/components/DataDashboard";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers, fetchVideos } from "@/lib/api";
import { useState, useCallback, useRef, useMemo } from "react";
import { useSearch } from "wouter";
import { Upload, Users, X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MlbPlayer } from "@shared/schema";

export default function Home() {
  const search = useSearch();
  const proVideoId = useMemo(() => new URLSearchParams(search).get("proVideoId"), [search]);

  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: fetchPlayers });
  const { data: allVideos = [] } = useQuery({ queryKey: ["/api/videos"], queryFn: () => fetchVideos(), enabled: !!proVideoId });

  const proVideo = useMemo(() => proVideoId ? allVideos.find((v: any) => v.id === proVideoId) ?? null : null, [proVideoId, allVideos]);

  const [externalVideo, setExternalVideo] = useState<{ src: string; label: string } | null>(null);
  const [externalProVideo, setExternalProVideo] = useState<{ src: string; label: string } | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = (
    selectedPlayerName
      ? (players as MlbPlayer[]).find(p => p.name.toLowerCase() === selectedPlayerName.toLowerCase()) ?? null
      : null
  );

  const handleSelectUserVideo = useCallback((videoUrl: string, label?: string) => {
    setExternalVideo({ src: videoUrl, label: label ?? "My Swing" });
    comparisonRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSelectProVideo = useCallback((videoUrl: string, label?: string) => {
    setExternalProVideo({ src: videoUrl, label: label ?? "Pro Swing" });
  }, []);

  const handleRightVideoSelected = useCallback((label: string) => {
    setSelectedPlayerName(label);
  }, []);

  const handlePlayerSelected = useCallback((playerName: string) => {
    setSelectedPlayerName(playerName);
  }, []);

  const leftLoaded = !!externalVideo;
  const rightLoaded = !!proVideo || !!externalProVideo;
  const guideVisible = showGuide && (!leftLoaded || !rightLoaded);

  const finalRightSrc = proVideo?.sourceUrl ?? externalProVideo?.src ?? null;
  const finalRightLabel = proVideo?.playerName ?? externalProVideo?.label ?? undefined;

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

      {/* Getting Started Guide */}
      {guideVisible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-card border border-border rounded-xl p-5 relative"
        >
          <button
            onClick={() => setShowGuide(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Get Started</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1 */}
            <div className={`flex flex-col gap-3 p-4 rounded-lg border transition-colors ${leftLoaded ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${leftLoaded ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {leftLoaded ? "✓" : "1"}
                </div>
                <Upload className={`w-4 h-4 ${leftLoaded ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-sm">Upload Your Swing</p>
              </div>
              <p className="text-xs text-muted-foreground">Add your swing video to the left panel for frame-by-frame breakdown.</p>
              {!leftLoaded && (
                <VideoLibraryModal
                  mode="user"
                  onVideoSelected={handleSelectUserVideo}
                  trigger={
                    <Button size="sm" variant="outline" className="w-full mt-auto">
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Swing
                    </Button>
                  }
                />
              )}
            </div>

            {/* Step 2 */}
            <div className={`flex flex-col gap-3 p-4 rounded-lg border transition-colors ${rightLoaded ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rightLoaded ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {rightLoaded ? "✓" : "2"}
                </div>
                <Users className={`w-4 h-4 ${rightLoaded ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-sm">Pick a Pro Comp</p>
              </div>
              <p className="text-xs text-muted-foreground">Load a pro swing into the right panel to compare mechanics side-by-side.</p>
              {!rightLoaded && (
                <VideoLibraryModal
                  mode="pro"
                  onVideoSelected={handleSelectProVideo}
                  trigger={
                    <Button size="sm" variant="outline" className="w-full mt-auto">
                      <Users className="w-3.5 h-3.5 mr-1.5" /> Browse Pro Clips
                    </Button>
                  }
                />
              )}
            </div>

            {/* Step 3 */}
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-secondary text-muted-foreground">
                  3
                </div>
                <Target className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Find Your Edge</p>
              </div>
              <p className="text-xs text-muted-foreground">Measure joint angles, trace hand paths, and pinpoint the mechanical differences that separate good from elite.</p>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={comparisonRef}>
        <VideoComparison
          externalLeftSrc={externalVideo?.src}
          externalLeftLabel={externalVideo?.label}
          externalRightSrc={finalRightSrc}
          externalRightLabel={finalRightLabel}
          onRightVideoSelected={handleRightVideoSelected}
        />
      </div>

      <DataDashboard
        player={selectedPlayer}
        onSelectVideo={handleSelectUserVideo}
        onSelectProVideo={handleSelectProVideo}
        onPlayerSelected={handlePlayerSelected}
      />
    </Layout>
  );
}