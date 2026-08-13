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

  it("paused=true で pausedAt に現在時刻をセットすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const now = new Date("2026-07-20T10:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate({ id: "t1", pausedAt: now }));

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: { pausedAt: expect.any(Date) },
    });
    const calledData = mockPrisma.taskTemplate.update.mock.calls[0][0].data;
    expect((calledData.pausedAt as Date).getTime()).toBe(now.getTime());
    vi.useRealTimers();
  });

  it("paused=false で pausedAt を null にすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // 再開時はプラン上限チェックのため findUnique + count を通る (デフォルト count=0 で allowed)
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ assignedChildId: "child-1" }),
    );
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate({ id: "t1", pausedAt: null }));

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: { pausedAt: null },
    });
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
