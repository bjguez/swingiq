import { Home as HomeIcon, Video, BarChart2, Search, Bell, Menu, User, Upload, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { Link, useLocation } from "wouter";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

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
              SwingIQ
            </div>
            
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className={`font-medium ${location === '/' ? 'bg-secondary/50 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Video className="w-4 h-4 mr-2" />
                  Analysis
                </Button>
              </Link>
              <Link href="/development">
                <Button variant="ghost" size="sm" className={`font-medium ${location === '/development' ? 'bg-secondary/50 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <BarChart2 className="w-4 h-4 mr-2" />
                  Development
                </Button>
              </Link>
              <Link href="/library">
                <Button variant="ghost" size="sm" className={`font-medium ${location === '/library' ? 'bg-secondary/50 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Library className="w-4 h-4 mr-2" />
                  Library
                </Button>
              </Link>
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
        {children}
      </main>
    </div>
  );
}