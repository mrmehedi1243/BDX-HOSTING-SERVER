import { useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Trash2, PlusCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function ConsoleView() {
  const params = useParams();
  const serverId = parseInt(params.serverId || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: server, isLoading: serverLoading } = useGetServer(serverId, {
    query: {
      enabled: !!serverId,
      queryKey: getGetServerQueryKey(serverId)
    }
  });

  const { data: logs, isLoading: logsLoading } = useGetServerLogs(serverId, {
    limit: 100
  }, {
    query: {
      enabled: !!serverId,
      queryKey: getGetServerLogsQueryKey(serverId, { limit: 100 }),
      refetchInterval: 5000 // poll every 5s
    }
  });

  const addLog = useAddServerLog();
  const clearLogs = useClearServerLogs();

  const [newMessage, setNewMessage] = useState("");
  const [newLevel, setNewLevel] = useState<"info"|"warn"|"error"|"debug">("info");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleAddLog = async () => {
    if (!newMessage) return;
    try {
      await addLog.mutateAsync({
        id: serverId,
        data: { message: newMessage, level: newLevel }
      });
      queryClient.invalidateQueries({ queryKey: getGetServerLogsQueryKey(serverId, { limit: 100 }) });
      setNewMessage("");
      setDialogOpen(false);
      toast({ title: "Log added" });
    } catch (e) {
      toast({ title: "Failed to add log", variant: "destructive" });
    }
  };

  const handleClearLogs = async () => {
    try {
      await clearLogs.mutateAsync({ id: serverId });
      queryClient.invalidateQueries({ queryKey: getGetServerLogsQueryKey(serverId, { limit: 100 }) });
      toast({ title: "Logs cleared" });
    } catch (e) {
      toast({ title: "Failed to clear logs", variant: "destructive" });
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'debug': return 'text-gray-500';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/servers">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Terminal className="w-6 h-6 text-primary" />
              {serverLoading ? <Skeleton className="h-8 w-48" /> : server?.name} Console
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Log
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Log Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Enter log message..." />
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={newLevel} onValueChange={(v: any) => setNewLevel(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAddLog} disabled={!newMessage || addLog.isPending}>
                  Submit Log
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="destructive" size="sm" onClick={handleClearLogs} disabled={clearLogs.isPending}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-black/90 rounded-lg border border-border overflow-hidden flex flex-col font-mono text-sm relative">
        <div className="h-8 bg-zinc-900 border-b border-border flex items-center px-4 text-xs text-muted-foreground">
          Terminal Output
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {logsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2 bg-zinc-800" />
              <Skeleton className="h-4 w-3/4 bg-zinc-800" />
              <Skeleton className="h-4 w-1/3 bg-zinc-800" />
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-zinc-500 italic">No logs available.</div>
          ) : (
            logs?.map((log) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, x: -5 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 hover:bg-zinc-800/30 px-1 py-0.5 rounded"
              >
                <span className="text-zinc-600 shrink-0 select-none">
                  [{new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1)}]
                </span>
                <span className={`shrink-0 uppercase w-12 ${getLogLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-zinc-300 break-all">{log.message}</span>
              </motion.div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
