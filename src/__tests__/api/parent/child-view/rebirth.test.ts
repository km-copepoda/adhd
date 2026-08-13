import { describe, it, expect, vi, beforeEach } from "vitest";
import { after } from "next/server";
import { POST } from "@/app/api/parent/child-view/rebirth/route";
import { getCurrentUser } from "@/lib/auth";
import { triggerMonsterRebornLog } from "@/lib/bulletinLog";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerMonsterRebornLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockAfter = vi.mocked(after);
const mockTriggerRebornLog = vi.mocked(triggerMonsterRebornLog);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/parent/child-view/rebirth", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/parent/child-view/rebirth", () => {
  it("未認証の場合 401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールでは 403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("別 family の childId で 404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-other" }));
    expect(res.status).toBe(404);
  });

  it("rebirthPending=false の子供では 400 を返す（転生待ちでない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: false }),
    );
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("正常系: 卵ボーナス無し（NORMAL 卵）でステージ・ポイントをリセットする", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        rebirthPending: true,
        usedEggBonuses: "[]",
        evolutionStage: 3,
        studyPt: 10,
        staminaPt: 5,
        lifePt: 5,
      }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "child-1", rebirthPending: true },
      data: expect.objectContaining({
        rebirthPending: false,
        rebirthEggBonus: null, // NORMAL 卵はボーナス無し
        evolutionStage: 0,
        evolutionPath: "",
        studyPt: 0,
        staminaPt: 0,
        lifePt: 0,
      }),
    });
  });

  it("usedEggBonuses は触らない（NORMAL なので使用済みに記録しない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        rebirthPending: true,
        usedEggBonuses: '["STUDY"]',
      }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeReq({ childId: "child-1" }));

    const call = mockPrisma.user.updateMany.mock.calls[0][0];
    // 既存の usedEggBonuses は変更しない（NORMAL 卵は使用済み記録不要）
    expect(call.data.usedEggBonuses ?? '["STUDY"]').toBe('["STUDY"]');
  });

  it("rebirthPending=trueで読み込んだ後、update時には他経路で既に転生済み(count=0)の場合は400を返す（TOCTOUレース）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    // 子供本人が同時に転生実行済みのケースを模擬
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("after() で MonsterReborn 掲示板ログをスケジュールする", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeReq({ childId: "child-1" }));

    expect(mockAfter).toHaveBeenCalled();
    expect(mockTriggerRebornLog).toHaveBeenCalledWith("child-1", expect.any(String));
  });
});
