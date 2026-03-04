import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Youtube, Upload, PlayCircle, Loader2, ScanFace, CheckCircle2, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function VideoLibraryModal({ trigger }: { trigger: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // 'idle' | 'uploading' | 'analyzing' | 'results'
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'analyzing' | 'results'>('idle');
  const [progress, setProgress] = useState(0);

  const mockResults = [
    { id: 1, name: "Mike Trout", date: "2023-08-15", type: "Home Run", pitch: "95mph Fastball", source: "MLB.com" },
    { id: 2, name: "Shohei Ohtani", date: "2023-09-02", type: "Double", pitch: "88mph Slider", source: "YouTube" },
    { id: 3, name: "Aaron Judge", date: "2023-07-20", type: "Home Run", pitch: "84mph Curveball", source: "MLB.com" },
    { id: 4, name: "Mookie Betts", date: "2023-08-05", type: "Single", pitch: "92mph Sinker", source: "MLB.com" },
  ];

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 800);
  };

  const handleUploadSim = () => {
    setUploadState('uploading');
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setUploadState('analyzing');
        setTimeout(() => {
          setUploadState('results');
        }, 2000);
      }
    }, 150);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setUploadState('idle');
        setProgress(0);
      }, 300);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">Import & Match</DialogTitle>
          <DialogDescription>
            Upload your swing to find your MLB comps, or search the library manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="upload" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Upload & AI Match</TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Search Pro Library</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-4">
            
            {uploadState === 'idle' && (
              <div 
                onClick={handleUploadSim}
                className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Drag and drop your video</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                  Upload a video of your swing. Our AI will analyze your biometrics (height, levers, posture) to find your best MLB comparables.
                </p>
                <Button>Select File</Button>
                <p className="text-xs text-muted-foreground mt-4">MP4, MOV up to 500MB</p>
              </div>
            )}

            {uploadState === 'uploading' && (
              <div className="border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="font-display font-bold text-xl mb-2">Uploading Video...</h3>
                <div className="w-64 h-2 bg-secondary rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {uploadState === 'analyzing' && (
              <div className="border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10">
                <ScanFace className="w-12 h-12 text-primary animate-pulse mb-4" />
                <h3 className="font-display font-bold text-xl mb-2">Analyzing Biometrics</h3>
                <p className="text-muted-foreground text-sm">Measuring limb length, posture, and kinetic sequences...</p>
              </div>
            )}

            {uploadState === 'results' && (
              <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">Analysis complete! Based on your 5'10" frame and short levers, here are your best MLB mechanical matches.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <CompCard 
                    name="Mike Trout" 
                    match="94%" 
                    reason="Similar compact swing path and torso rotation. Excellent match for your build."
                    isTopMatch
                    onClick={() => setIsOpen(false)}
                  />
                  <CompCard 
                    name="Alex Bregman" 
                    match="88%" 
                    reason="Matches your bat speed generation style and lower-half usage."
                    onClick={() => setIsOpen(false)}
                  />
                  <CompCard 
                    name="Jose Altuve" 
                    match="82%" 
                    reason="Similar stride length and attack angle. Good alternative to study."
                    onClick={() => setIsOpen(false)}
                  />
                </div>
                
                <Button variant="outline" className="w-full mt-2" onClick={() => setUploadState('idle')}>
                  Upload Different Video
                </Button>
              </div>
            )}

          </TabsContent>

          <TabsContent value="search" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search player name, pitch type, or paste YouTube URL..." 
                  className="pl-9 bg-background border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            <div className="border border-border rounded-md overflow-hidden">
              <div className="bg-secondary/50 p-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 uppercase tracking-wider">
                <div className="col-span-4">Player</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Result</div>
                <div className="col-span-2">Pitch</div>
                <div className="col-span-2 text-right">Action</div>
              </div>
              <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                {mockResults.map((result) => (
                  <div key={result.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-secondary/30 transition-colors text-sm">
                    <div className="col-span-4 font-bold flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                        {result.source === "YouTube" ? <Youtube className="w-4 h-4 text-red-500" /> : <PlayCircle className="w-4 h-4 text-primary" />}
                      </div>
                      {result.name}
                    </div>
                    <div className="col-span-2 text-muted-foreground">{result.date}</div>
                    <div className="col-span-2">{result.type}</div>
                    <div className="col-span-2 text-muted-foreground">{result.pitch}</div>
                    <div className="col-span-2 text-right">
                      <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/20 hover:text-primary h-8" onClick={() => setIsOpen(false)}>
                        Import
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CompCard({ name, match, reason, isTopMatch = false, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
        isTopMatch 
          ? 'bg-primary/5 border-primary/50 hover:bg-primary/10' 
          : 'bg-card border-border hover:border-primary/30'
      }`}
    >
      {isTopMatch && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          Best Match
        </div>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="font-display font-bold text-lg leading-none">{name}</div>
        </div>
        <div className="text-primary font-mono font-bold">{match}</div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {reason}
      </p>
      <Button variant={isTopMatch ? "default" : "secondary"} className="w-full mt-4 h-8 text-xs">
        Compare Swing
      </Button>
    </div>
  );
}