// Issue #73: モンスターテーマセット Stage1 — テーマ有効化記録の DB 操作層テスト。
// 対象: src/lib/monsterThemes.ts の activateChildTheme (未実装。実装は implementer が行う)
//
// NOTE: このファイルは `src/lib/monsterThemes.ts`（DB操作層、新規ファイル）を対象とする。
// データ定義層の `src/lib/monsterThemes/` ディレクトリ（buddha.ts / index.ts 等）とは別物。
//
// 想定シグネチャ: activateChildTheme(childId: string, themeId: string, grantReason: string, now?: Date): Promise<void>
//  - ChildMonsterTheme テーブルへ upsert する (@@unique([childId, themeId]) を前提)
//  - 新規有効化なら1レコード作成、既存テーマの再有効化では重複作成しない

import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateChildTheme } from "@/lib/monsterThemes";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";

beforeEach(() => {
  vi.clearAllMocks();
});

const FIXED_NOW = new Date("2026-08-15T03:00:00Z");

describe("activateChildTheme", () => {
  it("新規テーマ有効化 → upsert で1レコード作成されること", async () => {
    mockPrisma.childMonsterTheme.upsert.mockResolvedValue({
      id: "cmt-1",
      childId: "child-1",
      themeId: "buddha",
      activatedAt: FIXED_NOW,
      grantReason: "purchase",
    });

    await activateChildTheme("child-1", "buddha", "purchase", FIXED_NOW);

    expect(mockPrisma.childMonsterTheme.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.childMonsterTheme.upsert).toHaveBeenCalledWith({
      where: { childId_themeId: { childId: "child-1", themeId: "buddha" } },
      create: {
        childId: "child-1",
        themeId: "buddha",
        activatedAt: FIXED_NOW,
        grantReason: "purchase",
      },
      update: {},
    });
  });

  it("既存テーマの再有効化 → 同じ unique where で upsert が呼ばれ、重複作成が起きない設計であること", async () => {
    mockPrisma.childMonsterTheme.upsert.mockResolvedValue({
      id: "cmt-1",
      childId: "child-1",
      themeId: "buddha",
      activatedAt: FIXED_NOW,
      grantReason: "purchase",
    });

    await activateChildTheme("child-1", "buddha", "purchase", FIXED_NOW);
    await activateChildTheme("child-1", "buddha", "purchase", FIXED_NOW);

    expect(mockPrisma.childMonsterTheme.upsert).toHaveBeenCalledTimes(2);
    for (const call of mockPrisma.childMonsterTheme.upsert.mock.calls) {
      expect(call[0].where).toEqual({
        childId_themeId: { childId: "child-1", themeId: "buddha" },
      });
    }
  });

  it("childId が空文字の場合はエラーを投げること", async () => {
    await expect(activateChildTheme("", "buddha", "purchase")).rejects.toThrow();
  });

  it("themeId が空文字の場合はエラーを投げること", async () => {
    await expect(activateChildTheme("child-1", "", "purchase")).rejects.toThrow();
  });

  it("now を省略した場合は現在時刻でレコードが作成されること", async () => {
    mockPrisma.childMonsterTheme.upsert.mockResolvedValue({
      id: "cmt-1",
      childId: "child-1",
      themeId: "dark",
      activatedAt: new Date(),
      grantReason: "default",
    });

    await activateChildTheme("child-1", "dark", "default");

    expect(mockPrisma.childMonsterTheme.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          childId: "child-1",
          themeId: "dark",
          grantReason: "default",
          activatedAt: expect.any(Date),
        }),
      }),
    );
  });
});
