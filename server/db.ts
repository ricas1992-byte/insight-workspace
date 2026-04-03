import { and, desc, eq, like, or, sql, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  insights, InsertInsight, Insight,
  tags, InsertTag,
  insightTags,
  connections, InsertConnection,
  insightHistory,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ───────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Insight helpers ────────────────────────────────────────────────
export async function createInsight(data: InsertInsight) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(insights).values(data);
  const id = result[0].insertId;
  return (await db.select().from(insights).where(eq(insights.id, id)))[0];
}

export async function getInsightById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(insights).where(and(eq(insights.id, id), eq(insights.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function updateInsight(id: number, userId: number, data: Partial<InsertInsight>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(insights).set(data).where(and(eq(insights.id, id), eq(insights.userId, userId)));
  return (await db.select().from(insights).where(eq(insights.id, id)))[0];
}

export async function deleteInsight(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related data first
  await db.delete(insightTags).where(eq(insightTags.insightId, id));
  await db.delete(connections).where(or(eq(connections.sourceInsightId, id), eq(connections.targetInsightId, id)));
  await db.delete(insightHistory).where(eq(insightHistory.insightId, id));
  await db.delete(insights).where(and(eq(insights.id, id), eq(insights.userId, userId)));
}

export async function listInsights(userId: number, filters?: {
  status?: string;
  search?: string;
  category?: string;
  tagIds?: number[];
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(insights.userId, userId)];

  if (filters?.status) conditions.push(eq(insights.status, filters.status as any));
  if (filters?.category) conditions.push(eq(insights.category, filters.category));
  if (filters?.search) {
    conditions.push(
      or(
        like(insights.title, `%${filters.search}%`),
        like(insights.content, `%${filters.search}%`)
      )!
    );
  }
  if (filters?.dateFrom) conditions.push(gte(insights.createdAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(insights.createdAt, filters.dateTo));

  let result = await db.select().from(insights).where(and(...conditions)).orderBy(desc(insights.updatedAt));

  // Filter by tags if specified
  if (filters?.tagIds && filters.tagIds.length > 0) {
    const taggedInsightIds = await db.select({ insightId: insightTags.insightId })
      .from(insightTags)
      .where(inArray(insightTags.tagId, filters.tagIds));
    const idSet = new Set(taggedInsightIds.map(r => r.insightId));
    result = result.filter(i => idSet.has(i.id));
  }

  return result;
}

export async function getInsightCategories(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.selectDistinct({ category: insights.category }).from(insights).where(and(eq(insights.userId, userId), sql`${insights.category} IS NOT NULL`));
  return result.map(r => r.category).filter(Boolean) as string[];
}

// ─── Tag helpers ────────────────────────────────────────────────────
export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tags).values(data);
  return (await db.select().from(tags).where(eq(tags.id, result[0].insertId)))[0];
}

export async function listTags(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(tags).where(eq(tags.userId, userId));
}

export async function deleteTag(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(insightTags).where(eq(insightTags.tagId, id));
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
}

export async function getInsightTags(insightId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ tag: tags })
    .from(insightTags)
    .innerJoin(tags, eq(insightTags.tagId, tags.id))
    .where(eq(insightTags.insightId, insightId));
  return result.map(r => r.tag);
}

export async function setInsightTags(insightId: number, tagIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(insightTags).where(eq(insightTags.insightId, insightId));
  if (tagIds.length > 0) {
    await db.insert(insightTags).values(tagIds.map(tagId => ({ insightId, tagId })));
  }
}

// ─── Connection helpers ─────────────────────────────────────────────
export async function createConnection(data: InsertConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(connections).values(data);
  return (await db.select().from(connections).where(eq(connections.id, result[0].insertId)))[0];
}

export async function listConnections(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(connections).where(eq(connections.userId, userId));
}

export async function deleteConnection(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(connections).where(and(eq(connections.id, id), eq(connections.userId, userId)));
}

export async function updateConnection(id: number, userId: number, data: Partial<InsertConnection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(connections).set(data).where(and(eq(connections.id, id), eq(connections.userId, userId)));
  return (await db.select().from(connections).where(eq(connections.id, id)))[0];
}

// ─── History helpers ────────────────────────────────────────────────
export async function createHistorySnapshot(insightId: number, changeNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const insight = (await db.select().from(insights).where(eq(insights.id, insightId)))[0];
  if (!insight) return null;
  const itags = await getInsightTags(insightId);
  const tagNames = itags.map(t => t.name);
  await db.insert(insightHistory).values({
    insightId,
    title: insight.title,
    content: insight.content,
    status: insight.status,
    category: insight.category,
    tagsSnapshot: tagNames,
    changeNote: changeNote ?? null,
  });
}

export async function getInsightHistory(insightId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(insightHistory).where(eq(insightHistory.insightId, insightId)).orderBy(desc(insightHistory.createdAt));
}

// ─── Bulk helpers ───────────────────────────────────────────────────
export async function getInsightsWithTags(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const allInsights = await db.select().from(insights).where(eq(insights.userId, userId));
  const allInsightTags = await db.select().from(insightTags);
  const allTags = await db.select().from(tags).where(eq(tags.userId, userId));
  const tagMap = new Map(allTags.map(t => [t.id, t]));
  return allInsights.map(insight => ({
    ...insight,
    tags: allInsightTags.filter(it => it.insightId === insight.id).map(it => tagMap.get(it.tagId)).filter(Boolean),
  }));
}
