import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PlayCircle, Filter, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchVideos } from "@/lib/api";
import { useState } from "react";
import type { Video } from "@shared/schema";

const categories = ["All", "Gather", "Touchdown", "Thrust", "Contact", "Post-Contact", "Hand Path", "Head Position", "Scissor Kick", "Full Swings"];

export default function Library() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: allVideos = [], isLoading } = useQuery({ 
    queryKey: ["/api/videos"], 
    queryFn: () => fetchVideos()
  });

  const filtered = allVideos.filter((v: Video) => {
    const matchCategory = activeCategory === "All" || v.category === activeCategory;
    const matchSearch = !searchQuery || 
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.playerName?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Pro Models</span>
            <span className="text-sm text-muted-foreground">{allVideos.length} clips in database</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display uppercase">Swing Library</h1>
          <p className="text-muted-foreground">Study isolated mechanics from the best hitters in baseball.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search library..." 
              className="bg-secondary/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors w-full sm:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-library-search"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex overflow-x-auto pb-2 gap-2 mt-4 scrollbar-none">
        {categories.map((cat) => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            data-testid={`filter-${cat}`}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-secondary" />
              <div className="p-4 space-y-2">
                <div className="h-5 bg-secondary rounded w-3/4" />
                <div className="h-4 bg-secondary rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filtered.map((item) => (
            <div key={item.id} className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all hover:shadow-[0_0_20px_rgba(20,184,102,0.1)]" data-testid={`card-video-${item.id}`}>
              {/* Thumbnail */}
              <div className="relative aspect-video bg-black overflow-hidden cursor-pointer">
                <div className="w-full h-full bg-gradient-to-br from-secondary/80 to-background flex items-center justify-center">
                  <PlayCircle className="w-16 h-16 text-muted-foreground/30" />
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center border border-white/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all group-hover:scale-110">
                    <PlayCircle className="w-6 h-6 ml-0.5" />
                  </div>
                </div>
                
                {item.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-white">
                    {item.duration}
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-1 rounded text-[10px] font-bold bg-primary/90 text-primary-foreground uppercase tracking-wider backdrop-blur-sm">
                    {item.category}
                  </span>
                </div>
                {item.fps && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-black/70 text-white/80 backdrop-blur-sm">
                      {item.fps}fps
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-sm text-muted-foreground flex items-center justify-between mt-2">
                  <span>{item.playerName} • {item.source}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2 hover:bg-primary/20 hover:text-primary">
                    Analyze
                  </Button>
                </p>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No videos found matching your filters.
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}