import { Router, Response } from "express";
import { db, serversTable, usersTable, plansTable, consoleLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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

// SSE broadcast registry: serverId -> set of connected Response objects
const sseClients = new Map<number, Set<Response>>();

function broadcastLog(serverId: number, log: { id: number; serverId: number; message: string; level: string; timestamp: Date | string }) {
  const clients = sseClients.get(serverId);
  if (!clients) return;
  const data = JSON.stringify({
    id: log.id,
    serverId: log.serverId,
    message: log.message,
    level: log.level,
    timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
  });
  for (const client of clients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {}
  }
}

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

    const [log] = await db.insert(consoleLogsTable).values({
      serverId: server.id,
      message: `Server "${server.name}" created successfully.`,
      level: "info",
    }).returning();
    broadcastLog(server.id, log);

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

    const [server] = await db
      .update(serversTable)
      .set({
        status: isStarting ? "running" : "stopped",
        startedAt: isStarting ? new Date() : null,
        ramUsedMB: isStarting ? randomInRange(128, 480) : 0,
        cpuUsed: isStarting ? randomInRange(5, 40) : 0,
        uptime: 0,
      })
      .where(eq(serversTable.id, params.data.id))
      .returning();

    const port = randomInRange(3000, 9999);
    const bootLogs = isStarting
      ? [
          { serverId: params.data.id, message: `▶ Initializing process runner...`, level: "info" as const },
          { serverId: params.data.id, message: `✓ Environment variables loaded (${randomInRange(8, 24)} vars)`, level: "info" as const },
          { serverId: params.data.id, message: `✓ Network interface bound to 0.0.0.0:${port}`, level: "info" as const },
          { serverId: params.data.id, message: `✓ Server "${existing.name}" is now running`, level: "info" as const },
        ]
      : [
          { serverId: params.data.id, message: `⏹ SIGTERM received — draining connections...`, level: "warn" as const },
          { serverId: params.data.id, message: `✓ Server "${existing.name}" stopped gracefully`, level: "info" as const },
        ];

    const inserted = await db.insert(consoleLogsTable).values(bootLogs).returning();
    for (const log of inserted) broadcastLog(params.data.id, log);

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
  const limit = query.success ? (query.data.limit ?? 200) : 200;
  try {
    const logs = await db
      .select()
      .from(consoleLogsTable)
      .where(eq(consoleLogsTable.serverId, params.data.id))
      .orderBy(desc(consoleLogsTable.timestamp))
      .limit(limit);
    res.json(logs.reverse().map(l => ({ ...l, timestamp: l.timestamp.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

// SSE stream endpoint for real-time logs
router.get("/servers/:id/logs/stream", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid server id" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send heartbeat comment every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch {}
  }, 15000);

  if (!sseClients.has(id)) sseClients.set(id, new Set());
  sseClients.get(id)!.add(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(id)?.delete(res);
    if (sseClients.get(id)?.size === 0) sseClients.delete(id);
  });
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
    broadcastLog(params.data.id, { ...log, timestamp: log.timestamp.toISOString() });
    res.status(201).json({ ...log, timestamp: log.timestamp.toISOString() });
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
