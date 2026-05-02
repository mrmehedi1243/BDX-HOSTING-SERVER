import { useState } from "react";
import { 
  useListServers, 
  getListServersQueryKey,
  useDeleteServer
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, HardDrive, Cpu, Activity, AlertCircle, Play, Square } from "lucide-react";

export default function AdminServers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: servers, isLoading } = useListServers(
    {}, 
    { query: { queryKey: getListServersQueryKey() } }
  );

  const deleteServer = useDeleteServer();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to forcibly delete this server? This will terminate the slot for the user.")) return;
    
    setDeletingId(id);
    try {
      await deleteServer.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListServersQueryKey() });
      toast({ title: "Server deleted successfully" });
    } catch (e) {
      toast({ title: "Error deleting server", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><Play className="w-3 h-3 mr-1"/> Running</Badge>;
      case 'error': return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="w-3 h-3 mr-1"/> Error</Badge>;
      case 'starting': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Activity className="w-3 h-3 mr-1"/> Starting</Badge>;
      default: return <Badge variant="outline" className="bg-muted text-muted-foreground border-border"><Square className="w-3 h-3 mr-1"/> Stopped</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Servers</h1>
        <p className="text-muted-foreground mt-2">Global view of all deployed server slots across the platform.</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>RAM Usage</TableHead>
              <TableHead>CPU Load</TableHead>
              <TableHead>Uptime</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : servers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No servers deployed
                </TableCell>
              </TableRow>
            ) : (
              servers?.map((server) => (
                <TableRow key={server.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{server.name}</TableCell>
                  <TableCell className="text-muted-foreground">#{server.userId}</TableCell>
                  <TableCell>{getStatusBadge(server.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <HardDrive className="w-4 h-4 text-muted-foreground" />
                      {server.ramUsedMB} MB
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Cpu className="w-4 h-4 text-muted-foreground" />
                      {server.cpuUsed}%
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {Math.floor(server.uptime / 3600)}h {Math.floor((server.uptime % 3600) / 60)}m
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deletingId === server.id}
                      onClick={() => handleDelete(server.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
