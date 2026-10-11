import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/subscription/limits/route";
import { getCurrentUser } from "@/lib/auth";
import { LIMITS } from "@/lib/subscription";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, subscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeGetRequest() {
  return new NextRequest("http://localhost/api/subscription/limits");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/subscription/limits — 認証・ロール", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("CHILDロールは403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/subscription/limits — 実効プランに応じた上限値", () => {
  it("FREE は child:1 / task:10 / treasure_item:5", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ child: 1, task: 10, treasure_item: 5 });
  });

  it("PREMIUM (有効) は全て null (無制限)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-01-01") }),
    );

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json).toEqual({ child: null, task: null, treasure_item: null });
  });

  it("PREMIUM 期限切れは実効 FREE の上限を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2000-01-01") }),
    );

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json).toEqual({ child: 1, task: 10, treasure_item: 5 });
  });

  it("familyId が無い (単独モード) は FREE 固定で、user.findFirst を呼ばない", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json).toEqual({ child: 1, task: 10, treasure_item: 5 });
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/subscription/limits — グローバル LIMITS の非破壊", () => {
  it("レスポンスの JSON を書き換えても @/lib/subscription の LIMITS は変わらない", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    // 呼び出し側が受け取った値を書き換える
    (json as { task: number | null }).task = 99999;

    expect(LIMITS.FREE.task).toBe(10);

    // 2回目の呼び出しでも汚染されていないこと
    const res2 = await GET(makeGetRequest());
    const json2 = await res2.json();
    expect(json2.task).toBe(10);
  });
});

describe("GET /api/subscription/limits — DB障害", () => {
  it("DB 障害時は 500 JSON を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
  });
});
