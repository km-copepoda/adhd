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

  it("paused=true で pausedAt に現在時刻をセットすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const now = new Date("2026-07-20T10:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", pausedAt: now } as any);

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: { pausedAt: expect.any(Date) },
    });
    const calledData = (mockPrisma.taskTemplate.update as any).mock.calls[0][0].data;
    expect((calledData.pausedAt as Date).getTime()).toBe(now.getTime());
    vi.useRealTimers();
  });

  it("paused=false で pausedAt を null にすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", pausedAt: null } as any);

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
