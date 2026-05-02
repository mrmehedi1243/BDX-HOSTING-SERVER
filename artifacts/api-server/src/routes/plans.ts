import { Router } from "express";
import { db, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreatePlanBody,
  UpdatePlanBody,
  GetPlanParams,
  DeletePlanParams,
  UpdatePlanParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/plans", async (req, res) => {
  try {
    const plans = await db.select().from(plansTable).orderBy(plansTable.id);
    res.json(plans.map((p) => ({ ...p, pricePerMonth: Number(p.pricePerMonth) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

router.post("/plans", async (req, res) => {
  const body = CreatePlanBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ message: "Invalid request body", errors: body.error.issues });
    return;
  }
  try {
    const [plan] = await db
      .insert(plansTable)
      .values({
        name: body.data.name,
        maxSlots: body.data.maxSlots,
        pricePerMonth: String(body.data.pricePerMonth),
        ramMB: body.data.ramMB,
        cpuPercent: body.data.cpuPercent,
        description: body.data.description ?? null,
      })
      .returning();
    res.status(201).json({ ...plan, pricePerMonth: Number(plan.pricePerMonth) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to create plan" });
  }
});

router.get("/plans/:id", async (req, res) => {
  const params = GetPlanParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ message: "Invalid plan id" });
    return;
  }
  try {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, params.data.id));
    if (!plan) { res.status(404).json({ message: "Plan not found" }); return; }
    res.json({ ...plan, pricePerMonth: Number(plan.pricePerMonth) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch plan" });
  }
});

router.put("/plans/:id", async (req, res) => {
  const params = UpdatePlanParams.safeParse({ id: Number(req.params.id) });
  const body = UpdatePlanBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }
  try {
    const [plan] = await db
      .update(plansTable)
      .set({
        name: body.data.name,
        maxSlots: body.data.maxSlots,
        pricePerMonth: String(body.data.pricePerMonth),
        ramMB: body.data.ramMB,
        cpuPercent: body.data.cpuPercent,
        description: body.data.description ?? null,
      })
      .where(eq(plansTable.id, params.data.id))
      .returning();
    if (!plan) { res.status(404).json({ message: "Plan not found" }); return; }
    res.json({ ...plan, pricePerMonth: Number(plan.pricePerMonth) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to update plan" });
  }
});

router.delete("/plans/:id", async (req, res) => {
  const params = DeletePlanParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ message: "Invalid plan id" });
    return;
  }
  try {
    await db.delete(plansTable).where(eq(plansTable.id, params.data.id));
    res.json({ message: "Plan deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to delete plan" });
  }
});

export default router;
