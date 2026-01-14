import { z } from 'zod';
import { insertUserSchema, insertDownloadSchema } from './schema';

export const api = {
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalUsers: z.number(),
          proUsers: z.number(),
          totalDownloads: z.number(),
          activeTrials: z.number(),
        }),
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(insertUserSchema.extend({ 
          id: z.number(), 
          createdAt: z.string().or(z.date()),
          trialStart: z.string().or(z.date()).nullable(),
          proEnd: z.string().or(z.date()).nullable()
        })),
      },
    },
  },
  downloads: {
    activity: {
      get: {
        method: 'GET' as const,
        path: '/api/downloads/activity',
        responses: {
          200: z.array(z.object({
            telegramId: z.string(),
            username: z.string().nullable(),
            firstName: z.string().nullable(),
            downloads: z.number(),
          })),
        },
      },
    },
  },
};
