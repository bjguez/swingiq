import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Video, BarChart2, Dna, Brain, Users, Check, ChevronRight,
  Zap, BookOpen, Target, ArrowRight,
} from "lucide-react";

const MLB_TEAMS = [
  { id: 108, name: "Angels" },
  { id: 109, name: "Diamondbacks" },
  { id: 110, name: "Orioles" },
  { id: 111, name: "Red Sox" },
  { id: 112, name: "Cubs" },
  { id: 113, name: "Reds" },
  { id: 114, name: "Guardians" },
  { id: 115, name: "Rockies" },
  { id: 116, name: "Tigers" },
  { id: 117, name: "Astros" },
  { id: 118, name: "Royals" },
  { id: 119, name: "Dodgers" },
  { id: 120, name: "Nationals" },
  { id: 121, name: "Mets" },
  { id: 133, name: "Athletics" },
  { id: 134, name: "Pirates" },
  { id: 135, name: "Padres" },
  { id: 136, name: "Mariners" },
  { id: 137, name: "Giants" },
  { id: 138, name: "Cardinals" },
  { id: 139, name: "Rays" },
  { id: 140, name: "Rangers" },
  { id: 141, name: "Blue Jays" },
  { id: 142, name: "Twins" },
  { id: 143, name: "Phillies" },
  { id: 144, name: "Braves" },
  { id: 145, name: "White Sox" },
  { id: 146, name: "Marlins" },
  { id: 147, name: "Yankees" },
  { id: 158, name: "Brewers" },
];

const FEATURES = [
  {
    icon: <Video className="w-6 h-6" />,
    title: "Side-by-Side Comparison",
    description: "Place your swing next to any MLB hitter in our library. Frame-by-frame scrubbing, slow motion, and drawing tools — all in your browser.",
    badge: null,
    badgeLabel: "Free",
  },
  {
    icon: <Dna className="w-6 h-6" />,
    title: "Biometrics Matching",
    description: "Enter your height, weight, and physical profile and we'll find MLB comps with similar builds — including exit velocity, barrel rate, and attack angle.",
    badge: "player",
    badgeLabel: "Player",
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: "Development Blueprint",
    description: "A structured, phase-by-phase curriculum built around real hitting mechanics. Pick your focus, get assigned drills, and track your progress.",
    badge: "pro",
    badgeLabel: "Pro",
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: "Cognition Training",
    description: "3D vision tracking drills that train your eyes and reaction time. Built for the modern hitter who trains more than just their body.",
    badge: "pro",
    badgeLabel: "Pro",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Upload Your Swing",
    body: "Record from your phone or camera, upload in seconds. Works with any format from any device.",
  },
  {
    num: "02",
    title: "Compare with MLB Hitters",
    body: "Pick any player from our library and view your swing side-by-side. Scrub, slow down, draw, and analyze.",
  },
  {
    num: "03",
    title: "Develop Your Game",
    body: "Track your metrics, follow the Blueprint curriculum, and train your vision — all in one place.",
  },
];

const TIERS = [
  {
    name: "Rookie",
    price: "Free",
    sub: "Always free",
    cta: "Get Started",
    highlight: false,
    features: ["Up to 5 video uploads", "Full MLB player library", "Frame-by-frame analysis tools"],
  },
  {
    name: "Player",
    price: "$19",
    sub: "per month",
    cta: "Start Player",
    highlight: true,
    features: ["Unlimited video uploads", "Full video library management", "Side-by-side comparison with any MLB hitter", "Biometrics — match your body to MLB comps"],
  },
  {
    name: "Pro",
    price: "$39",
    sub: "per month",
    cta: "Start Pro",
    highlight: false,
    features: ["Everything in Player", "Development Blueprint curriculum", "Phase-by-phase drill programs", "Cognition — 3D vision & attention training"],
  },
  {
    name: "Coach",
    price: "$59",
    sub: "per month",
    cta: "Start Coaching",
    highlight: false,
    features: ["Everything in Pro", "Manage multiple player accounts", "Shared analysis sessions", "Audio voiceover commentary"],
  },
];

function TierBadge({ badge }: { badge: string | null }) {
  if (!badge) return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-green-500/15 text-green-500">Free</span>;
  if (badge === "player") return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-500/15 text-blue-400">Player</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-primary/15 text-primary">Pro</span>;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track { animation: marquee 80s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
      `}</style>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo-option-b-square.svg" alt="Swing Studio" className="w-8 h-8" />
              <span className="font-display font-bold text-xl tracking-tighter text-primary hidden sm:block">Swing Studio</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Sign In</Button>
            </Link>
            <Link href="/auth">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">Start Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 pt-20 pb-24 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block mb-6 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold tracking-wider uppercase">
              Trusted by all 30 MLB organizations
            </span>
            <h1 className="font-display font-bold text-5xl sm:text-6xl md:text-7xl tracking-tighter leading-none mb-6">
              Your Swing.
              <br />
              <span className="text-primary">Compared to the Best.</span>
            </h1>
            <p className="text-muted-foreground text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
              Upload your swing video and analyze it side-by-side with MLB hitters.
              Frame-by-frame. Any device. Free to start — no card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/auth">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base px-8 h-12 w-full sm:w-auto">
                  Analyze Your Swing Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary/50 font-semibold text-base px-8 h-12 w-full sm:w-auto">
                  Browse the Pro Library
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Free forever · No credit card required · Works on any device</p>
          </motion.div>

          {/* Mock UI preview */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <div className="rounded-2xl border border-border bg-card/80 overflow-hidden shadow-2xl">
              <div className="border-b border-border bg-secondary/30 px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-muted-foreground ml-2 font-mono">swingstudio.ai/analysis</span>
              </div>
              <div className="grid grid-cols-2 gap-0 aspect-[16/7]">
                <div className="bg-zinc-900 flex items-center justify-center border-r border-border relative">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                      <Video className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">Your Swing</p>
                    <p className="text-[10px] text-muted-foreground">john_doe_2025-04-01</p>
                  </div>
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <div className="bg-primary/20 rounded px-1.5 py-0.5 text-[9px] text-primary font-mono">0.5x</div>
                    <div className="bg-secondary/80 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground font-mono">frame 24</div>
                  </div>
                </div>
                <div className="bg-zinc-900 flex items-center justify-center relative">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">Shohei Ohtani</p>
                    <p className="text-[10px] text-muted-foreground">Full Swing · MLB</p>
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <div className="bg-blue-500/20 rounded px-1.5 py-0.5 text-[9px] text-blue-400 font-mono">synced</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── MLB TEAM LOGO CAROUSEL ── */}
      <section className="border-y border-border bg-card/30 py-10 overflow-hidden">
        <div className="container mx-auto px-4 mb-6 text-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Trusted by organizations across all of Major League Baseball
          </p>
        </div>
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <div className="flex w-max marquee-track">
            {[...MLB_TEAMS, ...MLB_TEAMS].map((team, i) => (
              <div key={i} className="flex items-center justify-center mx-6 shrink-0">
                <img
                  src={`https://www.mlbstatic.com/team-logos/${team.id}.svg`}
                  alt={team.name}
                  className="w-12 h-12 object-contain opacity-70 hover:opacity-100 transition-opacity"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">How it works</p>
          <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tighter">Simple. Powerful. Fast.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="font-display font-bold text-5xl text-primary/20 mb-4">{step.num}</div>
              <h3 className="font-display font-bold text-xl mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link href="/auth">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8">
              Try It Free
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Features</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tighter">Everything you need to level up</h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">Analysis tools are free. Unlock more as you grow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    {f.icon}
                  </div>
                  <TierBadge badge={f.badge} />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tighter">Start free. Upgrade when you're ready.</h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">No card required to get started. Cancel anytime.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                tier.highlight
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border bg-card"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="mb-5">
                <p className="font-display font-bold text-lg mb-1">{tier.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  {tier.sub !== "Always free" && <span className="text-xs text-muted-foreground">{tier.sub}</span>}
                </div>
                {tier.sub === "Always free" && <p className="text-xs text-muted-foreground mt-0.5">{tier.sub}</p>}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth">
                <Button
                  className={`w-full font-bold ${tier.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  variant={tier.highlight ? "default" : "outline"}
                >
                  {tier.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Annual plans available — save 2 months.{" "}
          <Link href="/pricing">
            <span className="text-primary hover:underline cursor-pointer">See full pricing →</span>
          </Link>
        </p>
      </section>

      {/* ── COACH SECTION ── */}
      <section className="py-24 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="p-10">
                <span className="inline-block mb-4 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold uppercase tracking-wider">
                  For Coaches
                </span>
                <h2 className="font-display font-bold text-3xl md:text-4xl tracking-tighter mb-4">
                  Built for coaches building teams.
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  Create analysis sessions, share them with your players, and record voiceover commentary directly on the video. Your whole roster — one place.
                </p>
                <Link href="/auth">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                    Start a Coach Account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="bg-secondary/30 border-l border-border p-10 flex flex-col justify-center gap-5">
                {[
                  { icon: <Users className="w-4 h-4" />, text: "Manage multiple player accounts from one dashboard" },
                  { icon: <Video className="w-4 h-4" />, text: "Create shared analysis sessions with any swing video" },
                  { icon: <Target className="w-4 h-4" />, text: "Record voiceover commentary tied to specific frames" },
                  { icon: <BarChart2 className="w-4 h-4" />, text: "Track player progress and development over time" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      {icon}
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug pt-1">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-32 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display font-bold text-4xl md:text-6xl tracking-tighter mb-4">
            Ready to see your swing
            <br />
            <span className="text-primary">differently?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Join players, coaches, and organizations across MLB. Free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base px-10 h-12 w-full sm:w-auto">
                Analyze Your Swing Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="ghost" className="text-muted-foreground hover:text-foreground font-semibold text-base px-8 h-12 w-full sm:w-auto">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-5">No credit card required · Cancel anytime</p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border bg-card/30 py-10">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-option-b-square.svg" alt="Swing Studio" className="w-6 h-6" />
            <span className="font-display font-bold text-primary">Swing Studio</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <Link href="/auth"><span className="hover:text-foreground cursor-pointer transition-colors">Sign In</span></Link>
            <Link href="/pricing"><span className="hover:text-foreground cursor-pointer transition-colors">Pricing</span></Link>
            <Link href="/about"><span className="hover:text-foreground cursor-pointer transition-colors">About</span></Link>
            <Link href="/terms"><span className="hover:text-foreground cursor-pointer transition-colors">Terms</span></Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Swing Studio</p>
        </div>
      </footer>
    </div>
  );
}
