import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Youtube, Upload, PlayCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function VideoLibraryModal({ trigger }: { trigger: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">Import Swing Video</DialogTitle>
          <DialogDescription>
            Select a video from your local device, or search our MLB database to find a pro swing to compare against.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="search" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="search" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Search Pro Library</TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Upload Local Video</TabsTrigger>
          </TabsList>
          
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
            <div className="text-xs text-muted-foreground text-center">
              Our AI automatically syncs the "contact" frame when importing pro videos.
            </div>
          </TabsContent>
          
          <TabsContent value="upload" className="mt-4">
            <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Drag and drop your video</h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Upload a 60fps or 120fps video of your swing. For best results, shoot from a consistent side profile or behind the plate.
              </p>
              <Button>Select File</Button>
              <p className="text-xs text-muted-foreground mt-4">MP4, MOV up to 500MB</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}