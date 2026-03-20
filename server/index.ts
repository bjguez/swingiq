import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { setupAuth } from "./auth";
import { createServer } from "http";
import { pool } from "./db";
import { r2Configured, configureR2Cors } from "./r2";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Idempotent schema migrations
  await pool.query(`
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
  `);
  await pool.query(`
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS season INTEGER
  `);
  await pool.query(`
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS user_id VARCHAR
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_level TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bats TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS throws TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS height_inches INTEGER
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_lbs INTEGER
  `);
  await pool.query(`
    ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS batting_avg REAL
  `);
  await pool.query(`
    ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS home_runs INTEGER
  `);
  await pool.query(`
    ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS rbi INTEGER
  `);
  await pool.query(`
    ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS obp REAL
  `);
  await pool.query(`
    ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS slg REAL
  `);
  await pool.query(`
    ALTER TABLE mlb_players ADD COLUMN IF NOT EXISTS ops REAL
  `);
  await pool.query(`
    UPDATE videos SET category = 'Full Swing' WHERE category = 'Full Swings'
  `);
  // Swing Notes columns
  await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes TEXT`);
  await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS tags TEXT[]`);
  // Remap legacy video categories to new naming
  await pool.query(`UPDATE videos SET category = 'Full Swing' WHERE is_pro_video = true AND category != 'Full Swing'`);
  await pool.query(`UPDATE videos SET category = 'Full Swing' WHERE category = 'Upload'`);
  // Stripe subscription columns
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT
  `);
  // Name fields
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`);
  // Account type and coach fields
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'player'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS coaching_level TEXT`);
  // Coach-player relationships
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_players (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      invite_email TEXT,
      invite_token TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE coach_players ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE`);
  // Coach sessions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_sessions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player_video_id VARCHAR REFERENCES videos(id) ON DELETE SET NULL,
      pro_video_id VARCHAR REFERENCES videos(id) ON DELETE SET NULL,
      notes TEXT,
      voiceover_url TEXT,
      highlight_start REAL,
      highlight_end REAL,
      shared_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE coach_sessions ADD COLUMN IF NOT EXISTS highlight_start REAL`);
  await pool.query(`ALTER TABLE coach_sessions ADD COLUMN IF NOT EXISTS highlight_end REAL`);
  // Notifications
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_player_id VARCHAR NOT NULL REFERENCES coach_players(id) ON DELETE CASCADE,
      sender_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Email verification columns and table
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Video visibility flags
  await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS show_in_library BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS show_in_development BOOLEAN NOT NULL DEFAULT true`);
  // team_name column on coach_players
  await pool.query(`ALTER TABLE coach_players ADD COLUMN IF NOT EXISTS team_name TEXT`);
  // coach_teams table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_teams (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(coach_id, name)
    )
  `);

  // Player MLB comps
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_player_comps (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mlb_player_id VARCHAR NOT NULL REFERENCES mlb_players(id) ON DELETE CASCADE,
      comp_type TEXT NOT NULL DEFAULT 'auto',
      rank INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, mlb_player_id)
    )
  `);

  if (r2Configured()) await configureR2Cors();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
