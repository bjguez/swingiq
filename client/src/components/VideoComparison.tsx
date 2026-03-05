import { useState } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Maximize2, 
  Settings2, Download, MousePointer2, PenTool, 
  Circle, Square, Type, Undo, Trash2, Link2, 
  Youtube, Search, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { VideoLibraryModal } from "./VideoLibraryModal";
import proSwingImg from "@/assets/images/pro-swing.png";
import amateurSwingImg from "@/assets/images/amateur-swing.png";

export default function VideoComparison() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([35]);
  const [synced, setSynced] = useState(true);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card border border-border rounded-xl p-4 shadow-lg">
      
      {/* Left Toolbar (Drawing & Tools) */}
      <div className="lg:col-span-1 flex lg:flex-col gap-2 items-center justify-start py-2 border-b lg:border-b-0 lg:border-r border-border pr-0 lg:pr-4 overflow-x-auto lg:overflow-x-visible">
        <ToolButton icon={<MousePointer2 className="w-5 h-5" />} active tooltip="Select" />
        <ToolButton icon={<PenTool className="w-5 h-5" />} tooltip="Draw Lines" />
        <ToolButton icon={<Circle className="w-5 h-5" />} tooltip="Angles/Circles" />
        <ToolButton icon={<Square className="w-5 h-5" />} tooltip="Zones" />
        <ToolButton icon={<Type className="w-5 h-5" />} tooltip="Text Notes" />
        
        <div className="w-px h-6 lg:w-6 lg:h-px bg-border my-2 flex-shrink-0" />
        
        <div className="flex flex-col gap-2">
          <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-background cursor-pointer hover:scale-110 transition-transform"></div>
          <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-background cursor-pointer hover:scale-110 transition-transform"></div>
          <div className="w-6 h-6 rounded-full bg-primary border-2 border-background cursor-pointer hover:scale-110 transition-transform"></div>
        </div>

        <div className="w-px h-6 lg:w-6 lg:h-px bg-border my-2 flex-shrink-0" />

        <ToolButton icon={<Undo className="w-5 h-5" />} tooltip="Undo" />
        <ToolButton icon={<Trash2 className="w-5 h-5" />} tooltip="Clear All" />
      </div>

      {/* Main Video Area */}
      <div className="lg:col-span-11 flex flex-col gap-4">
        
        {/* Videos Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Amateur Video */}
          <div className="relative group rounded-lg overflow-hidden border border-border bg-black aspect-video flex flex-col">
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-start">
              <div>
                <div className="text-white font-bold font-display text-lg drop-shadow-md">Amateur Swing</div>
                <div className="text-white/70 text-xs">Local Upload • 60fps</div>
              </div>
              <div className="flex items-center gap-2">
                <VideoLibraryModal trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40">
                    <Upload className="w-4 h-4" />
                  </Button>
                } />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 relative z-10">
              <img src={amateurSwingImg} alt="Amateur Swing" className="w-full h-full object-cover opacity-90" />
              {/* Mock Drawing Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="45" y1="20" x2="55" y2="80" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="1,1" />
                <circle cx="45" cy="20" r="3" stroke="#eab308" strokeWidth="0.5" fill="none" />
                <path d="M 45 20 Q 50 15 55 25" stroke="#22c55e" strokeWidth="0.5" fill="none" />
              </svg>
            </div>
          </div>

          {/* Pro Video */}
          <div className="relative group rounded-lg overflow-hidden border border-border bg-black aspect-video flex flex-col">
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-start">
              <div>
                <div className="text-white font-bold font-display text-lg drop-shadow-md">Mike Trout</div>
                <div className="text-white/70 text-xs">MLB Library • 120fps</div>
              </div>
              <div className="flex items-center gap-2">
                <VideoLibraryModal trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40">
                    <Search className="w-4 h-4" />
                  </Button>
                } />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 relative z-10">
              <img src={proSwingImg} alt="Pro Swing" className="w-full h-full object-cover opacity-90" />
              {/* Mock Drawing Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="48" y1="18" x2="52" y2="78" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="1,1" />
                <circle cx="48" cy="18" r="3" stroke="#eab308" strokeWidth="0.5" fill="none" />
                <path d="M 48 18 Q 55 12 60 22" stroke="#22c55e" strokeWidth="0.5" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Global Playback Controls */}
        <div className="bg-secondary/30 border border-border rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              className={`h-10 w-10 shrink-0 ${synced ? 'bg-primary/20 text-primary border-primary/50' : 'text-muted-foreground'}`}
              onClick={() => setSynced(!synced)}
              title="Sync Playback"
            >
              <Link2 className="w-5 h-5" />
            </Button>
            
            <div className="flex-1 relative group cursor-pointer h-8 flex items-center">
              <Slider 
                value={progress} 
                onValueChange={setProgress} 
                max={100} 
                step={0.1}
                className="w-full relative z-10" 
              />
              {/* Timeline markers mock */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 pointer-events-none flex justify-between px-2 opacity-50">
                <div className="w-1 h-3 bg-red-500/50 -mt-1 rounded-full"></div>
                <div className="w-1 h-3 bg-yellow-500/50 -mt-1 rounded-full"></div>
                <div className="w-1 h-3 bg-green-500/50 -mt-1 rounded-full"></div>
                <div className="w-1 h-3 bg-blue-500/50 -mt-1 rounded-full"></div>
              </div>
            </div>
            
            <div className="text-sm font-mono text-muted-foreground w-20 text-right">
              -0.14s
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex space-x-1 mr-4 border-r border-border pr-4">
                <Badge active>Gather</Badge>
                <Badge>Touchdown</Badge>
                <Badge>Thrust</Badge>
              </div>

              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button 
                size="icon" 
                className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="w-6 h-6 ml-0.5" /> : <Play className="w-6 h-6 ml-1" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <VideoLibraryModal trigger={
                <Button variant="outline" size="sm" className="hidden sm:flex border-border bg-secondary/50">
                  <Youtube className="w-4 h-4 mr-2 text-red-500" />
                  Import MLB clip
                </Button>
              } />
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                <Maximize2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

function ToolButton({ icon, active, tooltip }: { icon: React.ReactNode, active?: boolean, tooltip: string }) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      title={tooltip}
      className={`h-10 w-10 rounded-md shrink-0 transition-colors ${
        active 
          ? 'bg-primary/20 text-primary border border-primary/30' 
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {icon}
    </Button>
  );
}

function Badge({ children, active }: { children: React.ReactNode, active?: boolean }) {
  return (
    <button className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
      active ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
    }`}>
      {children}
    </button>
  );
}