import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const app = express();
const httpServer = createServer(app);

// Resolve __dirname in ESM and load env before importing routes/db
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from server/.env if present (dotenv)
dotenv.config({ path: path.join(__dirname, ".env") });

// Load local Telegram bot config (optional). If present, set env token so bot starts.
try {
  const cfgPath = path.join(__dirname, "telegram.bot.json");
  if (fs.existsSync(cfgPath)) {
    const raw = fs.readFileSync(cfgPath, { encoding: "utf8" });
    const cfg = JSON.parse(raw);
    if (cfg.telegramBotToken && !process.env.TELEGRAM_BOT_TOKEN) {
      process.env.TELEGRAM_BOT_TOKEN = cfg.telegramBotToken;
      console.log("Loaded Telegram bot token from telegram.bot.json");
    }
  }
} catch (e) {
  console.warn("Could not load telegram.bot.json:", e);
}

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
  const { registerRoutes } = await import("./routes");
  const { serveStatic } = await import("./static");

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  const listenOptions: any = { port, host: "0.0.0.0" };
  // `reusePort` is not supported on some platforms (Windows); enable only when available
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  httpServer.listen(listenOptions,
    async () => {
      log(`serving on port ${port}`);
      try {
        const { startBot } = await import("./bot");
        await startBot();
      } catch (e) {
        console.warn("Failed to start Telegram bot:", e);
      }
    },
  );
})();
