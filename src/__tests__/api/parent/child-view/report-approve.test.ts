import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/parent/child-view/quests/[id]/report-approve/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import * as approveModule from "@/lib/approve";
import { parentUser, childUser } from "../../../helpers/fixtures";
import { makeParams } from "../../../helpers/request";

vi.mock("@/lib/approve", () => ({
  approveQuestInstance: vi.fn(),
  approveSkipQuestInstance: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockApprove = vi.mocked(approveModule.approveQuestInstance);

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/parent/child-view/quests/q1/report-approve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-12T09:00:00Z")); // JST 18:00
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/parent/child-view/quests/[id]/report-approve", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールの場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定の場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeReq({}), makeParams("q1"));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-other" }), makeParams("q1"));
    expect(res.status).toBe(404);
  });

  it("クエストが見つからない場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(404);
  });

  it("クエストが指定の子供のものでない場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-OTHER",
      status: "PENDING",
      template: { category: "STUDY", photoBonus: false },
    } as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(404);
  });

  it("PENDING 状態のクエストは PENDING→REPORTED 経由せず一気に APPROVED まで進める", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: null }) as any,
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "PENDING",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeReq({ childId: "child-1", comment: "代理報告", stamp: "🎉" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);

    // REPORTED 経由ではなく、まず report フィールドだけ更新してから approveQuestInstance を呼ぶ
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({
        comment: "代理報告",
        reportedAt: expect.any(Date),
      }),
    });
    // approveQuestInstance がスタンプ込みで呼ばれる
    expect(mockApprove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1", childId: "child-1" }),
      "🎉",
    );
  });

  it("既に APPROVED 済みのクエストは 400 を返す（二重承認防止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "APPROVED",
      template: { category: "STUDY", photoBonus: false },
    } as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("SKIPPED 済みのクエストは 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "SKIPPED",
      template: { category: "STUDY", photoBonus: false },
    } as any);
    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(400);
  });

  it("REJECTED 状態（差し戻し後）の再報告も APPROVED にできる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "REJECTED",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeReq({ childId: "child-1", comment: "やり直し" }),
      makeParams("q1"),
    );
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalled();
  });

  it("PENDING 初回: 期限内なら deadlineBonusEarned=true で update される", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: "20:00" }) as any,
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "PENDING",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    // 2026-03-12T09:00:00Z = JST 18:00（20:00 より前なので期限内）
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({ deadlineBonusEarned: true }),
    });
  });

  it("REJECTED 再報告: deadlineBonusEarned は変更しない（既存値保持）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: "20:00" }) as any,
    );
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "REJECTED",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(makeReq({ childId: "child-1" }), makeParams("q1"));

    const updateCall = mockPrisma.questInstance.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("deadlineBonusEarned");
  });

  it("REPORTED 状態（子供が既に報告済み）も APPROVED にできる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      status: "REPORTED",
      date: new Date("2026-03-12T00:00:00Z"),
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: "STUDY",
      template: { id: "tpl-1", category: "STUDY", photoBonus: false },
      child: { id: "child-1" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(makeReq({ childId: "child-1" }), makeParams("q1"));
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalled();
  });
});
