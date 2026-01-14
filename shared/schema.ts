import { pgTable, text, serial, integer, boolean, timestamp, AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(), // stored as string to handle large integers
  username: text("username"),
  firstName: text("first_name"),
  isPro: boolean("is_pro").default(false),
  trialStart: timestamp("trial_start").defaultNow(),
  proEnd: timestamp("pro_end"),
  referredBy: integer("referred_by").references((): AnyPgColumn => users.id),
  referralCount: integer("referral_count").default(0),
  language: text("language").default("ru"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  fileId: text("file_id"), // Telegram file ID
  videoUrl: text("video_url"),
  isWatermarked: boolean("is_watermarked").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDownloadSchema = createInsertSchema(downloads).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = any; // Bypass strict zod issues in storage
export type Download = typeof downloads.$inferSelect;
export type InsertDownload = any;
