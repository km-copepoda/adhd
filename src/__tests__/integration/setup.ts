import "dotenv/config";
import { vi } from "vitest";

// getCurrentUser() のみモック — テストごとに親/子を切り替えるため
// Prisma は実DBに接続するのでモックしない
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

// Supabase server client をモック（cookies() が Node では使えないため）
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
