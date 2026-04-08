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
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    questInstance: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
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
