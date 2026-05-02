import { Router } from "express";
import { db, usersTable, plansTable, serversTable } from "@workspace/db";
import { eq, count, sql, avg } from "drizzle-orm";
import { GetUserStatsParams } from "@workspace/api-zod";

const router = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const [userCount] = await db.select({ total: count() }).from(usersTable);
    const [planCount] = await db.select({ total: count() }).from(plansTable);
    const serverStats = await db
      .select({
        total: count(),
        running: sql<number>`count(*) filter (where ${serversTable.status} = 'running')`.mapWith(Number),
        stopped: sql<number>`count(*) filter (where ${serversTable.status} = 'stopped')`.mapWith(Number),
        error: sql<number>`count(*) filter (where ${serversTable.status} = 'error')`.mapWith(Number),
        totalRam: sql<number>`coalesce(sum(${serversTable.ramUsedMB}), 0)`.mapWith(Number),
        avgCpu: sql<number>`coalesce(avg(${serversTable.cpuUsed}), 0)`.mapWith(Number),
      })
      .from(serversTable);

    res.json({
      totalUsers: userCount.total,
      totalServers: serverStats[0].total,
      runningServers: serverStats[0].running,
      stoppedServers: serverStats[0].stopped,
      errorServers: serverStats[0].error,
      totalPlans: planCount.total,
      totalRamUsedMB: serverStats[0].totalRam,
      avgCpuUsed: Math.round(serverStats[0].avgCpu),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

router.get("/dashboard/user-stats/:userId", async (req, res) => {
  const params = GetUserStatsParams.safeParse({ userId: Number(req.params.userId) });
  if (!params.success) { res.status(400).json({ message: "Invalid user id" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    let plan = null;
    if (user.planId) {
      const [p] = await db.select().from(plansTable).where(eq(plansTable.id, user.planId));
      plan = p ?? null;
    }

    const serverStats = await db
      .select({
        total: count(),
        running: sql<number>`count(*) filter (where ${serversTable.status} = 'running')`.mapWith(Number),
        stopped: sql<number>`count(*) filter (where ${serversTable.status} = 'stopped')`.mapWith(Number),
        totalRam: sql<number>`coalesce(sum(${serversTable.ramUsedMB}), 0)`.mapWith(Number),
        avgCpu: sql<number>`coalesce(avg(${serversTable.cpuUsed}), 0)`.mapWith(Number),
      })
      .from(serversTable)
      .where(eq(serversTable.userId, params.data.userId));

    res.json({
      userId: params.data.userId,
      slotsUsed: serverStats[0].total,
      slotsRunning: serverStats[0].running,
      slotsStopped: serverStats[0].stopped,
      maxSlots: plan?.maxSlots ?? 0,
      pricePerMonth: plan ? Number(plan.pricePerMonth) : 0,
      ramUsedMB: serverStats[0].totalRam,
      ramTotalMB: plan?.ramMB ?? 0,
      avgCpuUsed: Math.round(serverStats[0].avgCpu),
      cpuLimit: plan?.cpuPercent ?? 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch user stats" });
  }
});

export default router;
