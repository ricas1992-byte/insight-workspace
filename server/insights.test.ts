import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createInsight: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    title: "Test Insight",
    content: "Test content",
    status: "draft",
    category: null,
    positionX: null,
    positionY: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getInsightById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    title: "Test Insight",
    content: "Test content",
    status: "draft",
    category: null,
    positionX: null,
    positionY: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateInsight: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    title: "Updated Insight",
    content: "Updated content",
    status: "active",
    category: null,
    positionX: null,
    positionY: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteInsight: vi.fn().mockResolvedValue(undefined),
  listInsights: vi.fn().mockResolvedValue([]),
  getInsightCategories: vi.fn().mockResolvedValue(["category1"]),
  createTag: vi.fn().mockResolvedValue({ id: 1, userId: 1, name: "test", color: "#6366f1", createdAt: new Date() }),
  listTags: vi.fn().mockResolvedValue([]),
  deleteTag: vi.fn().mockResolvedValue(undefined),
  getInsightTags: vi.fn().mockResolvedValue([]),
  setInsightTags: vi.fn().mockResolvedValue(undefined),
  createConnection: vi.fn().mockResolvedValue({ id: 1, userId: 1, sourceInsightId: 1, targetInsightId: 2, label: null, createdAt: new Date() }),
  listConnections: vi.fn().mockResolvedValue([]),
  deleteConnection: vi.fn().mockResolvedValue(undefined),
  updateConnection: vi.fn().mockResolvedValue({ id: 1, userId: 1, sourceInsightId: 1, targetInsightId: 2, label: "updated", createdAt: new Date() }),
  createHistorySnapshot: vi.fn().mockResolvedValue(undefined),
  getInsightHistory: vi.fn().mockResolvedValue([]),
  getInsightsWithTags: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("insights router", () => {
  it("creates an insight", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.create({
      title: "Test Insight",
      content: "Test content",
      status: "draft",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.title).toBe("Test Insight");
  });

  it("lists insights for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("gets a single insight", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.get({ id: 1 });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("updates an insight", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.update({
      id: 1,
      title: "Updated Insight",
      status: "active",
    });
    expect(result).toBeDefined();
    expect(result.title).toBe("Updated Insight");
  });

  it("deletes an insight", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("rejects unauthenticated access", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.insights.list()).rejects.toThrow();
  });
});

describe("tags router", () => {
  it("creates a tag", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tags.create({ name: "test", color: "#6366f1" });
    expect(result).toBeDefined();
    expect(result.name).toBe("test");
  });

  it("lists tags", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tags.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deletes a tag", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tags.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("connections router", () => {
  it("creates a connection", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.connections.create({
      sourceInsightId: 1,
      targetInsightId: 2,
    });
    expect(result).toBeDefined();
    expect(result.sourceInsightId).toBe(1);
    expect(result.targetInsightId).toBe(2);
  });

  it("lists connections", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.connections.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deletes a connection", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.connections.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("insights.categories", () => {
  it("returns categories", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.categories();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("insights.history", () => {
  it("returns history for an insight", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.history({ insightId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});
