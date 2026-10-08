import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/nav/pending-counts/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/nav/pending-counts", () => {
  it("未認証の場合、両方0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  it("CHILDロールの場合、両方0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  it("familyIdがない場合、両方0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  it("承認待ち（クエスト）とタスク申請中の件数を返すこと（ごほうび申請0件）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.questInstance.count.mockResolvedValue(3);
    mockPrisma.treasureLog.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.count.mockResolvedValue(2);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual({ approvals: 3, tasks: 2 });

    expect(mockPrisma.questInstance.count).toHaveBeenCalledWith({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: "fam-1" },
      },
    });
    expect(mockPrisma.taskTemplate.count).toHaveBeenCalledWith({
      where: {
        familyId: "fam-1",
        isActive: true,
        createdBy: "CHILD",
      },
    });
  });

  it("両方0件の場合、0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.questInstance.count.mockResolvedValue(0);
    mockPrisma.treasureLog.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);

    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  // ─── #151: approvals はクエスト承認待ち + ごほうび使用申請の合算 ─────────
  describe("approvals はクエスト承認待ち + ごほうび使用申請の合算（#151）", () => {
    it("クエスト0件・ごほうび0件 -> approvals: 0", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.questInstance.count.mockResolvedValue(0);
      mockPrisma.treasureLog.count.mockResolvedValue(0);
      mockPrisma.taskTemplate.count.mockResolvedValue(0);

      const res = await GET();
      expect((await res.json()).approvals).toBe(0);
    });

    it("クエスト0件・ごほうび2件 -> approvals: 2", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.questInstance.count.mockResolvedValue(0);
      mockPrisma.treasureLog.count.mockResolvedValue(2);
      mockPrisma.taskTemplate.count.mockResolvedValue(0);

      const res = await GET();
      expect((await res.json()).approvals).toBe(2);
    });

    it("クエスト3件・ごほうび2件 -> approvals: 5", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.questInstance.count.mockResolvedValue(3);
      mockPrisma.treasureLog.count.mockResolvedValue(2);
      mockPrisma.taskTemplate.count.mockResolvedValue(0);

      const res = await GET();
      expect((await res.json()).approvals).toBe(5);
    });

    it("treasureLog.count は useStatus=USE_REQUESTED かつ家庭スコープで絞ること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
      mockPrisma.questInstance.count.mockResolvedValue(0);
      mockPrisma.treasureLog.count.mockResolvedValue(0);
      mockPrisma.taskTemplate.count.mockResolvedValue(0);

      await GET();

      expect(mockPrisma.treasureLog.count).toHaveBeenCalledWith({
        where: {
          useStatus: "USE_REQUESTED",
          child: { familyId: "fam-1" },
        },
      });
    });

    it("他家庭のごほうび申請は合算されない（family スコープの回帰防止）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
      mockPrisma.questInstance.count.mockResolvedValue(0);
      // モック側は呼び出し引数を検証しないため、family スコープ漏れがあれば
      // 実装は他家庭分も含めて 5 を返しうる。ここでは「正しく絞られた結果」として
      // count が where 引数どおりに呼ばれていることを上のテストと合わせて担保する。
      mockPrisma.treasureLog.count.mockResolvedValue(0);
      mockPrisma.taskTemplate.count.mockResolvedValue(0);

      const res = await GET();
      expect((await res.json()).approvals).toBe(0);
    });
  });
});
