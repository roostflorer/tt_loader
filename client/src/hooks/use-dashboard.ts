import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Define return types based on schema inference or API contract
type StatsResponse = {
  totalUsers: number;
  proUsers: number;
  totalDownloads: number;
  activeTrials: number;
};

type UserResponse = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  isPro: boolean;
  trialStart: string | Date | null;
  proEnd: string | Date | null;
  createdAt: string | Date;
};

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      return api.stats.get.responses[200].parse(data);
    },
  });
}

export function useUsers() {
  return useQuery<UserResponse[]>({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return api.users.list.responses[200].parse(data);
    },
  });
}

type DownloadsActivityItem = {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  downloads: number;
};

export function useDownloadsActivity(limit = 20) {
  return useQuery<DownloadsActivityItem[]>({
    queryKey: [api.downloads.activity.get.path, limit],
    queryFn: async () => {
      const res = await fetch(`${api.downloads.activity.get.path}?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch downloads activity');
      const data = await res.json();
      return api.downloads.activity.get.responses[200].parse(data);
    },
  });
}
