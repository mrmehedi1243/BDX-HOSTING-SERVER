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
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Box, Cpu, HardDrive, Server } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: plans, isLoading } = useListPlans({
    query: {
      queryKey: getListPlansQueryKey()
    }
  });

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    maxSlots: "1",
    pricePerMonth: "0",
    ramMB: "1024",
    cpuPercent: "100",
    description: ""
  });

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        maxSlots: plan.maxSlots.toString(),
        pricePerMonth: plan.pricePerMonth.toString(),
        ramMB: plan.ramMB.toString(),
        cpuPercent: plan.cpuPercent.toString(),
        description: plan.description || ""
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        maxSlots: "1",
        pricePerMonth: "0",
        ramMB: "1024",
        cpuPercent: "100",
        description: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        maxSlots: parseInt(formData.maxSlots, 10),
        pricePerMonth: parseFloat(formData.pricePerMonth),
        ramMB: parseInt(formData.ramMB, 10),
        cpuPercent: parseInt(formData.cpuPercent, 10),
        description: formData.description
      };

      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, data: payload });
        toast({ title: "Plan updated successfully" });
      } else {
        await createPlan.mutateAsync({ data: payload });
        toast({ title: "Plan created successfully" });
      }
      
      queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
      setDialogOpen(false);
    } catch (error) {
      toast({ title: "Error saving plan", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      await deletePlan.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
      toast({ title: "Plan deleted successfully" });
    } catch (error) {
      toast({ title: "Error deleting plan", variant: "destructive" });
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
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
          <h1 className="text-3xl font-bold tracking-tight">Hosting Plans</h1>
          <p className="text-muted-foreground mt-2">Manage available plans and resource allocations.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. Starter Plan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price/Mo ($)</Label>
                <Input 
                  id="price" 
                  type="number" 
                  step="0.01" 
                  value={formData.pricePerMonth} 
                  onChange={e => setFormData({...formData, pricePerMonth: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slots">Max Slots</Label>
                <Input 
                  id="slots" 
                  type="number" 
                  value={formData.maxSlots} 
                  onChange={e => setFormData({...formData, maxSlots: e.target.value})} 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ram">RAM (MB)</Label>
                <Input 
                  id="ram" 
                  type="number" 
                  value={formData.ramMB} 
                  onChange={e => setFormData({...formData, ramMB: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpu">CPU (%)</Label>
                <Input 
                  id="cpu" 
                  type="number" 
                  value={formData.cpuPercent} 
                  onChange={e => setFormData({...formData, cpuPercent: e.target.value})} 
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="Brief plan description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createPlan.isPending || updatePlan.isPending}>
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : plans?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border border-dashed">
          <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No plans found</h3>
          <p className="text-muted-foreground">Create a hosting plan to get started.</p>
        </div>
      ) : (
        <motion.div 
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {plans?.map((plan) => (
            <motion.div key={plan.id} variants={item}>
              <Card className="flex flex-col h-full bg-card border-border hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-1.5 text-2xl font-bold text-foreground">
                        ${plan.pricePerMonth} <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Server className="w-4 h-4 text-primary" />
                      <span>{plan.maxSlots} Server Slots</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <HardDrive className="w-4 h-4 text-primary" />
                      <span>{(plan.ramMB / 1024).toFixed(1)} GB RAM per slot</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span>{plan.cpuPercent}% CPU limit</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-border/50 gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleOpenDialog(plan)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="destructive" className="flex-none" onClick={() => handleDelete(plan.id)} disabled={deletePlan.isPending}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
