import Stripe from "stripe";
import { db } from "./db";
import { users, referrals } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { TRIAL_DAYS } from "./auth";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

const APP_URL = process.env.APP_URL || "https://swingstudio.ai";

// Price IDs from Stripe dashboard — set these in Railway env vars
export const PRICES = {
  player_monthly: process.env.STRIPE_PLAYER_MONTHLY_PRICE_ID || "",
  player_annual: process.env.STRIPE_PLAYER_ANNUAL_PRICE_ID || "",
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
  pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
  coach_monthly: process.env.STRIPE_COACH_MONTHLY_PRICE_ID || "",
  coach_annual: process.env.STRIPE_COACH_ANNUAL_PRICE_ID || "",
};

// Maps Stripe price ID → subscription tier
function tierForPrice(priceId: string): "player" | "pro" | "coach" {
  if (priceId === PRICES.player_monthly || priceId === PRICES.player_annual) return "player";
  if (priceId === PRICES.pro_monthly || priceId === PRICES.pro_annual) return "pro";
  if (priceId === PRICES.coach_monthly || priceId === PRICES.coach_annual) return "coach";
  return "player";
}

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string,
): Promise<string> {
  // Get or create Stripe customer
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({ email: userEmail });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
  }

  // Apply trial if user is within TRIAL_DAYS of signing up
  let trialEnd: number | undefined;
  if (user.trialStartedAt) {
    const trialEndDate = new Date(user.trialStartedAt);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
    if (trialEndDate > new Date()) {
      trialEnd = Math.floor(trialEndDate.getTime() / 1000);
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/?upgraded=1`,
    cancel_url: `${APP_URL}/pricing`,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
  });

  return session.url!;
}

export async function createPortalSession(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user.stripeCustomerId) throw new Error("No billing account found");

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/`,
  });

  return session.url;
}

export async function handleWebhook(payload: Buffer, sig: string): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch {
    throw new Error("Webhook signature verification failed");
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const userId = session.metadata?.userId;
      const subscriptionId = session.subscription as string;
      if (!userId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0].price.id;
      const tier = tierForPrice(priceId);

      await db.update(users).set({
        stripeSubscriptionId: subscriptionId,
        subscriptionTier: tier,
        subscriptionStatus: subscription.status,
      }).where(eq(users.id, userId));

      // Credit referrer with 1 free month if this user was referred
      try {
        const [referral] = await db.select().from(referrals)
          .where(and(eq(referrals.referredUserId, userId), isNull(referrals.referrerCreditedAt)));
        if (referral) {
          const [referrer] = await db.select().from(users).where(eq(users.id, referral.referrerId));
          if (referrer?.stripeCustomerId) {
            // Get one month's price in cents from the subscription
            const unitAmount = subscription.items.data[0].price.unit_amount ?? 0;
            if (unitAmount > 0) {
              await stripe.customers.update(referrer.stripeCustomerId, {
                balance: (await stripe.customers.retrieve(referrer.stripeCustomerId) as Stripe.Customer).balance - unitAmount,
              });
            }
          }
          await db.update(referrals).set({
            subscribedAt: new Date(),
            referrerCreditedAt: new Date(),
          }).where(eq(referrals.id, referral.id));
        }
      } catch (refErr) {
        console.error("Referral credit error:", refErr);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      const priceId = subscription.items.data[0].price.id;
      const tier = subscription.status === "active" ? tierForPrice(priceId) : "free";

      await db.update(users).set({
        subscriptionTier: tier,
        subscriptionStatus: subscription.status,
      }).where(eq(users.id, userId));
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      await db.update(users).set({
        subscriptionTier: "free",
        subscriptionStatus: "canceled",
        stripeSubscriptionId: null,
      }).where(eq(users.id, userId));
      break;
    }
  }
}
