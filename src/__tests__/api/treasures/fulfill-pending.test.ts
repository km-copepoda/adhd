import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { GET as pendingGET } from "@/app/api/treasures/pending/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, treasureLog } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

type PendingTreasureLog = Prisma.TreasureLogGetPayload<{
  include: {
    item: { select: { id: true; title: true; rarity: true } };
    child: { select: { id: true; name: true; monsterName: true } };
  };
}>;

beforeEach(() => {
  vi.clearAllMocks();
});

// 「渡したよ」フローは廃止 (2026-05-28 B 決定)。
// /api/treasures/pending は「親が把握する子供の当たり履歴」として残し、
// fulfilled フィルタは外して時系列順で返す。
describe("GET /api/treasures/pending (もらったごほうび履歴)", () => {
  it("CHILDで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await pendingGET();
    expect(res.status).toBe(403);
  });

  it("familyId なしで空配列", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items).toEqual([]);
  });

  it("OPENED + itemId 有 を fulfilled の値に関係なく取得", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const items: PendingTreasureLog[] = [
      {
        ...treasureLog({
          id: "log-1",
          openedAt: new Date("2026-03-21"),
          status: "OPENED",
          itemId: "i1",
        }),
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン" },
      },
    ];
    mockPrisma.treasureLog.findMany.mockResolvedValue(items);
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    const arg = mockPrisma.treasureLog.findMany.mock.calls[0][0];
    // 「渡したよ」廃止: fulfilled フィルタは入らない
    expect(arg?.where).not.toHaveProperty("fulfilled");
    // 当たりのみ取得（ハズレは履歴に出さない）
    expect(arg?.where).toMatchObject({
      status: "OPENED",
      itemId: { not: null },
    });
  });

  it("openedAt の新しい順で並ぶ", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    await pendingGET();
    const arg = mockPrisma.treasureLog.findMany.mock.calls[0][0];
    expect(arg?.orderBy).toMatchObject({ openedAt: "desc" });
  });

  it("最大100件まで取得（履歴は無制限に出さない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    await pendingGET();
    const arg = mockPrisma.treasureLog.findMany.mock.calls[0][0];
    expect(arg?.take).toBe(100);
  });
});

// #72: 親画面には保持期間制限を入れない（decisions.md 2026-05-29）。
// フィルタではなく、各返却行に「子画面で見えるか」の計算値 visibleToChild を付与する。
describe("GET /api/treasures/pending — visibleToChild (#72)", () => {
  const FIXED_NOW = new Date("2026-05-29T10:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function openedLog(id: string, openedAt: Date): PendingTreasureLog {
    return {
      ...treasureLog({ id, openedAt, status: "OPENED", itemId: "i1", fulfilled: false }),
      item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      child: { id: "child-1", name: "太郎", monsterName: "ドラゴン" },
    };
  }

  it("開封30日ちょうどの行は visibleToChild: true（境界値・inclusive）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      openedLog("log-30d", new Date("2026-04-29T10:00:00Z")),
    ]);
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items[0].visibleToChild).toBe(true);
  });

  it("開封30日+1msの行は visibleToChild: false（境界値）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      openedLog("log-old", new Date("2026-04-29T09:59:59.999Z")),
    ]);
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items[0].visibleToChild).toBe(false);
  });

  it("where に openedAt フィルタを足さず take:100 / 新しい順を維持（回帰）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    await pendingGET();
    const arg = mockPrisma.treasureLog.findMany.mock.calls[0][0];
    expect(arg?.where).not.toHaveProperty("openedAt");
    expect(arg?.take).toBe(100);
    expect(arg?.orderBy).toMatchObject({ openedAt: "desc" });
  });

  it("fulfilled の値はそのまま返しつつ visibleToChild も付く（回帰）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      { ...openedLog("log-a", new Date("2026-05-28T10:00:00Z")), fulfilled: true },
    ]);
    const res = await pendingGET();
    const json = await res.json();
    expect(json.items[0].fulfilled).toBe(true);
    expect(json.items[0].visibleToChild).toBe(true);
  });
});
