import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/cron/auto-approve/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/approve", () => ({
  approveQuestInstance: vi.fn().mockResolvedValue(undefined),
  approveSkipQuestInstance: vi.fn().mockResolvedValue(undefined),
}));

import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";

const mockPrisma = vi.mocked(prisma);
const mockApproveQuest = vi.mocked(approveQuestInstance);
const mockApproveSkip = vi.mocked(approveSkipQuestInstance);

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
});
