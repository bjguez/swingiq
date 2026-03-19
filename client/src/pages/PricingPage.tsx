import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";

type Interval = "monthly" | "annual";

const TIERS = [
  {
    key: "free",
    name: "Rookie",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Get started analyzing your swing",
    priceKey: null,
    features: [
      "Up to 10 videos in your library",
      "Side-by-side swing comparison",
      "MLB player video library",
      "Basic swing categories",
    ],
    limitations: [
      "Cannot delete or manage videos",
      "No Biometrics matching",
      "No Development Blueprint",
    ],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    key: "player",
    name: "Player",
    monthlyPrice: 19,
    annualPrice: 190,
    description: "Unlimited video + pro player comparisons",
    priceKey: { monthly: "player_monthly", annual: "player_annual" },
    features: [
      "Unlimited video uploads",
      "Full video library management",
      "Side-by-side swing comparison",
      "MLB player video library",
      "Biometrics — match your body to MLB comps",
      "Exit velocity & barrel rate analysis",
    ],
    limitations: ["No Development Blueprint"],
    cta: "Start Player",
    highlight: true,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: 39,
    annualPrice: 390,
    description: "Everything in Player + structured development",
    priceKey: { monthly: "pro_monthly", annual: "pro_annual" },
    features: [
      "Everything in Player",
      "Development Blueprint",
      "Phase-by-phase drill programs",
      "Pro model swing breakdowns",
      "Priority support",
    ],
    limitations: [],
    cta: "Start Pro",
    highlight: false,
  },
  {
    key: "coach",
    name: "Coach",
    monthlyPrice: 59,
    annualPrice: 590,
    description: "Full Pro access + manage and develop your players",
    priceKey: { monthly: "coach_monthly", annual: "coach_annual" },
    features: [
      "Everything in Pro",
      "Manage multiple player accounts",
      "Create and share analysis sessions",
      "Audio voiceover commentary",
      "In-app + email notifications to players",
      "Player progress tracking",
    ],
    limitations: [],
    cta: "Start Coaching",
    highlight: false,
  },
];

export default function PricingPage() {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: prices } = useQuery<Record<string, string>>({
    queryKey: ["/api/billing/plans"],
  });

  const annualSavings = (monthly: number) =>
    Math.round(((monthly * 12 - monthly * 10) / (monthly * 12)) * 100);

  async function handleSelect(tier: typeof TIERS[number]) {
    if (tier.key === "free") {
      navigate(user ? "/" : "/auth");
      return;
    }
    if (!user) {
      navigate("/auth");
      return;
    }
    if (user.subscriptionTier === tier.key) return;

    const priceKey = tier.priceKey![interval];
    const priceId = prices?.[priceKey];
    if (!priceId) return;

    setLoading(tier.key);
    try {
      const res = await apiRequest("POST", "/api/billing/checkout", { priceId });
      const { url } = await res.json();
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading("manage");
    try {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      const { url } = await res.json();
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto w-full py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl uppercase tracking-wider mb-3">
            Simple Pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free, upgrade when you're ready. Cancel anytime.
          </p>

          {/* Interval toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${interval === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${interval === "annual" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-green-500/10 text-green-500"}`}>
                2 months free
              </span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIERS.map((tier) => {
            const price = interval === "monthly" ? tier.monthlyPrice : tier.annualPrice;
            const isCurrentTier = user?.subscriptionTier === tier.key ||
              (tier.key === "free" && !user?.subscriptionTier);
            const isCurrent = user && isCurrentTier;

            return (
              <div
                key={tier.key}
                className={`relative rounded-xl border p-6 flex flex-col ${
                  tier.highlight
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Zap size={10} /> Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="font-display text-xl uppercase tracking-wider mb-1">{tier.name}</h2>
                  <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold">
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground text-sm mb-1.5">
                        /{interval === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </div>
                  {price > 0 && interval === "annual" && (
                    <p className="text-xs text-green-500 mt-1">
                      Save {annualSavings(tier.monthlyPrice)}% vs monthly
                    </p>
                  )}
                  {price > 0 && interval === "monthly" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      or ${tier.annualPrice}/yr (save {annualSavings(tier.monthlyPrice)}%)
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check size={15} className="text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  {isCurrent ? (
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                      {tier.key !== "free" && (
                        <button
                          onClick={handleManage}
                          disabled={loading === "manage"}
                          className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                        >
                          {loading === "manage" ? "Loading..." : "Manage or cancel subscription"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      variant={tier.highlight ? "default" : "outline"}
                      onClick={() => handleSelect(tier)}
                      disabled={loading === tier.key}
                    >
                      {loading === tier.key ? "Loading..." : tier.cta}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ / trust line */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          All plans include a 30-day money-back guarantee. No contracts — cancel anytime from your account.
        </p>
      </div>
    </Layout>
  );
}
