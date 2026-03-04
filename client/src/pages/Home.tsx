import { Home as HomeIcon, Video, BarChart2, Search, Bell, Menu, User, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoComparison from "@/components/VideoComparison";
import DataDashboard from "@/components/DataDashboard";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-primary font-display font-bold text-2xl tracking-tighter">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <Video size={18} />
              </div>
              SwingMetrics
            </div>
            
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-medium">
                <HomeIcon className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" className="bg-secondary/50 text-foreground font-medium">
                <Video className="w-4 h-4 mr-2" />
                Analyze Room
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-medium">
                <BarChart2 className="w-4 h-4 mr-2" />
                Reports
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search MLB players..." 
                className="bg-secondary/50 border border-border rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors w-64"
              />
            </div>
            <VideoLibraryModal trigger={
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold hidden sm:flex">
                <Upload className="w-4 h-4 mr-2" />
                Upload Swing
              </Button>
            } />
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden ml-2 cursor-pointer">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col gap-6">
        
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

      </main>
    </div>
  );
}