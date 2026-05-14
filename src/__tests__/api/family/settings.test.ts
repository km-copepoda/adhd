import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/family/settings/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/family/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue({
    id: "parent-1",
    role: "PARENT",
    familyId: "fam-1",
  } as any);
});

describe("PATCH /api/family/settings — questTimeNotifyEnabled", () => {
  it("親が自分のファミリーの子供の通知フラグを true→false に更新できること", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "child-1" } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await PATCH(
      makeRequest({ childId: "child-1", questTimeNotifyEnabled: false }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { questTimeNotifyEnabled: false },
    });
  });

  it("true への切り替えも反映されること", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "child-1" } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await PATCH(
      makeRequest({ childId: "child-1", questTimeNotifyEnabled: true }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { questTimeNotifyEnabled: true },
    });
  });

  it("ファミリー外の子供 ID は 404 で拒否されること", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest({ childId: "child-other", questTimeNotifyEnabled: false }),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("親以外のロールは 403 で拒否されること", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "child-1",
      role: "CHILD",
      familyId: "fam-1",
    } as any);

    const res = await PATCH(
      makeRequest({ childId: "child-1", questTimeNotifyEnabled: false }),
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("questTimeNotifyEnabled が boolean でない場合は 400 を返すこと", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "child-1" } as any);

    const res = await PATCH(
      makeRequest({ childId: "child-1", questTimeNotifyEnabled: "true" }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
