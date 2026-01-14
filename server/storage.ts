import { db } from "./db";
import { users, downloads, type User, type InsertUser, type Download, type InsertDownload } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  createDownload(download: InsertDownload): Promise<Download>;
  getStats(): Promise<{
    totalUsers: number;
    proUsers: number;
    totalDownloads: number;
    activeTrials: number;
  }>;
  getDownloadsByUser(limit?: number): Promise<Array<{ telegramId: string; username: string | null; firstName: string | null; downloads: number }>>;
  getAllUsers(): Promise<User[]>;
  setUserPro(telegramId: string, isPro: boolean, durationDays?: number): Promise<User>;
  addReferral(userId: number, referredByUserId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User | undefined;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user as User | undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user as User;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user as User;
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const [download] = await db.insert(downloads).values(insertDownload).returning();
    return download as Download;
  }

  async getStats() {
    const [userStats] = await db.select({
      total: sql<number>`count(*)`,
      pro: sql<number>`sum(case when is_pro = true then 1 else 0 end)`,
      trials: sql<number>`sum(case when trial_start > now() - interval '24 hours' then 1 else 0 end)`,
    }).from(users);

    const [downloadStats] = await db.select({
      total: sql<number>`count(*)`,
    }).from(downloads);

    return {
      totalUsers: Number(userStats?.total || 0),
      proUsers: Number(userStats?.pro || 0),
      totalDownloads: Number(downloadStats?.total || 0),
      activeTrials: Number(userStats?.trials || 0),
    };
  }

  async getDownloadsByUser(limit?: number) {
    const res = await db.select({
      telegramId: users.telegramId,
      username: users.username,
      firstName: users.firstName,
      downloads: sql<number>`count(*)`,
    })
    .from(downloads)
    .leftJoin(users, eq(downloads.userId, users.id))
    .groupBy(users.telegramId, users.username, users.firstName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit || 20);

    return (res as any[]).map(r => ({
      telegramId: r.telegramId,
      username: r.username ?? null,
      firstName: r.firstName ?? null,
      downloads: Number(r.downloads || 0),
    }));
  }

  async getAllUsers(): Promise<User[]> {
    const res = await db.select().from(users).orderBy(desc(users.createdAt));
    return res as User[];
  }

  async setUserPro(telegramId: string, isPro: boolean, durationDays?: number): Promise<User> {
    const updates: any = { isPro };
    if (isPro && durationDays) {
      const end = new Date();
      end.setDate(end.getDate() + durationDays);
      updates.proEnd = end;
    } else if (!isPro) {
      updates.proEnd = null;
    }
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.telegramId, telegramId))
      .returning();
    return user as User;
  }

  async addReferral(userId: number, referredByUserId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({ referredBy: referredByUserId })
        .where(eq(users.id, userId));

      const [referrer] = await tx.select().from(users).where(eq(users.id, referredByUserId));
      if (referrer) {
        const currentEnd = referrer.proEnd ? new Date(referrer.proEnd) : new Date();
        const newProEnd = new Date(Math.max(currentEnd.getTime(), new Date().getTime()));
        newProEnd.setDate(newProEnd.getDate() + 1);
        
        await tx.update(users)
          .set({ 
            referralCount: (referrer.referralCount || 0) + 1,
            isPro: true,
            proEnd: newProEnd
          })
          .where(eq(users.id, referredByUserId));
      }
    });
  }
}

export const storage = new DatabaseStorage();
