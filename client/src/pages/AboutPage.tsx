import { motion } from "framer-motion";
import { usePageMeta } from "@/hooks/use-page-meta";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import aboutPhoto from "@/assets/images/bg-swingiq-about.png";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

function Section({ eyebrow, headline, body }: { eyebrow: string; headline: string; body: React.ReactNode }) {
  return (
    <motion.div
      className="py-24 px-6 max-w-3xl mx-auto"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeUp}
    >
      <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">{eyebrow}</p>
      <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-8">{headline}</h2>
      <div className="text-foreground/80 text-lg leading-relaxed space-y-5">{body}</div>
    </motion.div>
  );
}

export default function AboutPage() {
  usePageMeta({ title: "About", description: "Swing Studio is built for serious hitters who want to train smarter. Learn about our mission to bring pro-level swing analysis to every player.", path: "/about" });
  return (
    <Layout>

      {/* Hero */}
      <div className="relative w-full h-[70vh] overflow-hidden">
        <img
          src={aboutPhoto}
          alt="Ben Guez rounding the bases in a Detroit Tigers uniform"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
        <motion.div
          className="absolute bottom-0 left-0 w-full px-6 pb-14 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="max-w-3xl">
            <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-3">Our Story</p>
            <h1 className="font-display font-bold text-5xl md:text-7xl tracking-tight leading-none">
              Built by a player.<br />For every player.
            </h1>
          </div>
        </motion.div>
      </div>

      {/* Stats Strip */}
      <motion.div
        className="border-y border-border bg-card/50"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        variants={fadeUp}
      >
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "10", label: "Years as a Pro" },
            { value: "4+", label: "Countries Played" },
            { value: "2012", label: "World Baseball Classic" },
            { value: "2014", label: "The Year Everything Changed" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="font-display font-bold text-4xl text-primary">{value}</p>
              <p className="text-muted-foreground text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <div className="w-px h-16 bg-border mx-auto" />

      {/* The Player */}
      <Section
        eyebrow="The Player"
        headline="A decade in the game."
        body={
          <>
            <p>
              Ben Guez spent nearly a decade playing professional baseball, climbing through the Detroit Tigers and Milwaukee Brewers organizations, competing in winter leagues in Mexico and Venezuela, and even a World Baseball Classic in 2012. Baseball took him all over the world.
            </p>
            <p>
              He was never the most naturally gifted guy in the room. He was a grinder, drafted out of William & Mary in the 19th round, the kind of player who had to outwork, outstudy, and out-prepare everyone around him just to stay on the field.
            </p>
          </>
        }
      />

      {/* Divider */}
      <div className="w-px h-16 bg-border mx-auto" />

      {/* The Turning Point */}
      <Section
        eyebrow="The Turning Point"
        headline="In 2014, he finally saw the swing."
        body={
          <>
            <p>
              In 2014, Ben met Craig Wallenbrock and Robert Van Scoyoc, two of the most respected hitting minds in professional baseball. The experience was unlike anything he'd encountered in his career.
            </p>
            <p>
              For the first time, he could see mechanics he'd never been able to see before, in his own swing, in elite hitters, in footage he'd watched hundreds of times. It wasn't just coaching. It was a framework. A language for understanding what the swing was actually doing, and what it needed to become.
            </p>
            <p>
              He left that experience with a question that never went away: <em>what if he'd had access to this earlier?</em>
            </p>
          </>
        }
      />

      {/* Divider */}
      <div className="w-px h-16 bg-border mx-auto" />

      {/* The Mission */}
      <Section
        eyebrow="The Mission"
        headline="Give every player the tools he didn't have."
        body={
          <>
            <p>
              Swing Studio was built on a simple belief: the right coaching, the right tools, and the right analysis, earlier in a player's development, can change trajectories.
            </p>
            <p>
              Most players never get access to elite-level feedback. They work hard, take reps, and hope something clicks. Swing Studio exists to close that gap. AI-powered swing analysis, a structured development curriculum, and a platform built for both players and coaches to actually work together.
            </p>
            <p>
              Not just exchanging clips. Building toward something.
            </p>
          </>
        }
      />

      {/* Divider */}
      <div className="w-px h-16 bg-border mx-auto" />

      {/* Built For */}
      <Section
        eyebrow="Built For"
        headline="Players who grind. Coaches who care."
        body={
          <>
            <p>
              Swing Studio is built for the player who shows up early, stays late, and is hungry to understand their game on a deeper level. And it's built for the coaches who see things others miss and need better tools to show their players what they see.
            </p>
            <p>
              We're still early. There's a lot more to build. But if Swing Studio helps one player see their swing clearly for the first time, or gives one coach the tools to communicate what they've always known, then we're on the right track.
            </p>
          </>
        }
      />

      {/* CTA */}
      <motion.div
        className="py-24 px-6 text-center border-t border-border"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        variants={fadeUp}
      >
        <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">Get Started</p>
        <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-8">
          Ready to see your swing differently?
        </h2>
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button size="lg">Analyze Your Swing</Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline">See Plans</Button>
          </Link>
        </div>
      </motion.div>

    </Layout>
  );
}
