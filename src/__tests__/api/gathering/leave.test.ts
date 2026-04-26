import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/gathering/leave/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/gathering/leave", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("PARENTは401", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("グループ未参加は404", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("正常に脱退できる", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      id: "m-1", groupId: "g-1", childId: "child-1", joinedAt: new Date(),
    } as never);
    vi.mocked(prisma.gatheringMember.delete).mockResolvedValue({} as never);

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(prisma.gatheringMember.delete).toHaveBeenCalledWith({ where: { childId: "child-1" } });
  });
});
