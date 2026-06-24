import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordCheckin, type CheckinResult } from "@/lib/checkin";
import {
  isBeforeCheckinDeadline,
  computeNextCheckinStreak,
  isValidCheckinDeadlineTime,
} from "@/lib/checkin.logic";
import { childUser, streak } from "../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isValidCheckinDeadlineTime", () => {
  it.each([
    ["00:00", true],
    ["09:30", true],
    ["16:00", true],
    ["23:59", true],
    ["24:00", false],
    ["7:00", false],
    ["16:0", false],
    ["", false],
    ["abc", false],
    ["16-00", false],
  ])("'%s' → %s", (input, expected) => {
    expect(isValidCheckinDeadlineTime(input)).toBe(expected);
  });
});

describe("isBeforeCheckinDeadline", () => {
  // JST 2026-06-23 15:30 = UTC 2026-06-23 06:30
  const questDate = new Date("2026-06-23T00:00:00Z"); // @db.Date 形式 (JST 6/23)

  it("締切前なら true", () => {
    const now = new Date("2026-06-23T06:30:00Z"); // JST 15:30
    expect(isBeforeCheckinDeadline(now, questDate, "16:00")).toBe(true);
  });

  it("締切ちょうどは false（期限切れ扱い）", () => {
    const now = new Date("2026-06-23T07:00:00Z"); // JST 16:00
    expect(isBeforeCheckinDeadline(now, questDate, "16:00")).toBe(false);
  });

  it("締切後は false", () => {
    const now = new Date("2026-06-23T07:30:00Z"); // JST 16:30
    expect(isBeforeCheckinDeadline(now, questDate, "16:00")).toBe(false);
  });

  it("JST 0時直後（UTC前日）でも当日扱い", () => {
    // JST 2026-06-23 00:30 = UTC 2026-06-22 15:30
    const now = new Date("2026-06-22T15:30:00Z");
    expect(isBeforeCheckinDeadline(now, questDate, "16:00")).toBe(true);
  });
});

describe("computeNextCheckinStreak", () => {
  const today = new Date("2026-06-23T00:00:00Z");
  const yesterday = new Date("2026-06-22T00:00:00Z");
  const twoDaysAgo = new Date("2026-06-21T00:00:00Z");

  it("初回（lastCheckinDate=null）は streak=1", () => {
    const r = computeNextCheckinStreak({ lastCheckinDate: null, today, prevStreak: 0, prevBest: 0 });
    expect(r.nextStreak).toBe(1);
    expect(r.nextBest).toBe(1);
  });

  it("昨日もチェックインしていれば +1", () => {
    const r = computeNextCheckinStreak({ lastCheckinDate: yesterday, today, prevStreak: 5, prevBest: 10 });
    expect(r.nextStreak).toBe(6);
    expect(r.nextBest).toBe(10);
  });

  it("昨日もチェックインしていて prev > best なら best 更新", () => {
    const r = computeNextCheckinStreak({ lastCheckinDate: yesterday, today, prevStreak: 10, prevBest: 10 });
    expect(r.nextStreak).toBe(11);
    expect(r.nextBest).toBe(11);
  });

  it("2日空いたら streak=1 にリセット、best 保持", () => {
    const r = computeNextCheckinStreak({ lastCheckinDate: twoDaysAgo, today, prevStreak: 10, prevBest: 20 });
    expect(r.nextStreak).toBe(1);
    expect(r.nextBest).toBe(20);
  });
});

describe("recordCheckin", () => {
  const today = new Date("2026-06-23T00:00:00Z"); // JST 6/23
  const yesterday = new Date("2026-06-22T00:00:00Z");

  it("checkinDeadlineTime が未設定なら enabled=false", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ checkinDeadlineTime: null }) as any,
    );

    const result = await recordCheckin("child-1", new Date("2026-06-23T06:30:00Z"));

    expect(result.enabled).toBe(false);
    expect(mockPrisma.checkinLog.upsert).not.toHaveBeenCalled();
  });

  it("当日の CheckinLog が既にあれば justNow=false かつ DB 操作なし", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findUnique.mockResolvedValue({
      id: "log-1",
      childId: "child-1",
      date: today,
      success: true,
      checkedInAt: new Date("2026-06-23T06:00:00Z"),
    } as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ checkinCurrentStreak: 5, checkinBestStreak: 10, lastCheckinDate: today }) as any,
    );

    const result = await recordCheckin("child-1", new Date("2026-06-23T06:30:00Z"));

    expect(result.enabled).toBe(true);
    expect(result.justNow).toBe(false);
    expect(result.todayStatus).toBe("success");
    expect(result.currentStreak).toBe(5);
    expect(mockPrisma.checkinLog.upsert).not.toHaveBeenCalled();
  });

  it("締切前の初回チェックインで success=true・streak=1 が記録される", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findUnique.mockResolvedValue(null);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ checkinCurrentStreak: 0, checkinBestStreak: 0, lastCheckinDate: null }) as any,
    );
    mockPrisma.checkinLog.create.mockResolvedValue({} as any);
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordCheckin("child-1", new Date("2026-06-23T06:30:00Z")); // JST 15:30

    expect(result.enabled).toBe(true);
    expect(result.todayStatus).toBe("success");
    expect(result.justNow).toBe(true);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
    expect(result.deadline).toBe("16:00");

    expect(mockPrisma.checkinLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        childId: "child-1",
        success: true,
        date: expect.any(Date),
        checkedInAt: expect.any(Date),
      }),
    });
    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        checkinCurrentStreak: 1,
        checkinBestStreak: 1,
        lastCheckinDate: expect.any(Date),
      },
    });
  });

  it("締切後のチェックインで success=false・streak がリセット", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findUnique.mockResolvedValue(null);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ checkinCurrentStreak: 5, checkinBestStreak: 10, lastCheckinDate: yesterday }) as any,
    );
    mockPrisma.checkinLog.create.mockResolvedValue({} as any);
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordCheckin("child-1", new Date("2026-06-23T08:00:00Z")); // JST 17:00

    expect(result.enabled).toBe(true);
    expect(result.todayStatus).toBe("fail");
    expect(result.justNow).toBe(false);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(10);

    expect(mockPrisma.checkinLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        childId: "child-1",
        success: false,
        checkedInAt: null,
      }),
    });
    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        checkinCurrentStreak: 0,
        checkinBestStreak: 10,
        lastCheckinDate: yesterday,
      },
    });
  });

  it("昨日もチェックイン済みなら streak が +1 になる", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findUnique.mockResolvedValue(null);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ checkinCurrentStreak: 5, checkinBestStreak: 5, lastCheckinDate: yesterday }) as any,
    );
    mockPrisma.checkinLog.create.mockResolvedValue({} as any);
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result: CheckinResult = await recordCheckin(
      "child-1",
      new Date("2026-06-23T06:30:00Z"),
    );

    expect(result.currentStreak).toBe(6);
    expect(result.bestStreak).toBe(6);
    expect(result.justNow).toBe(true);
  });

  it("締切ちょうどは失敗扱い（境界値）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findUnique.mockResolvedValue(null);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ checkinCurrentStreak: 0, checkinBestStreak: 0, lastCheckinDate: null }) as any,
    );
    mockPrisma.checkinLog.create.mockResolvedValue({} as any);
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordCheckin("child-1", new Date("2026-06-23T07:00:00Z")); // JST 16:00 ちょうど

    expect(result.todayStatus).toBe("fail");
  });
});
