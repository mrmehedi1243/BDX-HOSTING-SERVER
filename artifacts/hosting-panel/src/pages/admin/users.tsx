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
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Shield, User, Server } from "lucide-react";
import { motion } from "framer-motion";

function SlotBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? (used / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-600">{used} / {max} slots</span>
    </div>
  );
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users, isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const { data: plans } = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const updateUser = useUpdateUser();

  const [editUser, setEditUser] = useState<UserWithPlan | null>(null);
  const [editPlanId, setEditPlanId] = useState<string>("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");

  const openEdit = (u: UserWithPlan) => {
    setEditUser(u);
    setEditPlanId(u.planId ? String(u.planId) : "none");
    setEditRole(u.role);
  };

  const handleSave = async () => {
    if (!editUser) return;
    try {
      await updateUser.mutateAsync({
        id: editUser.id,
        data: {
          planId: editPlanId === "none" ? undefined : Number(editPlanId),
          role: editRole,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setEditUser(null);
      toast({ title: "User updated" });
    } catch {
      toast({ title: "Failed to update user", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Users</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage user accounts, plans, and roles.</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] overflow-hidden divide-y divide-[#1a1a1a]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-8 w-8 rounded-full bg-white/5" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-28 bg-white/5" />
                <Skeleton className="h-3 w-36 bg-white/5" />
              </div>
              <Skeleton className="h-6 w-16 bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] overflow-hidden divide-y divide-[#1a1a1a]">
          {/* Table head */}
          <div className="grid grid-cols-[1fr_1fr_120px_100px_40px] gap-4 px-4 py-2.5 bg-[#0d0d0d]">
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">User</span>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Plan</span>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Slots</span>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Role</span>
            <span />
          </div>

          {users?.map((user, i) => {
            const maxSlots = user.plan?.maxSlots ?? 0;
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-[1fr_1fr_120px_100px_40px] gap-4 items-center px-4 py-3 hover:bg-white/2 transition-colors"
              >
                {/* User */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-violet-300">
                      {user.username[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{user.username}</p>
                    <p className="text-[10px] text-zinc-600 truncate">{user.email}</p>
                  </div>
                </div>

                {/* Plan */}
                <div className="text-xs text-zinc-400">
                  {user.plan ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      {user.plan.name}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </div>

                {/* Slots */}
                <div>
                  <SlotBar used={user.slotsUsed} max={maxSlots} />
                </div>

                {/* Role */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      user.role === "admin"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {user.role === "admin" ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                    {user.role}
                  </span>
                </div>

                {/* Edit */}
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                  onClick={() => openEdit(user as UserWithPlan)}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="bg-[#111] border-[#1e1e1e]">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-3 p-3 rounded-md bg-white/3 border border-[#1e1e1e]">
                <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-violet-300">
                    {editUser.username[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{editUser.username}</p>
                  <p className="text-xs text-zinc-500">{editUser.email}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Assign Plan</Label>
                <Select value={editPlanId} onValueChange={setEditPlanId}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#1e1e1e] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#1e1e1e]">
                    <SelectItem value="none">No Plan</SelectItem>
                    {plans?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — ${p.pricePerMonth}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Role</Label>
                <Select value={editRole} onValueChange={(v: any) => setEditRole(v)}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#1e1e1e] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#1e1e1e]">
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button
                className="w-full h-9 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors mt-2 disabled:opacity-50"
                onClick={handleSave}
                disabled={updateUser.isPending}
              >
                Save Changes
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
