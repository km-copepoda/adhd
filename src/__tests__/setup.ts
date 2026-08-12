import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import type { DeepMockProxy } from "vitest-mock-extended";

// Mock Prisma
//
// vi.mock はファイル内の他のコードよりも先頭に巻き上げられる（hoisting）ため、
// mockDeep() はこのファクトリ関数の中で呼ぶ必要がある。
// 外側で定義した変数をここから参照すると
// "Cannot access '...' before initialization" になる。
vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// vi.mock 済みの "@/lib/prisma" から prisma を取得する。
// これは上の mockDeep() が返したインスタンスと同一の参照になる。
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

/**
 * 旧 setup.ts（手書きモック）が持っていたデフォルト値を再現する。
 *
 * mockDeep は未設定のメソッド呼び出しに対して常に undefined を返すため、
 * 呼び出し元が配列・数値を前提にしている箇所（.map / 上限チェックの比較等）では
 * ここで明示的にデフォルト値を設定しないとランタイムエラーになる。
 *
 * 対象は旧 setup.ts で `.mockResolvedValue(...)` / `.mockImplementation(...)` が
 * 設定されていたメソッドのみ。それ以外は元々 undefined 相当だったため据え置く。
 */
function applyPrismaDefaults(): void {
  // src/app/api/auth/child-rejoin/route.ts, src/app/api/family/members/[id]/route.ts が
  // 配列形式（Prisma.PrismaPromise[]）の $transaction のみを利用している。
  // コールバック形式は現状使われていない。
  const transactionMock = prismaMock.$transaction as unknown as {
    mockImplementation: (fn: (ops: unknown[]) => Promise<unknown[]>) => void;
  };
  transactionMock.mockImplementation((ops) => Promise.all(ops));

  // マネタイズ上限チェックで利用するカウント系。デフォルトは 0（上限未到達の状態）。
  prismaMock.user.count.mockResolvedValue(0);
  prismaMock.taskTemplate.count.mockResolvedValue(0);
  prismaMock.treasureItem.count.mockResolvedValue(0);

  // 一覧取得系。デフォルトは空配列（呼び出し元の .map 等で落ちないように）。
  // groupBy はジェネリクスが複雑で mockResolvedValue の型検査が通らないため、
  // $transaction と同様にモック関数として明示的にキャストする。
  const groupByMock = prismaMock.questInstance.groupBy as unknown as {
    mockResolvedValue: (value: unknown[]) => void;
  };
  groupByMock.mockResolvedValue([]);
  prismaMock.questDeclaration.findMany.mockResolvedValue([]);
  prismaMock.treasureItem.findMany.mockResolvedValue([]);
  prismaMock.treasureLog.findMany.mockResolvedValue([]);
  prismaMock.userCollectionItem.findMany.mockResolvedValue([]);
  prismaMock.checkinLog.findMany.mockResolvedValue([]);
}

applyPrismaDefaults();

// vi.resetAllMocks() / vi.restoreAllMocks() はモック実装そのものを消してしまうため、
// 上記デフォルトも失われる。47 箇所のテストファイルが vi.resetAllMocks() を
// beforeEach 等で呼んでおり、その実行タイミングはテストファイルごとに異なる。
//
// グローバル beforeEach で再適用しようとすると、setupFiles で登録した
// beforeEach は各テストファイル自身の beforeEach より「先に」実行されるため、
// テスト側の resetAllMocks() の方が後に走ってしまい効果がない。
// そのため vi.resetAllMocks / vi.restoreAllMocks 自体をラップし、
// 呼び出された直後（フックの登録順序に関わらず）にデフォルトを再適用する。
const originalResetAllMocks = vi.resetAllMocks.bind(vi);
vi.resetAllMocks = ((): typeof vi => {
  originalResetAllMocks();
  applyPrismaDefaults();
  return vi;
}) as typeof vi.resetAllMocks;

const originalRestoreAllMocks = vi.restoreAllMocks.bind(vi);
vi.restoreAllMocks = ((): typeof vi => {
  originalRestoreAllMocks();
  applyPrismaDefaults();
  return vi;
}) as typeof vi.restoreAllMocks;

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
