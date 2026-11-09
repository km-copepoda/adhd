import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/cron/auto-approve/route";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";

vi.mock("@/lib/approve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approve")>();
  return {
    ...actual,
    approveQuestInstance: vi.fn().mockResolvedValue(undefined),
    approveSkipQuestInstance: vi.fn().mockResolvedValue(undefined),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});

describe("GET /api/cron/auto-approve: 取得順（#188）", () => {
  it("findMany が date 昇順（古い日付から）で呼ばれる", async () => {
    mockPrisma.questInstance.findMany.mockResolvedValue([]);
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });

    await GET(
      new Request("http://localhost/api/cron/auto-approve", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: "asc" } }),
    );
  });
});
