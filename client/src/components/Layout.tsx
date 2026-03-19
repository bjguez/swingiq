import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, BarChart2, Bell, Menu, X, User, Upload, Library, Film, Lock, Dna, Tag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ProfileSheet } from "@/components/ProfileSheet";
import ScoreTicker from "@/components/ScoreTicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function Layout({ children, showScoreTicker = false }: { children: React.ReactNode; showScoreTicker?: boolean }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all", undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const isCoach = user?.accountType === "coach";
  const isPaid = user && ["player", "pro", "coach"].includes(user.subscriptionTier ?? "");
  const isAdmin = user?.isAdmin;

  const navLinks = isCoach ? [
    { href: "/", icon: <Video className="w-4 h-4 mr-2" />, label: "Analysis" },
    { href: "/library", icon: <Library className="w-4 h-4 mr-2" />, label: "Pro Library" },
    { href: "/coach", icon: <Users className="w-4 h-4 mr-2" />, label: "My Players" },
  ] : [
    { href: "/", icon: <Video className="w-4 h-4 mr-2" />, label: "Analysis" },
    { href: "/library", icon: <Library className="w-4 h-4 mr-2" />, label: "Pro Library" },
    { href: "/my-swings", icon: <Film className="w-4 h-4 mr-2" />, label: "My Swings" },
    { href: "/biometrics", icon: <Dna className="w-4 h-4 mr-2" />, label: "Biometrics", badge: (!isPaid && !isAdmin) ? <Lock className="w-3 h-3 ml-1.5 text-yellow-500" /> : undefined },
    { href: "/development", icon: <BarChart2 className="w-4 h-4 mr-2" />, label: "Development", badge: (!isPaid && !isAdmin) ? <Lock className="w-3 h-3 ml-1.5 text-yellow-500" /> : undefined },
    ...(!isPaid && !isAdmin ? [{ href: "/pricing", icon: <Tag className="w-4 h-4 mr-2" />, label: "Pricing" }] : []),
  ];

  const footerLinks = [
    { section: "Product", links: [
      { href: "/", label: "Analysis" },
      { href: "/library", label: "Pro Library" },
      { href: "/my-swings", label: "My Swings" },
      { href: "/biometrics", label: "Biometrics" },
      { href: "/development", label: "Development" },
      { href: "/pricing", label: "Pricing" },
    ]},
    { section: "Account", links: [
      { href: "/onboarding", label: "Edit Profile" },
      { href: "/pricing", label: "Upgrade Plan" },
    ]},
    { section: "Company", links: [
      { href: "https://swingstudio.ai", label: "About" },
    ]},
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo — always visible. Brand name hidden on smaller screens */}
            <Link href="/">
              <div className="flex items-center gap-2 text-primary font-display font-bold text-2xl tracking-tighter cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                  <Video size={18} />
                </div>
                <span className="hidden lg:block">Swing Studio</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, icon, label, badge }) => (
                <Link key={href} href={href}>
                  <Button variant="ghost" size="sm" className={`font-medium ${location === href ? 'bg-secondary/50 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {icon}
                    {label}
                    {badge}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {!isCoach && (
              <VideoLibraryModal
                mode="user"
                trigger={
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold hidden sm:flex">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Swing
                  </Button>
                }
              />
            )}
            <Popover open={notifOpen} onOpenChange={(o) => { setNotifOpen(o); if (o && unreadCount > 0) readAllMutation.mutate(); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-semibold text-sm">Notifications</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No notifications yet.</p>
                  ) : (
                    notifs.map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 ${!n.read ? "bg-primary/5" : ""}`}>
                        <p className="text-sm font-semibold">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(o => !o)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <button
              onClick={() => setProfileOpen(true)}
              className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden ml-1 cursor-pointer hover:border-primary/50 transition-colors"
              title={user ? user.username : "Account"}
            >
              {user ? (
                <span className="text-xs font-bold text-foreground uppercase">{user.username[0]}</span>
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1 items-center">
            {navLinks.map(({ href, icon, label, badge }) => (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-center font-medium ${location === href ? 'bg-secondary/50 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {icon}
                  {label}
                  {badge}
                </Button>
              </Link>
            ))}
            {!isCoach && (
              <div className="pt-2 border-t border-border mt-1 w-full">
                <VideoLibraryModal
                  mode="user"
                  trigger={
                    <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Swing
                    </Button>
                  }
                />
              </div>
            )}
          </nav>
        )}

        {showScoreTicker && <ScoreTicker />}
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location}
          className="flex-1 container mx-auto px-4 py-6 flex flex-col gap-6 min-h-[calc(100dvh-4rem)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-auto">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-primary font-display font-bold text-xl tracking-tighter mb-3">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                  <Video size={15} />
                </div>
                Swing Studio
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Analyze your swing. Compare with the pros. Develop your game.
              </p>
            </div>

            {/* Link sections */}
            {footerLinks.map(({ section, links }) => (
              <div key={section}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{section}</p>
                <ul className="space-y-2">
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href}>
                        <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          {label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Swing Studio. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Built for ballplayers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
