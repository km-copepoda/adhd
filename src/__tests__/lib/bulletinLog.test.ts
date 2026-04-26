import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  triggerTaskProgressLog,
  triggerBadgeLog,
  triggerStreakTitleLog,
  triggerMonsterEvolvedLog,
  triggerMonsterRebornLog,
} from "@/lib/bulletinLog";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triggerTaskProgressLog", () => {
  it("グループ未参加なら何も書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(null);
    await triggerTaskProgressLog("child-1");
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("name が null でも monsterName があれば monsterName で書き込む", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue({ groupId: "g-1" } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: "ドラゴン" } as never);
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(2 as never) // total
      .mockResolvedValueOnce(2 as never); // done
    mockPrisma.bulletinLog.create.mockResolvedValue({} as never);

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).toHaveBeenCalled();
    const firstCall = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(firstCall.data.message).toContain("ドラゴン");
  });

  it("name も monsterName も両方 null なら書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue({ groupId: "g-1" } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: null } as never);

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("monsterName が優先される（プライバシー: 本名はグループ内に晒さない）", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue({ groupId: "g-1" } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ name: "鈴木太郎", monsterName: "ドラゴン" } as never);
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(1 as never);
    mockPrisma.bulletinLog.create.mockResolvedValue({} as never);

    await triggerTaskProgressLog("child-1");

    const firstCall = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(firstCall.data.message).toContain("ドラゴン");
    expect(firstCall.data.message).not.toContain("鈴木太郎");
  });

  it("当日タスク0件なら書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue({ groupId: "g-1" } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ name: "太郎", monsterName: null } as never);
    mockPrisma.questInstance.count.mockResolvedValueOnce(0 as never); // total = 0

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("達成率に応じて複数のマイルストーンを書き込む", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue({ groupId: "g-1" } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: "モンスタロウ" } as never);
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(4 as never) // total
      .mockResolvedValueOnce(4 as never); // done = 100%
    mockPrisma.bulletinLog.create.mockResolvedValue({} as never);

    await triggerTaskProgressLog("child-1");

    // 100%達成時はSTART/25/50/75/100の5マイルストーンが書き込まれる
    expect(mockPrisma.bulletinLog.create).toHaveBeenCalledTimes(5);
  });
});

describe("triggerBadgeLog / triggerStreakTitleLog / triggerMonsterEvolvedLog / triggerMonsterRebornLog", () => {
  beforeEach(() => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue({ groupId: "g-1" } as never);
    mockPrisma.bulletinLog.create.mockResolvedValue({} as never);
  });

  it("triggerBadgeLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: "ドラゴン" } as never);
    await triggerBadgeLog("child-1", "はじめの一歩");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("はじめの一歩");
  });

  it("triggerStreakTitleLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: "ドラゴン" } as never);
    await triggerStreakTitleLog("child-1", "一週間の戦士");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("一週間の戦士");
  });

  it("triggerMonsterEvolvedLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: "ドラゴン" } as never);
    await triggerMonsterEvolvedLog("child-1", "フレアドラゴン");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("フレアドラゴン");
  });

  it("triggerMonsterRebornLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: "ドラゴン" } as never);
    await triggerMonsterRebornLog("child-1", "べんきょう");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("べんきょう");
  });

  it("どのトリガーも name と monsterName が両方 null なら書き込まない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ name: null, monsterName: null } as never);
    await triggerBadgeLog("child-1", "はじめの一歩");
    await triggerStreakTitleLog("child-1", "一週間");
    await triggerMonsterEvolvedLog("child-1", "ドラゴン");
    await triggerMonsterRebornLog("child-1", "べんきょう");

    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });
});
