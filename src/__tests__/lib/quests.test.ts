import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ensureTodayQuests, cleanupStaleCarryOverInstances } from "@/lib/quests";
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
    // 直近 settled クエリ用のデフォルト
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
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
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
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

  it("carryOver=true のテンプレートで stale PENDING があれば updateMany でクリーンアップすること", async () => {
    vi.setSystemTime(new Date("2026-03-13T09:00:00")); // 金曜(5)

    const templates = [
      { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY", repeatDays: [5], isTemporary: false, carryOver: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);
    // 直近 APPROVED が存在する想定（クリーンアップが発火する前提）
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { templateId: "tpl-1", date: new Date("2026-03-06T00:00:00Z") },
    ] as any);
    mockPrisma.questInstance.findFirst.mockResolvedValue(null);
    mockPrisma.questInstance.upsert.mockResolvedValue({} as any);
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 1 } as any);

    await ensureTodayQuests({ childId: "child-1", familyId: "fam-1" });

    // carryOver テンプレートに対して updateMany が呼ばれていること（stale クリーンアップ）
    expect(mockPrisma.questInstance.updateMany).toHaveBeenCalled();
  });
});

describe("cleanupStaleCarryOverInstances", () => {
  it("templates が空ならクエリも updateMany も呼ばないこと", async () => {
    await cleanupStaleCarryOverInstances({ childId: "child-1", templates: [] });

    expect(mockPrisma.questInstance.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.questInstance.updateMany).not.toHaveBeenCalled();
  });

  it("carryOver=false のテンプレートはクリーンアップ対象外であること", async () => {
    await cleanupStaleCarryOverInstances({
      childId: "child-1",
      templates: [{ id: "tpl-1", carryOver: false }],
    });

    expect(mockPrisma.questInstance.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.questInstance.updateMany).not.toHaveBeenCalled();
  });

  it("直近 APPROVED より古い PENDING / REPORTED / SKIP_REPORTED を REJECTED に変換すること", async () => {
    const settledDate = new Date("2026-03-13T00:00:00Z");
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { templateId: "tpl-1", date: settledDate },
    ] as any);
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 3 } as any);

    await cleanupStaleCarryOverInstances({
      childId: "child-1",
      templates: [{ id: "tpl-1", carryOver: true }],
    });

    expect(mockPrisma.questInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: "tpl-1",
          childId: "child-1",
          status: { in: ["PENDING", "REPORTED", "SKIP_REPORTED"] },
          date: { lt: settledDate },
        }),
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "STALE_CARRYOVER_CLEANUP",
        }),
      })
    );
  });

  it("APPROVED/SKIPPED 履歴がないテンプレートには updateMany を呼ばないこと", async () => {
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await cleanupStaleCarryOverInstances({
      childId: "child-1",
      templates: [{ id: "tpl-1", carryOver: true }],
    });

    expect(mockPrisma.questInstance.updateMany).not.toHaveBeenCalled();
  });

  it("複数テンプレートを混在で渡しても carryOver=true のものだけ処理すること", async () => {
    const settledDate = new Date("2026-03-13T00:00:00Z");
    // 直近 settled クエリは carryOver=true の templateId だけ問い合わせる想定
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { templateId: "tpl-1", date: settledDate },
    ] as any);
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 1 } as any);

    await cleanupStaleCarryOverInstances({
      childId: "child-1",
      templates: [
        { id: "tpl-1", carryOver: true },
        { id: "tpl-2", carryOver: false },
      ],
    });

    // findMany は templateIds: ["tpl-1"] のみで呼ばれること
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: { in: ["tpl-1"] },
          childId: "child-1",
          status: { in: ["APPROVED", "SKIPPED"] },
        }),
      })
    );
    // updateMany は tpl-1 だけ
    expect(mockPrisma.questInstance.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.questInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ templateId: "tpl-1" }),
      })
    );
  });
});
