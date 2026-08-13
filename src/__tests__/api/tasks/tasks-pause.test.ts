import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/[id]/pause/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, taskTemplate } from "../../helpers/fixtures";

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeRequest("/api/tasks/t1/pause", { paused: true }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("familyId=null のPARENTは403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await POST(makeRequest("/api/tasks/t1/pause", { paused: true }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("paused=true で pausedAt に現在時刻をセットすること（新規停止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const now = new Date("2026-07-20T10:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ pausedAt: null }) as never,
    );
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const calledData = mockPrisma.taskTemplate.updateMany.mock.calls[0][0].data;
    expect((calledData.pausedAt as Date).getTime()).toBe(now.getTime());
    vi.useRealTimers();
  });

  it("paused=true が冪等: 既に停止中なら pausedAt を上書きしない", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const originalPausedAt = new Date("2026-08-01T10:00:00Z");
    const now = new Date("2026-08-05T10:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ pausedAt: originalPausedAt }) as never,
    );
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const calledData = mockPrisma.taskTemplate.updateMany.mock.calls[0][0].data;
    expect((calledData.pausedAt as Date).getTime()).toBe(originalPausedAt.getTime());
    vi.useRealTimers();
  });

  it("paused=false で pausedAt を null にし、既存 pauseIntervals に今回停止分を追記すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const pausedAt = new Date("2026-07-20T10:00:00Z");
    const now = new Date("2026-07-25T10:00:00Z");
    vi.setSystemTime(now);
    // 再開時はプラン上限チェックのため findUnique + count を通る (デフォルト count=0 で allowed)
    // findUnique は assignedChildId 取得と pauseIntervals 追記のため pausedAt / pauseIntervals も返す
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({
        assignedChildId: "child-1",
        pausedAt,
        pauseIntervals: [{ start: "2026-06-01T00:00:00Z", end: "2026-06-05T00:00:00Z" }],
      }) as never,
    );
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const called = mockPrisma.taskTemplate.updateMany.mock.calls[0][0];
    // where に読み取り時点の pausedAt を含める（並行リクエストへの防御。下の 409 テスト参照）
    expect(called.where).toEqual({ id: "t1", familyId: "fam-1", pausedAt });
    expect(called.data.pausedAt).toBeNull();
    // pausedAt 当日・再開当日 (now) はどちらも一部 active だった日なので境界日を除いて保存する
    // (7/20 停止 → 7/25 再開 の場合、完全に停止していたのは 7/21〜7/24)
    expect(called.data.pauseIntervals).toEqual([
      { start: "2026-06-01T00:00:00Z", end: "2026-06-05T00:00:00Z" },
      { start: "2026-07-21T00:00:00.000Z", end: "2026-07-24T00:00:00.000Z" },
    ]);
    vi.useRealTimers();
  });

  it("paused=false で pausedAt が既に null の場合は pauseIntervals を触らない (重複再開の防御)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ assignedChildId: "child-1", pausedAt: null, pauseIntervals: [] }) as never,
    );
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const called = mockPrisma.taskTemplate.updateMany.mock.calls[0][0];
    expect(called.where).toEqual({ id: "t1", familyId: "fam-1", pausedAt: null });
    expect(called.data.pausedAt).toBeNull();
    // pauseIntervals は data に含めない (既存値のまま)
    expect(called.data.pauseIntervals).toBeUndefined();
  });

  it("読み取り後に状態が変化していた場合（並行リクエスト競合）は 409 を返し上書きしない", async () => {
    // 例: タブA(再開)とタブB(停止)がほぼ同時に届き、両方が同じ古い pausedAt を読んだ後、
    // 片方が先に書き込んで状態を変えてしまうケース。updateMany の where に読み取り時点の
    // pausedAt を含めているので、その間に状態が変わっていれば count=0 になり検出できる。
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ pausedAt: null }) as never,
    );
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("PAUSE_STATE_CONFLICT");
  });

  it("paused 未指定は400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(
      makeRequest("/api/tasks/t1/pause", {}),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });

  it("paused に boolean 以外の値を渡すと400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: "yes" }),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });
});
