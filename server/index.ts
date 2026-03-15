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
