import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { GET } from "@/app/api/cron/auto-approve/route";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { questInstance } from "../../helpers/fixtures";

vi.mock("@/lib/approve", () => ({
  approveQuestInstance: vi.fn().mockResolvedValue(undefined),
  approveSkipQuestInstance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/treasureService", () => ({
  generateProxyTreasure: vi.fn().mockResolvedValue(null),
}));

import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { generateProxyTreasure } from "@/lib/treasureService";

const mockApproveQuest = vi.mocked(approveQuestInstance);
const mockApproveSkip = vi.mocked(approveSkipQuestInstance);
const mockGenerateAuto = vi.mocked(generateProxyTreasure);

/**
 * route.ts の findMany が使う include（template/child とも select 付き）に合わせた型。
 * approveQuestInstance の引数型 `QuestWithRelations`（@/lib/approve）と一致する形状。
 */
type PendingQuest = Prisma.QuestInstanceGetPayload<{
  include: {
    template: {
      select: {
        id: true;
        category: true;
        createdBy: true;
        isTemporary: true;
        photoBonus: true;
        repeatDays: true;
        carryOver: true;
      };
    };
    child: {
      select: {
        id: true;
        evolutionStage: true;
        evolutionPath: true;
        collectedPaths: true;
        studyPt: true;
        staminaPt: true;
        lifePt: true;
      };
    };
  };
}>;

function pendingQuest(overrides: {
  id: string;
  status: "REPORTED" | "SKIP_REPORTED";
  date: Date;
  childId: string;
  templateId: string;
}): PendingQuest {
  return {
    ...questInstance({
      id: overrides.id,
      status: overrides.status,
      date: overrides.date,
      childId: overrides.childId,
      templateId: overrides.templateId,
    }),
    template: {
      id: overrides.templateId,
      category: "STUDY",
      createdBy: "PARENT",
      isTemporary: false,
      photoBonus: false,
      repeatDays: [1, 2, 3, 4, 5],
      carryOver: false,
    },
    child: {
      id: overrides.childId,
      evolutionStage: 0,
      evolutionPath: "",
      collectedPaths: "[]",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
    },
  };
}

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
    const reportedQuests: PendingQuest[] = [
      pendingQuest({ id: "q-1", status: "REPORTED", date: yesterday, childId: "c1", templateId: "t1" }),
      pendingQuest({ id: "q-2", status: "REPORTED", date: yesterday, childId: "c2", templateId: "t2" }),
    ];

    mockPrisma.questInstance.findMany.mockResolvedValue(reportedQuests);

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
    const quests: PendingQuest[] = [
      pendingQuest({ id: "q-3", status: "SKIP_REPORTED", date: yesterday, childId: "c1", templateId: "t1" }),
    ];

    mockPrisma.questInstance.findMany.mockResolvedValue(quests);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockApproveSkip).toHaveBeenCalledTimes(1);
    expect(mockApproveQuest).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
  });

  it("REPORTEDとSKIP_REPORTEDが混在する場合、それぞれ正しく処理すること", async () => {
    const yesterday = new Date("2026-03-21");
    const quests: PendingQuest[] = [
      pendingQuest({ id: "q-1", status: "REPORTED", date: yesterday, childId: "c1", templateId: "t1" }),
      pendingQuest({ id: "q-2", status: "SKIP_REPORTED", date: yesterday, childId: "c1", templateId: "t2" }),
    ];

    mockPrisma.questInstance.findMany.mockResolvedValue(quests);

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
    const templateInclude = call?.include?.template;
    // include.template は `true | TaskTemplateArgs` の union 型になるため、
    // select 付きの object 形であることを確認してから絞り込む。
    const templateSelect = typeof templateInclude === "object" ? templateInclude?.select : undefined;
    expect(templateSelect?.repeatDays).toBe(true);
  });

  describe("宝箱（PROXY）は生成しない", () => {
    // cron は宝箱を生成しない。子セルフ報告経路で STREAK / ALL_COMPLETE が
    // 既に LOCKED で立っているため、approveQuestInstance の中の
    // unlockTreasuresOnApprove だけで体験が完結する。
    // PROXY trigger は親代理経路 (child-view report-approve) 専用として残す。
    it("REPORTED が複数あっても generateProxyTreasure は一度も呼ばれない", async () => {
      const d1 = new Date("2026-03-21");
      const d2 = new Date("2026-03-22");
      const quests: PendingQuest[] = [
        pendingQuest({ id: "q-1", status: "REPORTED", date: d1, childId: "c1", templateId: "t1" }),
        pendingQuest({ id: "q-2", status: "REPORTED", date: d1, childId: "c1", templateId: "t2" }),
        pendingQuest({ id: "q-3", status: "REPORTED", date: d2, childId: "c1", templateId: "t1" }),
        pendingQuest({ id: "q-4", status: "REPORTED", date: d1, childId: "c2", templateId: "t1" }),
      ];
      mockPrisma.questInstance.findMany.mockResolvedValueOnce(quests);

      await GET(makeRequest("test-secret"));

      expect(mockGenerateAuto).not.toHaveBeenCalled();
    });

    it("SKIP_REPORTED でも generateProxyTreasure は呼ばれない", async () => {
      const d1 = new Date("2026-03-21");
      const quests: PendingQuest[] = [
        pendingQuest({ id: "q-s1", status: "SKIP_REPORTED", date: d1, childId: "c1", templateId: "t1" }),
      ];
      mockPrisma.questInstance.findMany.mockResolvedValueOnce(quests);

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
        pendingQuest({ id: "q-1", status: "REPORTED", date: yesterday, childId: "c1", templateId: "t1" }),
      ]);

      const res = await GET(makeRequest("test-secret"));
      const body = await res.json();
      expect(body).not.toHaveProperty("autoTreasures");
    });
  });
});
