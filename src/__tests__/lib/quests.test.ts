import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ensureTodayQuests } from "@/lib/quests";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ensureTodayQuests", () => {
  it("今日の曜日に該当するテンプレートを upsert すること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00")); // 木曜(4)

    const templates = [
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [4], isTemporary: false, carryOver: false },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);

    await ensureTodayQuests({ childId: "child-1", familyId: "fam-1" });

    expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        familyId: "fam-1",
        assignedChildId: "child-1",
        isActive: true,
      }),
    });
    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          templateId: "tpl-1",
          childId: "child-1",
          snapshotTitle: "宿題",
          snapshotEmoji: "📚",
          snapshotCategory: "STUDY",
        }),
      })
    );
  });

  it("carryOver=true で既存 PENDING がある場合、upsert をスキップすること", async () => {
    vi.setSystemTime(new Date("2026-03-13T09:00:00")); // 金曜(5)

    const templates = [
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue({ id: "q-old", status: "PENDING" } as any);

    await ensureTodayQuests({ childId: "child-1", familyId: "fam-1" });

    expect(mockPrisma.questInstance.upsert).not.toHaveBeenCalled();
  });

  it("carryOver=true で PENDING がない場合、upsert すること", async () => {
    vi.setSystemTime(new Date("2026-03-13T09:00:00"));

    const templates = [
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue(null);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);

    await ensureTodayQuests({ childId: "child-1", familyId: "fam-1" });

    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(1);
  });

  it("carryOver=false のタスクでは findFirst を呼ばずに upsert すること", async () => {
    vi.setSystemTime(new Date("2026-03-13T09:00:00"));

    const templates = [
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: false },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);

    await ensureTodayQuests({ childId: "child-1", familyId: "fam-1" });

    expect(mockPrisma.questInstance.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.questInstance.upsert).toHaveBeenCalledTimes(1);
  });

  it("テンプレートが空なら何も書き込まないこと", async () => {
    vi.setSystemTime(new Date("2026-03-13T09:00:00"));

    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    await ensureTodayQuests({ childId: "child-1", familyId: "fam-1" });

    expect(mockPrisma.questInstance.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.questInstance.findFirst).not.toHaveBeenCalled();
  });
});
