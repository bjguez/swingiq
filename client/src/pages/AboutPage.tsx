import Layout from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import aboutPhoto from "@/assets/images/bg-swingiq-about.png";

export default function AboutPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Photo */}
        <div className="mb-10">
          <img
            src={aboutPhoto}
            alt="Ben Guez rounding the bases in a Detroit Tigers uniform"
            className="w-full rounded-lg object-cover max-h-80"
          />
          <p className="text-muted-foreground text-sm mt-2">Ben Guez — Detroit Tigers organization</p>
        </div>

        {/* Header */}
        <div className="mb-12">
          <h1 className="font-display font-bold text-4xl tracking-tight mb-4">About Swing Studio</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Built by a player who spent a career trying to figure it out — for the players who deserve to figure it out sooner.
          </p>
        </div>

        {/* Story */}
        <div className="space-y-6 text-foreground/90 leading-relaxed">
          <p>
            I'm Ben Guez. I played professional baseball for nearly a decade — in the Detroit Tigers and Milwaukee Brewers organizations, through winter leagues in Mexico and Venezuela, and even represented Israel in the 2012 World Baseball Classic qualifier. Baseball took me all over the world, and I loved every bit of it.
          </p>

          <p>
            But I'll be honest: I was never the most naturally gifted guy in the room. I had to work for everything. And for most of my career, I was working without the right map. I had coaches, I had reps, I had film — but I didn't have a clear framework for understanding what my swing was actually doing and what it needed to do differently.
          </p>

          <p>
            That changed in 2013 when I met Craig Wallenbrock and Robert Van Scoyoc. They're two of the most respected hitting minds in the game, and spending time with them completely rewired how I saw the swing. For the first time, I could see mechanics I'd never been able to see before — in my own swing, in other hitters, in footage I'd watched a hundred times. It was like a language I'd been speaking without understanding suddenly making sense.
          </p>

          <p>
            I left the game thinking: what if I'd had access to that kind of insight earlier? Not just the coaching — but the tools to actually see it, to measure it, to work on it on my own between sessions? I think things could've been different. Not just for me, but for a lot of players who grind hard and never quite break through.
          </p>

          <p>
            That's what Swing Studio is. It's the tool I wish existed when I was a young player trying to make sense of my swing. AI-powered analysis, a structured development curriculum, and a platform that lets coaches and players actually work together — not just exchange clips, but build toward something.
          </p>

          <p>
            We're still early, and there's a lot more to build. But if this helps one player see their swing clearly for the first time, or gives one coach the tools to communicate what they see — then we're on the right track.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-muted-foreground mb-4">Ready to start working on your swing?</p>
          <div className="flex gap-3">
            <Link href="/">
              <Button>Analyze Your Swing</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline">See Plans</Button>
            </Link>
          </div>
        </div>

      </div>
    </Layout>
  );
}
