import { useState } from "react";
import { Link } from "wouter";
import { 
  useListServers, 
  getListServersQueryKey,
  useUpdateServerStatus,
} from "@workspace/api-client-react";
import type { Server } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Square, Terminal, Loader2, Server as ServerIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const CURRENT_USER_ID = 2; // Hardcoded user context

export default function Servers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: servers, isLoading } = useListServers(
    { userId: CURRENT_USER_ID },
    {
      query: {
        queryKey: getListServersQueryKey({ userId: CURRENT_USER_ID })
      }
    }
  );

  const updateStatus = useUpdateServerStatus();
  const [loadingServer, setLoadingServer] = useState<number | null>(null);

  const handleStatusChange = async (server: Server, newStatus: 'running' | 'stopped') => {
    setLoadingServer(server.id);
    try {
      await updateStatus.mutateAsync({
        id: server.id,
        data: { status: newStatus }
      });
      queryClient.invalidateQueries({ queryKey: getListServersQueryKey({ userId: CURRENT_USER_ID }) });
      toast({
        title: "Status updated",
        description: `Server ${server.name} is now ${newStatus}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update server status.",
        variant: "destructive"
      });
    } finally {
      setLoadingServer(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case 'error': return "bg-destructive/10 text-destructive border-destructive/20";
      case 'starting': return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Servers</h1>
          <p className="text-muted-foreground mt-2">Manage your deployed server slots.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : servers?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border border-dashed">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No servers deployed</h3>
          <p className="text-muted-foreground">You don't have any server slots running right now.</p>
        </div>
      ) : (
        <motion.div 
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {servers?.map((server) => (
            <motion.div key={server.id} variants={item}>
              <Card className="flex flex-col h-full bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{server.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">Uptime: {Math.floor(server.uptime / 3600)}h {Math.floor((server.uptime % 3600) / 60)}m</div>
                  </div>
                  <Badge variant="outline" className={`${getStatusColor(server.status)} capitalize`}>
                    {server.status}
                  </Badge>
                </CardHeader>
                
                <CardContent className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Memory</span>
                      <span className="font-medium">{server.ramUsedMB} MB</span>
                    </div>
                    <Progress value={Math.min(100, (server.ramUsedMB / 2048) * 100)} className="h-2 bg-muted/50" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CPU</span>
                      <span className="font-medium">{server.cpuUsed}%</span>
                    </div>
                    <Progress value={server.cpuUsed} className="h-2 bg-muted/50" />
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t border-border/50 gap-3">
                  {server.status === 'running' ? (
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      disabled={loadingServer === server.id}
                      onClick={() => handleStatusChange(server, 'stopped')}
                    >
                      {loadingServer === server.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
                      Stop
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={loadingServer === server.id}
                      onClick={() => handleStatusChange(server, 'running')}
                    >
                      {loadingServer === server.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      Start
                    </Button>
                  )}
                  <Link href={`/console/${server.id}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Terminal className="w-4 h-4 mr-2" />
                      Console
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
