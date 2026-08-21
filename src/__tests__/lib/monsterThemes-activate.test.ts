// Issue #111: モンスターテーマ所持記録を子供単位から家族単位へ移行。
// 対象: src/lib/monsterThemes.ts の activateFamilyTheme (未実装。実装は implementer が行う)
//
// NOTE: このファイルは `src/lib/monsterThemes.ts`（DB操作層）を対象とする。
// データ定義層の `src/lib/monsterThemes/` ディレクトリ（buddha.ts / index.ts 等）とは別物。
//
// 想定シグネチャ: activateFamilyTheme(familyId: string, themeId: string, grantReason: string, now?: Date): Promise<void>
//  - FamilyMonsterTheme テーブルへ upsert する (@@unique([familyId, themeId]) を前提)
//  - 新規有効化なら1レコード作成、既存テーマの再有効化では重複作成しない
//  - 旧 activateChildTheme(childId, ...) の家族単位版。兄弟間でテーマの所持を共有するため
//    childId ではなく familyId で upsert する。

import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateFamilyTheme } from "@/lib/monsterThemes";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";

beforeEach(() => {
  vi.clearAllMocks();
});

const FIXED_NOW = new Date("2026-08-15T03:00:00Z");

describe("activateFamilyTheme", () => {
  it("新規テーマ有効化 → upsert で1レコード作成されること", async () => {
    mockPrisma.familyMonsterTheme.upsert.mockResolvedValue({
      id: "fmt-1",
      familyId: "fam-1",
      themeId: "buddha",
      activatedAt: FIXED_NOW,
      grantReason: "purchase",
    });

    await activateFamilyTheme("fam-1", "buddha", "purchase", FIXED_NOW);

    expect(mockPrisma.familyMonsterTheme.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.familyMonsterTheme.upsert).toHaveBeenCalledWith({
      where: { familyId_themeId: { familyId: "fam-1", themeId: "buddha" } },
      create: {
        familyId: "fam-1",
        themeId: "buddha",
        activatedAt: FIXED_NOW,
        grantReason: "purchase",
      },
      update: {},
    });
  });

  it("同一family+同一themeを2回有効化 → 常に同じunique whereでupsertされ重複作成されないこと", async () => {
    mockPrisma.familyMonsterTheme.upsert.mockResolvedValue({
      id: "fmt-1",
      familyId: "fam-1",
      themeId: "buddha",
      activatedAt: FIXED_NOW,
      grantReason: "purchase",
    });

    await activateFamilyTheme("fam-1", "buddha", "purchase", FIXED_NOW);
    await activateFamilyTheme("fam-1", "buddha", "purchase", FIXED_NOW);

    expect(mockPrisma.familyMonsterTheme.upsert).toHaveBeenCalledTimes(2);
    for (const call of mockPrisma.familyMonsterTheme.upsert.mock.calls) {
      expect(call[0].where).toEqual({
        familyId_themeId: { familyId: "fam-1", themeId: "buddha" },
      });
    }
  });

  it("familyId が空文字の場合はエラーを投げること", async () => {
    await expect(activateFamilyTheme("", "buddha", "purchase")).rejects.toThrow();
  });

  it("themeId が空文字の場合はエラーを投げること", async () => {
    await expect(activateFamilyTheme("fam-1", "", "purchase")).rejects.toThrow();
  });

  it("now を省略した場合は現在時刻でレコードが作成されること", async () => {
    mockPrisma.familyMonsterTheme.upsert.mockResolvedValue({
      id: "fmt-1",
      familyId: "fam-1",
      themeId: "dark",
      activatedAt: new Date(),
      grantReason: "default",
    });

    await activateFamilyTheme("fam-1", "dark", "default");

    expect(mockPrisma.familyMonsterTheme.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          familyId: "fam-1",
          themeId: "dark",
          grantReason: "default",
          activatedAt: expect.any(Date),
        }),
      }),
    );
  });
});
