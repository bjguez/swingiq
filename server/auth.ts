import type { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { pool, db } from "./db";
import { insertUserSchema, emailVerifications } from "@shared/schema";
import type { User } from "@shared/schema";
import { sendVerificationEmail } from "./email";
import { eq, and, gt } from "drizzle-orm";
import { coachTrialDaysRemaining, ensureCoachTrialStarted } from "./coachAccess";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function createVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.insert(emailVerifications).values({ userId, token, expiresAt });
  return token;
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends SchemaUser {}
  }
}
type SchemaUser = import("@shared/schema").User;

function serializeUser(user: User) {
  const adminUsername = process.env.ADMIN_USERNAME;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    isAdmin: adminUsername ? user.username === adminUsername : false,
    age: user.age,
    city: user.city,
    state: user.state,
    skillLevel: user.skillLevel,
    bats: user.bats,
    throws: user.throws,
    heightInches: user.heightInches,
    weightLbs: user.weightLbs,
    firstName: user.firstName,
    lastName: user.lastName,
    profileComplete: user.profileComplete,
    subscriptionTier: user.subscriptionTier ?? "free",
    accountType: user.accountType ?? "player",
    organization: user.organization,
    coachingLevel: user.coachingLevel,
    coachTrialStartedAt: user.coachTrialStartedAt ?? null,
    coachTrialDaysRemaining: user.accountType === "coach" ? coachTrialDaysRemaining(user) : null,
  };
}

export function setupAuth(app: Express) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: "username" }, async (usernameOrEmail, password, done) => {
      try {
        // Accept either email or legacy username
        const user = usernameOrEmail.includes("@")
          ? await storage.getUserByEmail(usernameOrEmail.toLowerCase())
          : await storage.getUserByUsername(usernameOrEmail);
        if (!user) return done(null, false, { message: "Invalid email or password" });
        if (!user.password) return done(null, false, { message: "This account uses Google sign-in. Please use the Google button to log in." });
        const valid = await comparePasswords(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid email or password" });
        if (!user.email) return done(null, false, { message: "EMAIL_REQUIRED" });
        if (!user.emailVerified) return done(null, false, { message: "EMAIL_NOT_VERIFIED" });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  // Google OAuth strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${(process.env.APP_URL || "https://swingstudio.ai").replace(/\/$/, "")}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // Try to find existing user by Google ID
          let user = await storage.getUserByGoogleId(profile.id);
          if (user) return done(null, user);

          // Try to match by email (links Google to an existing password account)
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (email) {
            user = await storage.getUserByEmail(email);
            if (user) {
              // Link Google ID to existing account
              user = await storage.updateUser(user.id, { googleId: profile.id, emailVerified: true }) ?? user;
              return done(null, user);
            }
          }

          // New user — derive a unique username from their Google display name
          const baseName = (profile.displayName || email?.split("@")[0] || "user")
            .toLowerCase().replace(/[^a-z0-9]/g, "");
          let username = baseName || "user";
          let suffix = 1;
          while (await storage.getUserByUsername(username)) {
            username = `${baseName}${suffix++}`;
          }

          const created = await storage.createUser({
            username,
            password: "" as any,
            email: email ?? null,
          });
          user = await storage.updateUser(created.id, {
            googleId: profile.id,
            emailVerified: !!email,
            password: null,
          }) ?? created;
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    ));
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      let user = await storage.getUser(id);
      if (user) user = await ensureCoachTrialStarted(user);
      done(null, user ?? false);
    } catch (err) {
      done(err);
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    const state = (req.query.invite as string) ?? "";
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", { failureRedirect: "/auth?error=google" }, (err, user) => {
      if (err || !user) return res.redirect("/auth?error=google");
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        // If a pending invite token was passed via state, store it for the client to pick up
        const state = req.query.state as string;
        if (state) res.cookie("pendingInviteToken", state, { httpOnly: false, maxAge: 5 * 60 * 1000 });
        // New users (no profile) go to onboarding; returning users go home
        const destination = user.profileComplete ? "/" : "/onboarding?google=1";
        res.redirect(destination);
      });
    })(req, res, next);
  });

  // Check if a username is available (used by onboarding username step)
  app.get("/api/auth/check-username", async (req, res) => {
    const { username } = req.query;
    if (!username || typeof username !== "string") return res.status(400).json({ available: false });
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) return res.json({ available: false, reason: "Too short" });
    const existing = await storage.getUserByUsername(clean);
    res.json({ available: !existing, username: clean });
  });

  // Register
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid registration data" });

      const { password, email } = parsed.data;

      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!password) return res.status(400).json({ message: "Password is required" });

      const existingEmail = await storage.getUserByEmail(email.toLowerCase());
      if (existingEmail) return res.status(400).json({ message: "An account with this email already exists" });

      // Derive a unique username from the email local part
      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      let username = baseUsername;
      let suffix = 1;
      while (await storage.getUserByUsername(username)) {
        username = `${baseUsername}${suffix++}`;
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email: email.toLowerCase(),
      });

      // Send verification email (non-blocking — don't fail registration if email fails)
      try {
        const token = await createVerificationToken(user.id);
        await sendVerificationEmail(user.email!, token);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      res.status(201).json({ message: "Account created. Please check your email to verify your account." });
    } catch (err) {
      next(err);
    }
  });

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        const code = info?.message;
        const message =
          code === "EMAIL_NOT_VERIFIED" ? "Please verify your email before logging in." :
          code === "EMAIL_REQUIRED" ? "Please add an email address to your account." :
          (info?.message || "Invalid credentials");
        return res.status(401).json({
          message,
          emailNotVerified: code === "EMAIL_NOT_VERIFIED",
          emailRequired: code === "EMAIL_REQUIRED",
        });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(serializeUser(user));
      });
    })(req, res, next);
  });

  // Verify email
  app.get("/api/auth/verify-email", async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Invalid token" });
      }

      const [record] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.token, token),
            gt(emailVerifications.expiresAt, new Date())
          )
        );

      if (!record) return res.status(400).json({ message: "This link is invalid or has expired." });

      await storage.updateUser(record.userId, { emailVerified: true });
      await db.delete(emailVerifications).where(eq(emailVerifications.token, token));

      const user = await storage.getUser(record.userId);
      if (!user) return res.status(400).json({ message: "User not found" });

      // Log them in automatically
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ message: "Email verified successfully", user: serializeUser(user) });
      });
    } catch (err) {
      next(err);
    }
  });

  // Add email to an existing account that was created without one
  app.post("/api/auth/add-email", async (req, res, next) => {
    try {
      const { username, password, email } = req.body;
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, password, and email are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !user.password) return res.status(401).json({ message: "Invalid username or password" });

      const valid = await comparePasswords(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid username or password" });

      if (user.email) return res.status(400).json({ message: "This account already has an email address" });

      const existingEmail = await storage.getUserByEmail(email.toLowerCase());
      if (existingEmail) return res.status(400).json({ message: "An account with this email already exists" });

      await storage.updateUser(user.id, { email: email.toLowerCase() });

      try {
        const token = await createVerificationToken(user.id);
        await sendVerificationEmail(email.toLowerCase(), token);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      res.json({ message: "Verification email sent. Please check your inbox." });
    } catch (err) {
      next(err);
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await storage.getUserByEmail(email.toLowerCase());
      // Always respond 200 to avoid user enumeration
      if (!user || user.emailVerified) {
        return res.json({ message: "If that email exists and is unverified, we've sent a new link." });
      }

      // Delete old tokens for this user
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id));

      const token = await createVerificationToken(user.id);
      await sendVerificationEmail(user.email!, token);

      res.json({ message: "If that email exists and is unverified, we've sent a new link." });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    res.json(serializeUser(req.user as User));
  });

  app.put("/api/auth/profile", async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { username, firstName, lastName, age, city, state, skillLevel, bats, throws: throwHand, heightInches, weightLbs, accountType, organization, coachingLevel, profileComplete } = req.body;

      // Validate and claim username if provided
      if (username !== undefined) {
        const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (clean.length < 3) return res.status(400).json({ message: "Username must be at least 3 characters" });
        const existing = await storage.getUserByUsername(clean);
        if (existing && existing.id !== (req.user as User).id) {
          return res.status(400).json({ message: "Username is already taken" });
        }
      }

      const currentUser = req.user as User;
      const startingCoachTrial =
        accountType === "coach" &&
        currentUser.accountType !== "coach" &&
        currentUser.subscriptionTier !== "coach" &&
        !currentUser.coachTrialStartedAt;

      const updated = await storage.updateUser(currentUser.id, {
        ...(username !== undefined && { username: username.toLowerCase().replace(/[^a-z0-9_]/g, "") }),
        ...(firstName !== undefined && { firstName: firstName || null }),
        ...(lastName !== undefined && { lastName: lastName || null }),
        ...(age !== undefined && { age: age ? Number(age) : null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(skillLevel !== undefined && { skillLevel: skillLevel || null }),
        ...(bats !== undefined && { bats: bats || null }),
        ...(throwHand !== undefined && { throws: throwHand || null }),
        ...(heightInches !== undefined && { heightInches: heightInches ? Number(heightInches) : null }),
        ...(weightLbs !== undefined && { weightLbs: weightLbs ? Number(weightLbs) : null }),
        ...(accountType && { accountType }),
        ...(organization !== undefined && { organization: organization || null }),
        ...(coachingLevel !== undefined && { coachingLevel: coachingLevel || null }),
        ...(profileComplete !== undefined && { profileComplete }),
        ...(startingCoachTrial && { coachTrialStartedAt: new Date() }),
      });
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(serializeUser(updated));
    } catch (err) { next(err); }
  });
}
