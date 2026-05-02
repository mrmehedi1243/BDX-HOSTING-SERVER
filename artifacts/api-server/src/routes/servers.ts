import { Router } from "express";
import { db, serversTable, usersTable, plansTable, consoleLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  CreateServerBody,
  UpdateServerStatusBody,
  GetServerParams,
  DeleteServerParams,
  UpdateServerStatusParams,
  ListServersQueryParams,
  GetServerLogsParams,
  GetServerLogsQueryParams,
  AddServerLogBody,
  AddServerLogParams,
  ClearServerLogsParams,
} from "@workspace/api-zod";

const router = Router();

function randomInRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

router.get("/servers", async (req, res) => {
  const query = ListServersQueryParams.safeParse(req.query);
  try {
    let servers;
    if (query.success && query.data.userId) {
      servers = await db
        .select()
        .from(serversTable)
        .where(eq(serversTable.userId, query.data.userId))
        .orderBy(desc(serversTable.createdAt));
    } else {
      servers = await db.select().from(serversTable).orderBy(desc(serversTable.createdAt));
    }
    res.json(servers.map((s) => ({ ...s, startedAt: s.startedAt?.toISOString() ?? null })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch servers" });
  }
});

router.post("/servers", async (req, res) => {
  const body = CreateServerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, body.data.userId));
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    if (user.planId) {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, user.planId));
      if (plan) {
        const existingServers = await db
          .select()
          .from(serversTable)
          .where(eq(serversTable.userId, body.data.userId));
        if (existingServers.length >= plan.maxSlots) {
          res.status(400).json({ message: `Slot limit reached. Your plan allows ${plan.maxSlots} slot(s).` });
          return;
        }
      }
    }

    const [server] = await db
      .insert(serversTable)
      .values({
        userId: body.data.userId,
        name: body.data.name,
        status: "stopped",
        ramUsedMB: 0,
        cpuUsed: 0,
        uptime: 0,
      })
      .returning();

    await db.insert(consoleLogsTable).values({
      serverId: server.id,
      message: `Server "${server.name}" created successfully.`,
      level: "info",
    });

    res.status(201).json({ ...server, startedAt: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to create server" });
  }
});

router.get("/servers/:id", async (req, res) => {
  const params = GetServerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ message: "Invalid server id" }); return; }
  try {
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, params.data.id));
    if (!server) { res.status(404).json({ message: "Server not found" }); return; }
    res.json({ ...server, startedAt: server.startedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch server" });
  }
});

router.delete("/servers/:id", async (req, res) => {
  const params = DeleteServerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ message: "Invalid server id" }); return; }
  try {
    await db.delete(consoleLogsTable).where(eq(consoleLogsTable.serverId, params.data.id));
    await db.delete(serversTable).where(eq(serversTable.id, params.data.id));
    res.json({ message: "Server deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to delete server" });
  }
});

router.put("/servers/:id/status", async (req, res) => {
  const params = UpdateServerStatusParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateServerStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }
  try {
    const [existing] = await db.select().from(serversTable).where(eq(serversTable.id, params.data.id));
    if (!existing) { res.status(404).json({ message: "Server not found" }); return; }

    const isStarting = body.data.status === "running";
    const newStatus = isStarting ? "starting" : "stopped";

    const [server] = await db
      .update(serversTable)
      .set({
        status: isStarting ? "running" : "stopped",
        startedAt: isStarting ? new Date() : null,
        ramUsedMB: isStarting ? randomInRange(128, 480) : 0,
        cpuUsed: isStarting ? randomInRange(5, 40) : 0,
        uptime: isStarting ? 0 : 0,
      })
      .where(eq(serversTable.id, params.data.id))
      .returning();

    await db.insert(consoleLogsTable).values({
      serverId: params.data.id,
      message: isStarting
        ? `[INFO] Server starting... Binding to port ${randomInRange(3000, 9999)}`
        : `[INFO] Server stopped gracefully.`,
      level: "info",
    });

    if (isStarting) {
      await db.insert(consoleLogsTable).values([
        { serverId: params.data.id, message: `[INFO] Loading environment variables...`, level: "info" },
        { serverId: params.data.id, message: `[INFO] Server is now running.`, level: "info" },
      ]);
    }

    res.json({ ...server, startedAt: server.startedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to update server status" });
  }
});

router.get("/servers/:id/logs", async (req, res) => {
  const params = GetServerLogsParams.safeParse({ id: Number(req.params.id) });
  const query = GetServerLogsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ message: "Invalid server id" }); return; }
  const limit = query.success ? (query.data.limit ?? 100) : 100;
  try {
    const logs = await db
      .select()
      .from(consoleLogsTable)
      .where(eq(consoleLogsTable.serverId, params.data.id))
      .orderBy(desc(consoleLogsTable.timestamp))
      .limit(limit);
    res.json(logs.reverse());
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

router.post("/servers/:id/logs", async (req, res) => {
  const params = AddServerLogParams.safeParse({ id: Number(req.params.id) });
  const body = AddServerLogBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }
  try {
    const [log] = await db
      .insert(consoleLogsTable)
      .values({ serverId: params.data.id, message: body.data.message, level: body.data.level })
      .returning();
    res.status(201).json(log);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to add log" });
  }
});

router.delete("/servers/:id/logs/clear", async (req, res) => {
  const params = ClearServerLogsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ message: "Invalid server id" }); return; }
  try {
    await db.delete(consoleLogsTable).where(eq(consoleLogsTable.serverId, params.data.id));
    res.json({ message: "Logs cleared" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to clear logs" });
  }
});

export default router;
