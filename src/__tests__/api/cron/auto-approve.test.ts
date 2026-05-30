import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/cron/auto-approve/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/approve", () => ({
  approveQuestInstance: vi.fn().mockResolvedValue(undefined),
  approveSkipQuestInstance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/treasureService", () => ({
  generateAutoApproveTreasure: vi.fn().mockResolvedValue(null),
}));

import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { generateAutoApproveTreasure } from "@/lib/treasureService";

const mockPrisma = vi.mocked(prisma);
const mockApproveQuest = vi.mocked(approveQuestInstance);
const mockApproveSkip = vi.mocked(approveSkipQuestInstance);
const mockGenerateAuto = vi.mocked(generateAutoApproveTreasure);

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request("http://localhost/api/cron/auto-approve", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});

describe("GET /api/cron/auto-approve", () => {
  it("CRON_SECRETが一致しない場合、401を返すこと", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("Authorizationヘッダーがない場合、401を返すこと", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("前日以前のREPORTEDクエストを自動承認すること", async () => {
    const yesterday = new Date("2026-03-21");
    const reportedQuests = [
      { id: "q-1", status: "REPORTED", date: yesterday, childId: "c1", templateId: "t1", template: {}, child: {} },
      { id: "q-2", status: "REPORTED", date: yesterday, childId: "c2", templateId: "t2", template: {}, child: {} },
    ];

    mockPrisma.questInstance.findMany.mockResolvedValue(reportedQuests as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockApproveQuest).toHaveBeenCalledTimes(2);
    expect(mockApproveSkip).not.toHaveBeenCalled();
    expect(body.approved).toBe(2);
    expect(body.skipped).toBe(0);
  });

  it("前日以前のSKIP_REPORTEDクエストを自動承認すること", async () => {
    const yesterday = new Date("2026-03-21");
    const quests = [
      { id: "q-3", status: "SKIP_REPORTED", date: yesterday, childId: "c1", templateId: "t1", template: {}, child: {} },
    ];

    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockApproveSkip).toHaveBeenCalledTimes(1);
    expect(mockApproveQuest).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
  });

  it("REPORTEDとSKIP_REPORTEDが混在する場合、それぞれ正しく処理すること", async () => {
    const yesterday = new Date("2026-03-21");
    const quests = [
      { id: "q-1", status: "REPORTED", date: yesterday, childId: "c1", templateId: "t1", template: {}, child: {} },
      { id: "q-2", status: "SKIP_REPORTED", date: yesterday, childId: "c1", templateId: "t2", template: {}, child: {} },
    ];

    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(mockApproveQuest).toHaveBeenCalledTimes(1);
    expect(mockApproveSkip).toHaveBeenCalledTimes(1);
    expect(body.approved).toBe(1);
    expect(body.skipped).toBe(1);
  });

  it("対象クエストがない場合、0件で200を返すこと", async () => {
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approved).toBe(0);
    expect(body.skipped).toBe(0);
  });

  it("findMany の template select に repeatDays が含まれること（approveQuestInstance の型と整合）", async () => {
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET(makeRequest("test-secret"));

    const call = mockPrisma.questInstance.findMany.mock.calls[0][0];
    expect(call?.include?.template?.select?.repeatDays).toBe(true);
  });

  describe("宝箱（AUTO）は生成しない", () => {
    // cron は AUTO 宝箱を生成しない。子セルフ報告経路で STREAK / ALL_COMPLETE が
    // 既に LOCKED で立っているため、approveQuestInstance の中の
    // unlockTreasuresOnApprove だけで体験が完結する。
    // AUTO は親代理経路 (child-view report-approve) 専用の trigger として残す。
    it("REPORTED が複数あっても generateAutoApproveTreasure は一度も呼ばれない", async () => {
      const d1 = new Date("2026-03-21");
      const d2 = new Date("2026-03-22");
      const quests = [
        { id: "q-1", status: "REPORTED", date: d1, childId: "c1", templateId: "t1", template: {}, child: { id: "c1", minTasksForStreak: 1 } },
        { id: "q-2", status: "REPORTED", date: d1, childId: "c1", templateId: "t2", template: {}, child: { id: "c1", minTasksForStreak: 1 } },
        { id: "q-3", status: "REPORTED", date: d2, childId: "c1", templateId: "t1", template: {}, child: { id: "c1", minTasksForStreak: 1 } },
        { id: "q-4", status: "REPORTED", date: d1, childId: "c2", templateId: "t1", template: {}, child: { id: "c2", minTasksForStreak: 2 } },
      ];
      mockPrisma.questInstance.findMany.mockResolvedValueOnce(quests as any);

      await GET(makeRequest("test-secret"));

      expect(mockGenerateAuto).not.toHaveBeenCalled();
    });

    it("SKIP_REPORTED でも generateAutoApproveTreasure は呼ばれない", async () => {
      const d1 = new Date("2026-03-21");
      const quests = [
        { id: "q-s1", status: "SKIP_REPORTED", date: d1, childId: "c1", templateId: "t1", template: {}, child: { id: "c1", minTasksForStreak: 1 } },
      ];
      mockPrisma.questInstance.findMany.mockResolvedValueOnce(quests as any);

      await GET(makeRequest("test-secret"));

      expect(mockGenerateAuto).not.toHaveBeenCalled();
    });

    it("対象クエストが無いときも当然呼ばれない", async () => {
      mockPrisma.questInstance.findMany.mockResolvedValueOnce([]);
      await GET(makeRequest("test-secret"));
      expect(mockGenerateAuto).not.toHaveBeenCalled();
    });

    it("レスポンスに autoTreasures フィールドを含めない（廃止）", async () => {
      const yesterday = new Date("2026-03-21");
      mockPrisma.questInstance.findMany.mockResolvedValueOnce([
        { id: "q-1", status: "REPORTED", date: yesterday, childId: "c1", templateId: "t1", template: {}, child: { id: "c1", minTasksForStreak: 1 } },
      ] as any);

      const res = await GET(makeRequest("test-secret"));
      const body = await res.json();
      expect(body).not.toHaveProperty("autoTreasures");
    });
  });
});
