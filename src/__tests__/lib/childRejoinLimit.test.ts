import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import {
  isLocked,
  recordAttempt,
  purgeExpiredAttempts,
  resetAttempts,
  USER_MAX_FAILURES,
  IP_MAX_FAILURES,
  LOCK_MS,
  WINDOW_MS,
} from "@/lib/childRejoinLimit";

const NOW = new Date("2026-10-22T00:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("isLocked", () => {
  it("行がなければロックされていないこと", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue(null);
    expect(await isLocked("user:a", NOW)).toBe(false);
  });
  it("lockedUntil が未来ならロック中", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue({
      key: "user:a", failCount: 5, lockedUntil: new Date(NOW.getTime() + 1), updatedAt: NOW,
    });
    expect(await isLocked("user:a", NOW)).toBe(true);
  });
  it("lockedUntil がちょうど現在なら解除されていること（境界）", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue({
      key: "user:a", failCount: 5, lockedUntil: NOW, updatedAt: NOW,
    });
    expect(await isLocked("user:a", NOW)).toBe(false);
  });
});

describe("recordAttempt（原子的なカウント）", () => {
  const row = (failCount: number, lockedUntil: Date | null = null) =>
    mockPrisma.$queryRaw.mockResolvedValue([{ failCount, lockedUntil }] as never);

  it("read-modify-write せず、単一の raw SQL（upsert）で数えること", async () => {
    row(1);
    await recordAttempt("user:a", USER_MAX_FAILURES, NOW);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.childRejoinAttempt.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.childRejoinAttempt.upsert).not.toHaveBeenCalled();
    const [strings] = mockPrisma.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray];
    expect(strings.join("?")).toContain("ON CONFLICT");
  });

  it("戻り値の count が上限以下なら locked=false", async () => {
    row(IP_MAX_FAILURES);
    const r = await recordAttempt("ip:A", IP_MAX_FAILURES, NOW);
    expect(r).toMatchObject({ count: IP_MAX_FAILURES, locked: false });
  });

  it("戻り値の count が上限+1 なら locked=true（境界）", async () => {
    row(IP_MAX_FAILURES + 1, new Date(NOW.getTime() + LOCK_MS));
    const r = await recordAttempt("ip:A", IP_MAX_FAILURES, NOW);
    expect(r.locked).toBe(true);
  });

  it("ロック期限・ウィンドウ開始時刻を SQL パラメータに渡すこと", async () => {
    row(1);
    await recordAttempt("user:a", USER_MAX_FAILURES, NOW);
    const flatten = (v: unknown): unknown[] =>
      v && typeof v === "object" && "values" in v
        ? (v as { values: unknown[] }).values.flatMap(flatten)
        : [v];
    const params = (mockPrisma.$queryRaw.mock.calls[0] as unknown[]).slice(1).flatMap(flatten);
    expect(params).toContainEqual(new Date(NOW.getTime() + LOCK_MS));
    expect(params).toContainEqual(new Date(NOW.getTime() - WINDOW_MS));
  });
});

describe("purgeExpiredAttempts", () => {
  it("ウィンドウ経過かつロック解除済みの行だけ削除すること", async () => {
    mockPrisma.childRejoinAttempt.deleteMany.mockResolvedValue({ count: 3 });
    await purgeExpiredAttempts(NOW);
    expect(mockPrisma.childRejoinAttempt.deleteMany).toHaveBeenCalledWith({
      where: {
        updatedAt: { lt: new Date(NOW.getTime() - WINDOW_MS) },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: NOW } }],
      },
    });
  });
});

describe("resetAttempts", () => {
  it("該当キーを削除すること（行がなくても例外にしない）", async () => {
    mockPrisma.childRejoinAttempt.deleteMany.mockResolvedValue({ count: 0 });
    await resetAttempts("user:a");
    expect(mockPrisma.childRejoinAttempt.deleteMany).toHaveBeenCalledWith({ where: { key: "user:a" } });
  });
});
