import { describe, it, expect, vi, beforeEach } from "vitest";
import { after } from "next/server";
import { POST } from "@/app/api/parent/child-view/rebirth/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { triggerMonsterRebornLog } from "@/lib/bulletinLog";
import { parentUser, childUser } from "../../../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerMonsterRebornLog: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);
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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("別 family の childId で 404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-other" }));
    expect(res.status).toBe(404);
  });

  it("rebirthPending=false の子供では 400 を返す（転生待ちでない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: false }) as any,
    );
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("正常系: 卵ボーナス無し（NORMAL 卵）でステージ・ポイントをリセットする", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        rebirthPending: true,
        usedEggBonuses: "[]",
        evolutionStage: 3,
        studyPt: 10,
        staminaPt: 5,
        lifePt: 5,
      }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        rebirthPending: true,
        usedEggBonuses: '["STUDY"]',
      }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }));

    const call = mockPrisma.user.update.mock.calls[0][0];
    // 既存の usedEggBonuses は変更しない（NORMAL 卵は使用済み記録不要）
    expect(call.data.usedEggBonuses ?? '["STUDY"]').toBe('["STUDY"]');
  });

  it("after() で MonsterReborn 掲示板ログをスケジュールする", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }));

    expect(mockAfter).toHaveBeenCalled();
    expect(mockTriggerRebornLog).toHaveBeenCalledWith("child-1", expect.any(String));
  });
});
