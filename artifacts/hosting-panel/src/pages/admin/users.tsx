import { useState } from "react";
import { 
  useListUsers, 
  getListUsersQueryKey,
  useUpdateUser,
  useListPlans,
  getListPlansQueryKey,
} from "@workspace/api-client-react";
import type { UserWithPlan } from "@/types";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Shield, ShieldAlert, Edit } from "lucide-react";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: users, isLoading: usersLoading } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  const { data: plans, isLoading: plansLoading } = useListPlans({
    query: { queryKey: getListPlansQueryKey() }
  });

  const updateUser = useUpdateUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPlan | null>(null);
  
  const [formData, setFormData] = useState({
    role: "user",
    planId: "none"
  });

  const handleEdit = (user: UserWithPlan) => {
    setEditingUser(user);
    setFormData({
      role: user.role,
      planId: user.planId ? user.planId.toString() : "none"
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await updateUser.mutateAsync({
        id: editingUser.id,
        data: {
          role: formData.role as "admin" | "user",
          planId: formData.planId === "none" ? null : parseInt(formData.planId, 10)
        }
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setDialogOpen(false);
      toast({ title: "User updated successfully" });
    } catch (e) {
      toast({ title: "Error updating user", variant: "destructive" });
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-2">Manage user accounts, roles, and assigned plans.</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assigned Plan</Label>
              <Select value={formData.planId} onValueChange={(v) => setFormData({...formData, planId: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Plan</SelectItem>
                  {plans?.map(plan => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>{plan.name} (${plan.pricePerMonth})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateUser.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersLoading || plansLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.role === 'admin' ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        <Shield className="w-3 h-3 mr-1" />
                        User
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.plan ? (
                      <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-medium">
                        {user.plan.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className={user.slotsUsed > 0 ? "text-foreground" : "text-muted-foreground"}>
                        {user.slotsUsed}
                      </span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-muted-foreground">
                        {user.plan ? user.plan.maxSlots : 0} slots
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                      <Edit className="w-4 h-4 text-muted-foreground hover:text-primary" />
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
