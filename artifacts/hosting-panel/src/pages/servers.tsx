import { useState } from "react";
import { Link } from "wouter";
import {
  useListServers,
  getListServersQueryKey,
  useUpdateServerStatus,
} from "@workspace/api-client-react";
import type { Server } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Square, Terminal, Loader2, Server as ServerIcon, Cpu, HardDrive, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const CURRENT_USER_ID = 2;

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-emerald-400",
    stopped: "bg-zinc-600",
    error: "bg-red-400",
    starting: "bg-amber-400",
  };
  return (
    <span className="relative flex h-2 w-2">
      {status === "running" && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colors[status] ?? "bg-zinc-600"}`} />
    </span>
  );
}

function formatUptime(seconds: number) {
  if (seconds === 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MiniBar({ value, color = "bg-violet-500" }: { value: number; color?: string }) {
  return (
    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export default function Servers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: servers, isLoading } = useListServers(
    { userId: CURRENT_USER_ID },
    { query: { queryKey: getListServersQueryKey({ userId: CURRENT_USER_ID }) } }
  );

  const updateStatus = useUpdateServerStatus();
  const [loadingServer, setLoadingServer] = useState<number | null>(null);

  const handleStatusChange = async (server: Server, newStatus: "running" | "stopped") => {
    setLoadingServer(server.id);
    try {
      await updateStatus.mutateAsync({ id: server.id, data: { status: newStatus } });
      queryClient.invalidateQueries({ queryKey: getListServersQueryKey({ userId: CURRENT_USER_ID }) });
      toast({ title: `Server ${newStatus === "running" ? "started" : "stopped"}`, description: server.name });
    } catch {
      toast({ title: "Failed to update server", variant: "destructive" });
    } finally {
      setLoadingServer(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">My Servers</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your deployed server slots.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28 bg-white/5" />
                <Skeleton className="h-3 w-14 bg-white/5" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-1 w-full bg-white/5" />
                <Skeleton className="h-1 w-full bg-white/5" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1 bg-white/5" />
                <Skeleton className="h-8 flex-1 bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : servers?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-lg border border-dashed border-[#1e1e1e]">
          <ServerIcon className="w-10 h-10 text-zinc-700 mb-4" />
          <p className="text-sm font-medium text-zinc-400">No servers deployed</p>
          <p className="text-xs text-zinc-600 mt-1">You don't have any server slots yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {servers?.map((server, i) => (
            <motion.div
              key={server.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="group rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5 flex flex-col gap-4 hover:border-[#2e2e2e] transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusDot status={server.status} />
                    <span className="text-sm font-semibold text-white">{server.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 ml-4">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span className="text-[11px] text-zinc-600">{formatUptime(server.uptime)}</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                    server.status === "running"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : server.status === "error"
                      ? "bg-red-500/10 text-red-400"
                      : server.status === "starting"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {server.status}
                </span>
              </div>

              {/* Resources */}
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <HardDrive className="w-3 h-3" /> RAM
                    </span>
                    <span className="text-zinc-400 font-mono">{server.ramUsedMB} MB</span>
                  </div>
                  <MiniBar value={(server.ramUsedMB / 512) * 100} color="bg-violet-500" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <Cpu className="w-3 h-3" /> CPU
                    </span>
                    <span className="text-zinc-400 font-mono">{server.cpuUsed}%</span>
                  </div>
                  <MiniBar
                    value={server.cpuUsed}
                    color={server.cpuUsed > 80 ? "bg-red-500" : server.cpuUsed > 50 ? "bg-amber-500" : "bg-violet-500"}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-[#1a1a1a]">
                {server.status === "running" ? (
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/8 hover:bg-red-500/14 border border-red-500/15 rounded-md h-8 transition-colors disabled:opacity-50"
                    disabled={loadingServer === server.id}
                    onClick={() => handleStatusChange(server, "stopped")}
                  >
                    {loadingServer === server.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Square className="w-3.5 h-3.5" />}
                    Stop
                  </button>
                ) : (
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/8 hover:bg-emerald-500/14 border border-emerald-500/15 rounded-md h-8 transition-colors disabled:opacity-50"
                    disabled={loadingServer === server.id}
                    onClick={() => handleStatusChange(server, "running")}
                  >
                    {loadingServer === server.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" />}
                    Start
                  </button>
                )}
                <Link href={`/console/${server.id}`} className="flex-1">
                  <button className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400 bg-white/4 hover:bg-white/7 border border-white/6 rounded-md h-8 transition-colors">
                    <Terminal className="w-3.5 h-3.5" />
                    Console
                  </button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
