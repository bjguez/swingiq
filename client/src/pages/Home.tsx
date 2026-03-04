import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import VideoComparison from "@/components/VideoComparison";
import DataDashboard from "@/components/DataDashboard";

export default function Home() {
  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Analysis Mode</span>
            <span className="text-sm text-muted-foreground">Session #8492</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Swing Comparison</h1>
          <p className="text-muted-foreground">Syncing amateur mechanics against pro models for kinematic breakdown.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border">Save Session</Button>
          <Button size="sm" className="bg-white text-black hover:bg-white/90">Export Report</Button>
        </div>
      </div>

      {/* Video Comparison Grid */}
      <VideoComparison />

      {/* Data Analytics Dashboard */}
      <DataDashboard />
    </Layout>
  );
}