import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const serverStatusEnum = pgEnum("server_status", [
  "running",
  "stopped",
  "error",
  "starting",
]);
export const logLevelEnum = pgEnum("log_level", [
  "info",
  "warn",
  "error",
  "debug",
]);

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  maxSlots: integer("max_slots").notNull().default(1),
  pricePerMonth: numeric("price_per_month", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  ramMB: integer("ram_mb").notNull().default(512),
  cpuPercent: integer("cpu_percent").notNull().default(25),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("user"),
  planId: integer("plan_id").references(() => plansTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serversTable = pgTable("servers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  name: text("name").notNull(),
  status: serverStatusEnum("status").notNull().default("stopped"),
  ramUsedMB: integer("ram_used_mb").notNull().default(0),
  cpuUsed: integer("cpu_used").notNull().default(0),
  uptime: integer("uptime").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
});

export const consoleLogsTable = pgTable("console_logs", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id")
    .notNull()
    .references(() => serversTable.id),
  message: text("message").notNull(),
  level: logLevelEnum("level").notNull().default("info"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({
  id: true,
  createdAt: true,
});
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertServerSchema = createInsertSchema(serversTable).omit({
  id: true,
  createdAt: true,
  startedAt: true,
});
export const insertLogSchema = createInsertSchema(consoleLogsTable).omit({
  id: true,
  timestamp: true,
});

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Server = typeof serversTable.$inferSelect;
export type InsertServer = z.infer<typeof insertServerSchema>;
export type ConsoleLog = typeof consoleLogsTable.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
