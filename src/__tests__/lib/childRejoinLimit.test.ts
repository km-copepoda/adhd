import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import {
  isLocked,
  recordFailure,
  resetAttempts,
  USER_MAX_FAILURES,
  FAMILY_MAX_FAILURES,
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

describe("recordFailure", () => {
  it("初回失敗は count=1 でロックしないこと", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue(null);
    await recordFailure("user:a", USER_MAX_FAILURES, NOW);
    expect(mockPrisma.childRejoinAttempt.upsert).toHaveBeenCalledWith({
      where: { key: "user:a" },
      create: { key: "user:a", failCount: 1, lockedUntil: null },
      update: { failCount: 1, lockedUntil: null },
    });
  });

  it("上限-1回目まではロックしないこと", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue({
      key: "user:a", failCount: USER_MAX_FAILURES - 2, lockedUntil: null, updatedAt: NOW,
    });
    await recordFailure("user:a", USER_MAX_FAILURES, NOW);
    expect(mockPrisma.childRejoinAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { failCount: USER_MAX_FAILURES - 1, lockedUntil: null },
      }),
    );
  });

  it("上限ちょうどの失敗でロックすること", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue({
      key: "user:a", failCount: USER_MAX_FAILURES - 1, lockedUntil: null, updatedAt: NOW,
    });
    await recordFailure("user:a", USER_MAX_FAILURES, NOW);
    expect(mockPrisma.childRejoinAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          failCount: USER_MAX_FAILURES,
          lockedUntil: new Date(NOW.getTime() + LOCK_MS),
        },
      }),
    );
  });

  it("ウィンドウ経過後は count=1 からやり直すこと", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue({
      key: "family:ABC123", failCount: FAMILY_MAX_FAILURES - 1, lockedUntil: null,
      updatedAt: new Date(NOW.getTime() - WINDOW_MS - 1),
    });
    await recordFailure("family:ABC123", FAMILY_MAX_FAILURES, NOW);
    expect(mockPrisma.childRejoinAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { failCount: 1, lockedUntil: null } }),
    );
  });

  it("ロック期限切れ後の失敗は count=1 からやり直すこと", async () => {
    mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue({
      key: "user:a", failCount: USER_MAX_FAILURES, lockedUntil: new Date(NOW.getTime() - 1), updatedAt: NOW,
    });
    await recordFailure("user:a", USER_MAX_FAILURES, NOW);
    expect(mockPrisma.childRejoinAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { failCount: 1, lockedUntil: null } }),
    );
  });
});

describe("resetAttempts", () => {
  it("該当キーを削除すること（行がなくても例外にしない）", async () => {
    mockPrisma.childRejoinAttempt.deleteMany.mockResolvedValue({ count: 0 });
    await resetAttempts("user:a");
    expect(mockPrisma.childRejoinAttempt.deleteMany).toHaveBeenCalledWith({ where: { key: "user:a" } });
  });
});
