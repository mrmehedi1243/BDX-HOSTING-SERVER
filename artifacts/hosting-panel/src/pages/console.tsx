import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import {
  useGetServerLogs,
  getGetServerLogsQueryKey,
  useAddServerLog,
  useClearServerLogs,
  useGetServer,
  getGetServerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Trash2, PlusCircle, ArrowLeft, Circle, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { ConsoleLog } from "@/types";

type LogLevel = "info" | "warn" | "error" | "debug";

const LEVEL_STYLES: Record<LogLevel, { label: string; color: string; bg: string }> = {
  info:  { label: "INFO ", color: "text-cyan-400",   bg: "text-cyan-400" },
  warn:  { label: "WARN ", color: "text-amber-400",  bg: "text-amber-400" },
  error: { label: "ERR  ", color: "text-red-400",    bg: "text-red-400" },
  debug: { label: "DEBUG", color: "text-zinc-500",   bg: "text-zinc-500" },
};

function LogLine({ log, index }: { log: ConsoleLog; index: number }) {
  const ts = new Date(log.timestamp);
  const time = ts.toTimeString().slice(0, 8);
  const style = LEVEL_STYLES[log.level as LogLevel] ?? LEVEL_STYLES.info;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.015, 0.3) }}
      className="flex items-start gap-3 group px-4 py-0.5 hover:bg-white/2 font-mono text-[12px] leading-6"
    >
      <span className="text-zinc-700 shrink-0 select-none tabular-nums">{time}</span>
      <span className={`shrink-0 font-semibold ${style.color}`}>{style.label}</span>
      <span className="text-zinc-300 break-all">{log.message}</span>
    </motion.div>
  );
}

export default function ConsoleView() {
  const params = useParams();
  const serverId = parseInt(params.serverId || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<ConsoleLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [newLevel, setNewLevel] = useState<LogLevel>("info");
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: server, isLoading: serverLoading } = useGetServer(serverId, {
    query: { enabled: !!serverId, queryKey: getGetServerQueryKey(serverId) }
  });

  const { data: initialLogs, isLoading: logsLoading } = useGetServerLogs(
    serverId,
    { limit: 200 },
    { query: { enabled: !!serverId, queryKey: getGetServerLogsQueryKey(serverId, { limit: 200 }) } }
  );

  const addLog = useAddServerLog();
  const clearLogs = useClearServerLogs();

  // Merge initial + live logs, deduplicate by id
  const allLogs: ConsoleLog[] = (() => {
    const base: ConsoleLog[] = (initialLogs as ConsoleLog[] | undefined) ?? [];
    const map = new Map<number, ConsoleLog>();
    for (const l of base) map.set(l.id, l);
    for (const l of liveLogs) map.set(l.id, l);
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  })();

  // SSE real-time log streaming
  useEffect(() => {
    if (!serverId) return;
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const url = `${BASE}/api/servers/${serverId}/logs/stream`;
    const es = new EventSource(url);

    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);

    es.onmessage = (evt) => {
      try {
        const log: ConsoleLog = JSON.parse(evt.data);
        setLiveLogs((prev) => {
          if (prev.some((l) => l.id === log.id)) return prev;
          return [...prev, log];
        });
      } catch {}
    };

    return () => {
      es.close();
      setLiveConnected(false);
    };
  }, [serverId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allLogs, autoScroll]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  }, []);

  const handleAddLog = async () => {
    if (!newMessage.trim()) return;
    try {
      await addLog.mutateAsync({ id: serverId, data: { message: newMessage, level: newLevel } });
      queryClient.invalidateQueries({ queryKey: getGetServerLogsQueryKey(serverId, { limit: 200 }) });
      setNewMessage("");
      setDialogOpen(false);
    } catch {
      toast({ title: "Failed to add log", variant: "destructive" });
    }
  };

  const handleClearLogs = async () => {
    try {
      await clearLogs.mutateAsync({ id: serverId });
      setLiveLogs([]);
      queryClient.invalidateQueries({ queryKey: getGetServerLogsQueryKey(serverId, { limit: 200 }) });
      toast({ title: "Logs cleared" });
    } catch {
      toast({ title: "Failed to clear logs", variant: "destructive" });
    }
  };

  const serverStatus = (server as any)?.status ?? "stopped";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3 -mt-2">
      {/* Top bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Link href="/servers">
            <button className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-zinc-500" />
            {serverLoading ? (
              <Skeleton className="h-5 w-36 bg-white/5" />
            ) : (
              <span className="text-sm font-semibold text-white">{server?.name}</span>
            )}
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                serverStatus === "running"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : serverStatus === "error"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-white/5 text-zinc-500"
              }`}
            >
              {serverStatus}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border ${
            liveConnected
              ? "bg-emerald-500/8 border-emerald-500/15 text-emerald-400"
              : "bg-white/4 border-white/6 text-zinc-500"
          }`}>
            {liveConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {liveConnected ? "Live" : "Offline"}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-white/4 hover:bg-white/7 border border-white/6 rounded-md px-3 h-8 transition-colors">
                <PlusCircle className="w-3.5 h-3.5" />
                Inject Log
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#111] border-[#1e1e1e]">
              <DialogHeader>
                <DialogTitle className="text-white text-sm">Inject Log Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Message</Label>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLog()}
                    placeholder="Enter log message..."
                    className="bg-[#0a0a0a] border-[#1e1e1e] text-white font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Level</Label>
                  <Select value={newLevel} onValueChange={(v: any) => setNewLevel(v)}>
                    <SelectTrigger className="bg-[#0a0a0a] border-[#1e1e1e] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-[#1e1e1e]">
                      <SelectItem value="info">info</SelectItem>
                      <SelectItem value="warn">warn</SelectItem>
                      <SelectItem value="error">error</SelectItem>
                      <SelectItem value="debug">debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button
                  className="w-full h-9 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors disabled:opacity-50"
                  onClick={handleAddLog}
                  disabled={!newMessage.trim() || addLog.isPending}
                >
                  Inject
                </button>
              </div>
            </DialogContent>
          </Dialog>

          <button
            className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/8 hover:bg-red-500/14 border border-red-500/15 rounded-md px-3 h-8 transition-colors disabled:opacity-50"
            onClick={handleClearLogs}
            disabled={clearLogs.isPending}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 rounded-lg border border-[#1a1a1a] overflow-hidden flex flex-col" style={{ background: "#080808" }}>
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#141414]" style={{ background: "#0d0d0d" }}>
          <div className="flex gap-1.5">
            <Circle className="w-2.5 h-2.5 fill-red-500/60 text-red-500/60" />
            <Circle className="w-2.5 h-2.5 fill-amber-500/60 text-amber-500/60" />
            <Circle className="w-2.5 h-2.5 fill-emerald-500/60 text-emerald-500/60" />
          </div>
          <span className="text-[11px] text-zinc-600 ml-2 font-mono">
            {server?.name ?? "..."}  —  console output
          </span>
          {liveConnected && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
              <span className="text-[10px] text-zinc-600">streaming</span>
            </div>
          )}
        </div>

        {/* Log body */}
        <div className="flex-1 overflow-y-auto py-3" onScroll={handleScroll}>
          {logsLoading ? (
            <div className="px-4 space-y-2 py-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-4 bg-white/3" style={{ width: `${40 + (i * 13) % 50}%` }} />
              ))}
            </div>
          ) : allLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-700 font-mono text-sm">
              <Terminal className="w-8 h-8 mb-3 opacity-30" />
              <p>No log output</p>
              <p className="text-xs mt-1 opacity-60">Start the server to see logs appear here</p>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {allLogs.map((log, i) => (
                  <LogLine key={log.id} log={log} index={i} />
                ))}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </>
          )}
        </div>

        {/* Prompt bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#141414]" style={{ background: "#0d0d0d" }}>
          <span className="text-violet-400 font-mono text-xs">$</span>
          <span className="text-zinc-600 font-mono text-xs flex-1 truncate">read-only terminal</span>
          <span className="text-[10px] text-zinc-700 font-mono">{allLogs.length} entries</span>
        </div>
      </div>
    </div>
  );
}
