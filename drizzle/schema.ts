import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Insights — the core entity. Each insight is a piece of thinking.
 */
export const insights = mysqlTable("insights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"), // markdown content
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  category: varchar("category", { length: 200 }),
  positionX: int("positionX"), // canvas position
  positionY: int("positionY"), // canvas position
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Insight = typeof insights.$inferSelect;
export type InsertInsight = typeof insights.$inferInsert;

/**
 * Tags — flexible labeling system for insights.
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Insight-Tag junction table.
 */
export const insightTags = mysqlTable("insightTags", {
  id: int("id").autoincrement().primaryKey(),
  insightId: int("insightId").notNull(),
  tagId: int("tagId").notNull(),
}, (table) => [
  uniqueIndex("insightTag_unique").on(table.insightId, table.tagId),
]);

export type InsightTag = typeof insightTags.$inferSelect;

/**
 * Connections — relationships between insights on the canvas.
 */
export const connections = mysqlTable("connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceInsightId: int("sourceInsightId").notNull(),
  targetInsightId: int("targetInsightId").notNull(),
  label: varchar("label", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = typeof connections.$inferInsert;

/**
 * Insight history — version snapshots for tracking evolution.
 */
export const insightHistory = mysqlTable("insightHistory", {
  id: int("id").autoincrement().primaryKey(),
  insightId: int("insightId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  status: varchar("status", { length: 20 }).notNull(),
  category: varchar("category", { length: 200 }),
  tagsSnapshot: json("tagsSnapshot"), // snapshot of tag names at that point
  changeNote: varchar("changeNote", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsightHistoryEntry = typeof insightHistory.$inferSelect;
