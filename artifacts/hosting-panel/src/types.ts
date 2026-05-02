export interface Plan {
  id: number;
  name: string;
  maxSlots: number;
  pricePerMonth: number;
  ramMB: number;
  cpuPercent: number;
  description?: string;
  createdAt: string;
}

export interface UserWithPlan {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  planId?: number | null;
  plan?: Plan | null;
  createdAt: string;
  slotsUsed: number;
  slotsRunning: number;
}

export interface Server {
  id: number;
  userId: number;
  name: string;
  status: "running" | "stopped" | "error" | "starting";
  ramUsedMB: number;
  cpuUsed: number;
  uptime: number;
  createdAt: string;
  startedAt?: string | null;
}

export interface ConsoleLog {
  id: number;
  serverId: number;
  message: string;
  level: "info" | "warn" | "error" | "debug";
  timestamp: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalServers: number;
  runningServers: number;
  stoppedServers: number;
  errorServers: number;
  totalPlans: number;
  totalRamUsedMB: number;
  avgCpuUsed: number;
}

export interface UserStats {
  userId: number;
  slotsUsed: number;
  slotsRunning: number;
  slotsStopped: number;
  maxSlots: number;
  pricePerMonth: number;
  ramUsedMB: number;
  ramTotalMB: number;
  avgCpuUsed: number;
  cpuLimit: number;
}
