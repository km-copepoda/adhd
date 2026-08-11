import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/[id]/pause/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/tasks/[id]/pause", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/tasks/t1/pause", { paused: true }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールは403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeRequest("/api/tasks/t1/pause", { paused: true }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("familyId=null のPARENTは403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await POST(makeRequest("/api/tasks/t1/pause", { paused: true }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("paused=true で pausedAt に現在時刻をセットすること（新規停止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const now = new Date("2026-07-20T10:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.taskTemplate.findUnique.mockResolvedValue({ pausedAt: null } as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", pausedAt: now } as any);

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const calledData = (mockPrisma.taskTemplate.update as any).mock.calls[0][0].data;
    expect((calledData.pausedAt as Date).getTime()).toBe(now.getTime());
    vi.useRealTimers();
  });

  it("paused=true が冪等: 既に停止中なら pausedAt を上書きしない", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const originalPausedAt = new Date("2026-08-01T10:00:00Z");
    const now = new Date("2026-08-05T10:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.taskTemplate.findUnique.mockResolvedValue({ pausedAt: originalPausedAt } as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", pausedAt: originalPausedAt } as any);

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    // pausedAt を data に含めない（既存値保持）か、明示的に元の値と一致させる
    const calledData = (mockPrisma.taskTemplate.update as any).mock.calls[0][0].data;
    if (calledData.pausedAt !== undefined) {
      expect((calledData.pausedAt as Date).getTime()).toBe(originalPausedAt.getTime());
    }
    vi.useRealTimers();
  });

  it("paused=false で pausedAt を null にし、既存 pauseIntervals に今回停止分を追記すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const pausedAt = new Date("2026-07-20T10:00:00Z");
    const now = new Date("2026-07-25T10:00:00Z");
    vi.setSystemTime(now);
    // 再開時はプラン上限チェックのため findUnique + count を通る (デフォルト count=0 で allowed)
    // findUnique は assignedChildId 取得と pauseIntervals 追記のため pausedAt / pauseIntervals も返す
    mockPrisma.taskTemplate.findUnique.mockResolvedValue({
      assignedChildId: "child-1",
      pausedAt,
      pauseIntervals: [{ start: "2026-06-01T00:00:00Z", end: "2026-06-05T00:00:00Z" }],
    } as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", pausedAt: null } as any);

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const called = (mockPrisma.taskTemplate.update as any).mock.calls[0][0];
    expect(called.where).toEqual({ id: "t1", familyId: "fam-1" });
    expect(called.data.pausedAt).toBeNull();
    expect(called.data.pauseIntervals).toEqual([
      { start: "2026-06-01T00:00:00Z", end: "2026-06-05T00:00:00Z" },
      { start: pausedAt.toISOString(), end: now.toISOString() },
    ]);
    vi.useRealTimers();
  });

  it("paused=false で pausedAt が既に null の場合は pauseIntervals を触らない (重複再開の防御)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.findUnique.mockResolvedValue({
      assignedChildId: "child-1",
      pausedAt: null,
      pauseIntervals: [],
    } as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", pausedAt: null } as any);

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const called = (mockPrisma.taskTemplate.update as any).mock.calls[0][0];
    expect(called.data.pausedAt).toBeNull();
    // pauseIntervals は data に含めない (既存値のまま)
    expect(called.data.pauseIntervals).toBeUndefined();
  });

  it("paused 未指定は400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/t1/pause", {}),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });

  it("paused に boolean 以外の値を渡すと400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: "yes" }),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });
});
