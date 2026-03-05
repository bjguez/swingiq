import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PlayCircle, Filter, Search, ChevronDown, Check } from "lucide-react";
import mechanicHandsImg from "@/assets/images/mechanic-hands.png";
import mechanicLowerHalfImg from "@/assets/images/mechanic-lower-half.png";
import contactPointImg from "@/assets/images/contact-point.png";
import extensionImg from "@/assets/images/extension.png";
import proSwingImg from "@/assets/images/pro-swing.png";

export default function Library() {
  const categories = ["All", "Load & Stride", "Launch Position", "Contact", "Extension", "Full Swings"];
  
  const libraryItems = [
    { id: 1, title: "Trout - Explosive Lower Half", category: "Load & Stride", image: mechanicLowerHalfImg, player: "Mike Trout", duration: "0:12" },
    { id: 2, title: "Bregman - Ideal Hand Path", category: "Launch Position", image: mechanicHandsImg, player: "Alex Bregman", duration: "0:08" },
    { id: 3, title: "Ohtani - Perfect Impact Point", category: "Contact", image: contactPointImg, player: "Shohei Ohtani", duration: "0:15" },
    { id: 4, title: "Judge - Post-Contact Extension", category: "Extension", image: extensionImg, player: "Aaron Judge", duration: "0:10" },
    { id: 5, title: "Betts - Compact Swing Mechanics", category: "Full Swings", image: proSwingImg, player: "Mookie Betts", duration: "0:22" },
    { id: 6, title: "Altuve - Generating Power", category: "Load & Stride", image: mechanicLowerHalfImg, player: "Jose Altuve", duration: "0:14" },
  ];

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary uppercase tracking-wider">Pro Models</span>
            <span className="text-sm text-muted-foreground">High-Speed Database</span>
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
            />
          </div>
          <Button variant="outline" className="border-border hidden sm:flex">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex overflow-x-auto pb-2 gap-2 mt-4 scrollbar-none">
        {categories.map((cat, i) => (
          <button 
            key={cat}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              i === 0 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {libraryItems.map((item) => (
          <div key={item.id} className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all hover:shadow-[0_0_20px_rgba(20,184,102,0.1)]">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-black overflow-hidden cursor-pointer">
              <img src={item.image} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center border border-white/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all group-hover:scale-110">
                  <PlayCircle className="w-6 h-6 ml-0.5" />
                </div>
              </div>
              
              <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-white">
                {item.duration}
              </div>
              <div className="absolute top-2 left-2">
                <span className="px-2 py-1 rounded text-[10px] font-bold bg-primary/90 text-primary-foreground uppercase tracking-wider backdrop-blur-sm">
                  {item.category}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="text-sm text-muted-foreground flex items-center justify-between mt-2">
                <span>{item.player}</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 hover:bg-primary/20 hover:text-primary">
                  Analyze
                </Button>
              </p>
            </div>
          </div>
        ))}
      </div>

    </Layout>
  );
}