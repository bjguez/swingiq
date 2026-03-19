import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, BarChart2, Bell, Menu, X, User, Upload, Library, Film, Lock, Dna, Tag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ProfileSheet } from "@/components/ProfileSheet";
import ScoreTicker from "@/components/ScoreTicker";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navLinks = [
    { href: "/", icon: <Video className="w-4 h-4 mr-2" />, label: "Analysis" },
    { href: "/library", icon: <Library className="w-4 h-4 mr-2" />, label: "Pro Library" },
    { href: "/my-swings", icon: <Film className="w-4 h-4 mr-2" />, label: "My Swings" },
    { href: "/biometrics", icon: <Dna className="w-4 h-4 mr-2" />, label: "Biometrics", badge: <Lock className="w-3 h-3 ml-1.5 text-yellow-500" /> },
    { href: "/development", icon: <BarChart2 className="w-4 h-4 mr-2" />, label: "Development", badge: <Lock className="w-3 h-3 ml-1.5 text-yellow-500" /> },
    ...(user?.accountType === "coach" ? [{ href: "/coach", icon: <Users className="w-4 h-4 mr-2" />, label: "My Players" }] : []),
    { href: "/pricing", icon: <Tag className="w-4 h-4 mr-2" />, label: "Pricing" },
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
            <VideoLibraryModal
              mode="user"
              trigger={
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold hidden sm:flex">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Swing
                </Button>
              }
            />
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="w-5 h-5" />
            </Button>
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
          </nav>
        )}

        <ScoreTicker />
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location}
          className="flex-1 container mx-auto px-4 py-6 flex flex-col gap-6"
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
