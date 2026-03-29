import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/approve/pending/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/approve/pending", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("CHILDロールの場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("PARENTがREPORTEDとSKIP_REPORTEDのクエストを取得できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const pendingQuests = [
      {
        id: "q1",
        status: "REPORTED",
        reportedAt: new Date("2026-03-12T10:00:00"),
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "宿題", emoji: "📚", category: "STUDY" },
      },
      {
        id: "q2",
        templateId: "tpl-2",
        status: "SKIP_REPORTED",
        reportedAt: new Date("2026-03-12T09:00:00"),
        child: { name: "花子", monsterName: "ユニコーン", side: "LIGHT" },
        template: { title: "運動", emoji: "💪", category: "STAMINA", isTemporary: true },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(pendingQuests as any);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(2);
    expect(json[1].templateId).toBeDefined();
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: "fam-1" },
      },
      include: {
        child: { select: { name: true, monsterName: true, side: true } },
        template: { select: { title: true, emoji: true, category: true, isTemporary: true } },
      },
      orderBy: { reportedAt: "desc" },
    });
  });
});
