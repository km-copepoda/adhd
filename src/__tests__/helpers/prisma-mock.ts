import { prisma } from "@/lib/prisma";
import type { DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * 型付き Prisma モックへのアクセサ。
 *
 * `src/__tests__/setup.ts` が `@/lib/prisma` を `mockDeep<PrismaClient>()` で
 * モックしているため、実体は `DeepMockProxy<PrismaClient>` だが `@/lib/prisma` の
 * 型は本来の `PrismaClient` のまま（テスト対象コードと同じ import を共有するため）。
 *
 * プロジェクト内でこのキャストを許容するのはここ 1 箇所のみとする。
 * 各テストファイルは `import { prismaMock } from "@/__tests__/helpers/prisma-mock"` から
 * 利用し、`vi.mocked(prisma)` や `as any` によるキャストを個別に書かないこと。
 *
 * 各テストファイルを `vi.mocked(prisma)` からこの `prismaMock` に置き換える作業自体は
 * 本ファイルのスコープ外（移行 Issue で対応）。
 */
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
