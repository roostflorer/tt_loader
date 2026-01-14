import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "../shared/routes";
import { startBot } from "./bot";
import { z } from "zod";

import express from "express";

// debug: inspect imported api at runtime
console.log('shared api keys:', api && Object.keys(api));

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Start the bot and get instance
  let bot: any = null;
  try {
    bot = await startBot();
  } catch (e) {
    console.error("Failed to start bot:", e);
  }

  // If using webhook mode, register webhook endpoint and set webhook URL
  const mode = (process.env.TELEGRAM_BOT_MODE || process.env.BOT_MODE || "polling").toLowerCase();
  if (bot && mode === "webhook") {
    const webhookPath = "/telegram-webhook";
    app.post(webhookPath, express.json(), async (req, res) => {
      try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
      } catch (err) {
        console.error("Webhook handling error:", err);
        res.sendStatus(500);
      }
    });

    // Dev-only helper to inject audioStore entries for testing the audio callback
    if (process.env.NODE_ENV !== "production") {
      app.post("/__test/audio", express.json(), async (req, res) => {
        try {
          const { id, videoUrl } = req.body as { id?: string; videoUrl?: string };
          if (!id || !videoUrl) return res.status(400).json({ message: "id and videoUrl required" });
          // call global setter created in bot.startBot
          // @ts-ignore
          if (typeof globalThis.__setAudioStoreEntry === "function") {
            // @ts-ignore
            globalThis.__setAudioStoreEntry(id, videoUrl);
            return res.json({ ok: true });
          }
          return res.status(500).json({ message: "audioStore setter not available" });
        } catch (err) {
          console.error(err);
          res.status(500).json({ message: "error" });
        }
      });
    }

    const webhookUrl = process.env.WEBHOOK_URL || process.env.TELEGRAM_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await bot.api.setWebhook(webhookUrl + webhookPath, { drop_pending_updates: true });
        console.log("Webhook set to:", webhookUrl + webhookPath);
      } catch (err) {
        console.warn("Failed to set webhook:", err);
      }
    }
  }

  // API Routes for Dashboard
  app.get(api.stats.get.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get(api.downloads.activity.get.path, async (req, res) => {
    try {
      const limitParam = req.query.limit as string | undefined;
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      const data = await storage.getDownloadsByUser(limit);
      res.json(data);
    } catch (err: any) {
      console.error('Failed to fetch downloads activity', err);
      res.status(500).json({ message: 'error' });
    }
  });

  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post("/api/users/:telegramId/pro", async (req, res) => {
    const { telegramId } = req.params;
    const { isPro, durationDays } = z.object({
      isPro: z.boolean(),
      durationDays: z.number().optional()
    }).parse(req.body);

    try {
      const user = await storage.setUserPro(telegramId, isPro, durationDays);
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
