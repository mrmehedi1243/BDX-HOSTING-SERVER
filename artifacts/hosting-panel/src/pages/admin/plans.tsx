import { useState } from "react";
import {
  useListPlans,
  getListPlansQueryKey,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from "@workspace/api-client-react";
import type { Plan } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Server, HardDrive, Cpu, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface PlanForm {
  name: string;
  maxSlots: number;
  pricePerMonth: number;
  ramMB: number;
  cpuPercent: number;
  description: string;
}

const emptyForm: PlanForm = { name: "", maxSlots: 1, pricePerMonth: 0, ramMB: 512, cpuPercent: 25, description: "" };

function PlanFormFields({ form, setForm }: { form: PlanForm; setForm: (f: PlanForm) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-zinc-400">Plan Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Pro"
            className="bg-[#0a0a0a] border-[#1e1e1e] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">Price / month ($)</Label>
          <Input
            type="number"
            value={form.pricePerMonth}
            onChange={(e) => setForm({ ...form, pricePerMonth: Number(e.target.value) })}
            className="bg-[#0a0a0a] border-[#1e1e1e] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">Max Slots</Label>
          <Input
            type="number"
            value={form.maxSlots}
            onChange={(e) => setForm({ ...form, maxSlots: Number(e.target.value) })}
            className="bg-[#0a0a0a] border-[#1e1e1e] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">RAM (MB)</Label>
          <Input
            type="number"
            value={form.ramMB}
            onChange={(e) => setForm({ ...form, ramMB: Number(e.target.value) })}
            className="bg-[#0a0a0a] border-[#1e1e1e] text-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">CPU Limit (%)</Label>
          <Input
            type="number"
            value={form.cpuPercent}
            onChange={(e) => setForm({ ...form, cpuPercent: Number(e.target.value) })}
            className="bg-[#0a0a0a] border-[#1e1e1e] text-white"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-zinc-400">Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Short description..."
            className="bg-[#0a0a0a] border-[#1e1e1e] text-white"
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: plans, isLoading } = useListPlans({ query: { queryKey: getListPlansQueryKey() } });

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [createForm, setCreateForm] = useState<PlanForm>(emptyForm);
  const [editForm, setEditForm] = useState<PlanForm>(emptyForm);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    try {
      await createPlan.mutateAsync({ data: createForm });
      queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
      setCreateForm(emptyForm);
      setCreateOpen(false);
      toast({ title: "Plan created" });
    } catch {
      toast({ title: "Failed to create plan", variant: "destructive" });
    }
  };

  const handleEdit = async () => {
    if (!editPlan) return;
    try {
      await updatePlan.mutateAsync({ id: editPlan.id, data: editForm });
      queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
      setEditPlan(null);
      toast({ title: "Plan updated" });
    } catch {
      toast({ title: "Failed to update plan", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this plan?")) return;
    setDeletingId(id);
    try {
      await deletePlan.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
      toast({ title: "Plan deleted" });
    } catch {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Hosting Plans</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage available plans and resource allocations.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md px-3 h-8 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Plan
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#111] border-[#1e1e1e]">
            <DialogHeader>
              <DialogTitle className="text-white text-sm">Create Plan</DialogTitle>
            </DialogHeader>
            <PlanFormFields form={createForm} setForm={setCreateForm} />
            <button
              className="w-full h-9 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors mt-2 disabled:opacity-50"
              onClick={handleCreate}
              disabled={!createForm.name.trim() || createPlan.isPending}
            >
              Create
            </button>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5 space-y-4">
              <Skeleton className="h-5 w-24 bg-white/5" />
              <Skeleton className="h-8 w-20 bg-white/5" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-white/5" />
                <Skeleton className="h-3 w-3/4 bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {plans?.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="group rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5 flex flex-col gap-4 hover:border-[#2e2e2e] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">Plan</p>
                  <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-[11px] text-zinc-600 mt-0.5">{plan.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-2xl font-semibold text-white">${plan.pricePerMonth}</span>
                  <span className="text-xs text-zinc-600">/mo</span>
                </div>
              </div>

              <div className="space-y-2 text-[12px] text-zinc-500">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-violet-400" />
                  <span>{plan.maxSlots} server slot{plan.maxSlots !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                  <span>{(plan.ramMB / 1024).toFixed(1)} GB RAM per slot</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{plan.cpuPercent}% CPU limit</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#1a1a1a]">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400 bg-white/4 hover:bg-white/7 border border-white/6 rounded-md h-8 transition-colors"
                  onClick={() => {
                    setEditPlan(plan as Plan);
                    setEditForm({
                      name: plan.name,
                      maxSlots: plan.maxSlots,
                      pricePerMonth: plan.pricePerMonth,
                      ramMB: plan.ramMB,
                      cpuPercent: plan.cpuPercent,
                      description: plan.description ?? "",
                    });
                  }}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/8 hover:bg-red-500/14 border border-red-500/15 rounded-md px-3 h-8 transition-colors disabled:opacity-50"
                  onClick={() => handleDelete(plan.id)}
                  disabled={deletingId === plan.id}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
        <DialogContent className="bg-[#111] border-[#1e1e1e]">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Edit Plan</DialogTitle>
          </DialogHeader>
          <PlanFormFields form={editForm} setForm={setEditForm} />
          <button
            className="w-full h-9 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors mt-2 disabled:opacity-50"
            onClick={handleEdit}
            disabled={!editForm.name.trim() || updatePlan.isPending}
          >
            Save Changes
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
