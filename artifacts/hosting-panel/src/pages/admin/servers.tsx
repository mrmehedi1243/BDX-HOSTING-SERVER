import { useState } from "react";
import {
  useListServers,
  getListServersQueryKey,
  useDeleteServer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, HardDrive, Cpu, Clock, Play, Square, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-emerald-500/10 text-emerald-400",
    stopped: "bg-white/5 text-zinc-500",
    error: "bg-red-500/10 text-red-400",
    starting: "bg-amber-500/10 text-amber-400",
  };
  const icons: Record<string, React.ElementType> = {
    running: Play,
    stopped: Square,
    error: AlertCircle,
    starting: Clock,
  };
  const Icon = icons[status] ?? Square;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${map[status] ?? "bg-white/5 text-zinc-500"}`}>
      <Icon className="w-2.5 h-2.5" />
      {status}
    </span>
  );
}

function formatUptime(s: number) {
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminServers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: servers, isLoading } = useListServers({}, { query: { queryKey: getListServersQueryKey() } });
  const deleteServer = useDeleteServer();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("Forcibly delete this server? The user will lose this slot.")) return;
    setDeletingId(id);
    try {
      await deleteServer.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListServersQueryKey() });
      toast({ title: "Server deleted" });
    } catch {
      toast({ title: "Failed to delete server", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">All Servers</h1>
        <p className="text-sm text-zinc-500 mt-1">Global view of every deployed slot across all users.</p>
      </div>

      <div className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] overflow-hidden">
        {/* Head */}
        <div className="grid grid-cols-[1.5fr_80px_100px_110px_100px_100px_40px] gap-3 px-4 py-2.5 bg-[#0d0d0d] border-b border-[#1a1a1a]">
          {["Server", "User", "Status", "RAM", "CPU", "Uptime", ""].map((h) => (
            <span key={h} className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1.5fr_80px_100px_110px_100px_100px_40px] gap-3 items-center px-4 py-3 border-b border-[#141414]">
              <Skeleton className="h-3 w-32 bg-white/5" />
              <Skeleton className="h-3 w-12 bg-white/5" />
              <Skeleton className="h-5 w-20 bg-white/5 rounded-full" />
              <Skeleton className="h-3 w-16 bg-white/5" />
              <Skeleton className="h-3 w-10 bg-white/5" />
              <Skeleton className="h-3 w-14 bg-white/5" />
              <Skeleton className="h-6 w-6 bg-white/5" />
            </div>
          ))
        ) : servers?.length === 0 ? (
          <div className="text-center py-12 text-sm text-zinc-600">No servers deployed</div>
        ) : (
          servers?.map((server, i) => (
            <motion.div
              key={server.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-[1.5fr_80px_100px_110px_100px_100px_40px] gap-3 items-center px-4 py-3 border-b border-[#141414] last:border-0 hover:bg-white/2 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${server.status === "running" ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <span className="text-xs font-medium text-white truncate">{server.name}</span>
              </div>

              <span className="text-[11px] text-zinc-500 font-mono">#{server.userId}</span>

              <StatusPill status={server.status} />

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <HardDrive className="w-3 h-3 text-zinc-600" />
                {server.ramUsedMB} MB
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Cpu className="w-3 h-3 text-zinc-600" />
                {server.cpuUsed}%
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Clock className="w-3 h-3 text-zinc-700" />
                {formatUptime(server.uptime)}
              </div>

              <button
                className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                disabled={deletingId === server.id}
                onClick={() => handleDelete(server.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
