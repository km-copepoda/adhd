import { describe, it, expect, vi, beforeEach } from "vitest";
import { after } from "next/server";
import { POST } from "@/app/api/quests/[id]/skip/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { generateTreasuresOnReport } from "@/lib/treasureService";
import { makeParams } from "../../helpers/request";
import { childUser, questInstance } from "../../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerTaskProgressLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/treasureService", () => ({
  generateTreasuresOnReport: vi.fn().mockResolvedValue([]),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockTriggerTaskProgressLog = vi.mocked(triggerTaskProgressLog);
const mockAfter = vi.mocked(after);
const mockGenerateTreasures = vi.mocked(generateTreasuresOnReport);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.questInstance.findMany.mockResolvedValue([]);
  mockGenerateTreasures.mockResolvedValue([]);
});

function makeSkipRequest(body: { comment?: string } = { comment: "体調が悪い" }) {
  return new Request("http://localhost/api/quests/q1/skip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/quests/[id]/skip", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeSkipRequest(), makeParams("q1"));
    expect(res.status).toBe(401);
  });

  it("存在しないクエストで404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);

    const res = await POST(makeSkipRequest(), makeParams("q-none"));
    expect(res.status).toBe(404);
  });

  it("コメントなしの場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeSkipRequest({ comment: "" }), makeParams("q1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.questInstance.update).not.toHaveBeenCalled();
  });

  it("コメントがない（bodyなし）場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const req = new Request("http://localhost/api/quests/q1/skip", { method: "POST" });
    const res = await POST(req, makeParams("q1"));
    expect(res.status).toBe(400);
  });

  it("PENDINGのクエストをSKIP_REPORTEDに更新しコメントを保存すること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questInstance({ id: "q1", status: "PENDING" }) as any,
    );
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(makeSkipRequest({ comment: "体調が悪い" }), makeParams("q1"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { status: "SKIP_REPORTED", comment: "体調が悪い", reportedAt: expect.any(Date) },
    });
  });

  it("PENDING以外のクエストは400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questInstance({ id: "q2", status: "REPORTED" }) as any,
    );

    const res = await POST(makeSkipRequest(), makeParams("q2"));
    expect(res.status).toBe(400);
    expect(mockPrisma.questInstance.update).not.toHaveBeenCalled();
  });

  it("APPROVEDのクエストもスキップできないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questInstance({ id: "q3", status: "APPROVED" }) as any,
    );

    const res = await POST(makeSkipRequest(), makeParams("q3"));
    expect(res.status).toBe(400);
  });

  it("スキップ成功時に進捗マイルストーンの掲示板ログをトリガーすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questInstance({ id: "q1", status: "PENDING" }) as any,
    );
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(makeSkipRequest({ comment: "気分が乗らない" }), makeParams("q1"));
    expect(res.status).toBe(200);
    expect(mockTriggerTaskProgressLog).toHaveBeenCalledWith("child-1");
  });

  it("PENDING以外でスキップ拒否した場合は進捗ログをトリガーしないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questInstance({ id: "q2", status: "REPORTED" }) as any,
    );

    await POST(makeSkipRequest(), makeParams("q2"));
    expect(mockTriggerTaskProgressLog).not.toHaveBeenCalled();
  });

  it("掲示板ログは next/server の after() 経由でスケジュールされる（fire-and-forget だとサーバレスで取りこぼされる）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(
      questInstance({ id: "q1", status: "PENDING" }) as any,
    );
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(makeSkipRequest({ comment: "ねむい" }), makeParams("q1"));

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockTriggerTaskProgressLog).toHaveBeenCalledWith("child-1");
  });
});
