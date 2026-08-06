import { vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    family: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    taskTemplate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      // マネタイズ上限チェックでカウントが必要。デフォルトは 0 (制限に到達していない状態)。
      count: vi.fn().mockResolvedValue(0),
    },
    questInstance: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    streak: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    taskStreak: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    pushSubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    userBadge: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    gatheringGroup: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    gatheringMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    bulletinLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    stamp: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    questDeclaration: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    treasureItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    treasureLog: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    userCollectionItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    checkinLog: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock getCurrentUser (individual tests can override)
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

// Mock push notifications (web-push is not available in test environment)
vi.mock("@/lib/push", () => ({
  sendPushToParent: vi.fn(),
  sendPushToChild: vi.fn(),
}));

// next/server.after は Vercel ランタイムでレスポンス送信後にコールバックを実行する。
// テスト環境では request scope が無いと throw するため、コールバックを即時呼ぶモックに置き換える。
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: vi.fn((fn: () => unknown) => fn()),
  };
});
