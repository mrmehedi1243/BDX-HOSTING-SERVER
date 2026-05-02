import { Router } from "express";
import { db, usersTable, plansTable, serversTable } from "@workspace/db";
import { eq, count, and, sql } from "drizzle-orm";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  DeleteUserParams,
  UpdateUserParams,
} from "@workspace/api-zod";

const router = Router();

async function getUserWithPlan(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  let plan = null;
  if (user.planId) {
    const [p] = await db.select().from(plansTable).where(eq(plansTable.id, user.planId));
    if (p) plan = { ...p, pricePerMonth: Number(p.pricePerMonth) };
  }

  const serverStats = await db
    .select({
      total: count(),
      running: sql<number>`count(*) filter (where ${serversTable.status} = 'running')`.mapWith(Number),
    })
    .from(serversTable)
    .where(eq(serversTable.userId, userId));

  return {
    ...user,
    plan,
    slotsUsed: serverStats[0]?.total ?? 0,
    slotsRunning: serverStats[0]?.running ?? 0,
  };
}

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.id);
    const usersWithPlans = await Promise.all(users.map((u) => getUserWithPlan(u.id)));
    res.json(usersWithPlans.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  const body = CreateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ message: "Invalid request body", errors: body.error.issues });
    return;
  }
  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        username: body.data.username,
        email: body.data.email,
        role: body.data.role ?? "user",
        planId: body.data.planId ?? null,
      })
      .returning();
    const result = await getUserWithPlan(user.id);
    res.status(201).json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

router.get("/users/:id", async (req, res) => {
  const params = GetUserParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }
  try {
    const result = await getUserWithPlan(params.data.id);
    if (!result) { res.status(404).json({ message: "User not found" }); return; }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.put("/users/:id", async (req, res) => {
  const params = UpdateUserParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }
  try {
    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    if (body.data.username !== undefined) updateData.username = body.data.username;
    if (body.data.email !== undefined) updateData.email = body.data.email;
    if (body.data.role !== undefined) updateData.role = body.data.role;
    if ("planId" in body.data) updateData.planId = body.data.planId ?? null;

    await db.update(usersTable).set(updateData).where(eq(usersTable.id, params.data.id));
    const result = await getUserWithPlan(params.data.id);
    if (!result) { res.status(404).json({ message: "User not found" }); return; }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  const params = DeleteUserParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
    res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
