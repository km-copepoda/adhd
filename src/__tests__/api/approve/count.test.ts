import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/approve/count/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/approve/count", () => {
  it("未認証の場合、count: 0 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ count: 0 });
  });

  it("CHILDロールの場合、count: 0 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    expect(await res.json()).toEqual({ count: 0 });
  });

  it("familyIdがない場合、count: 0 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    expect(await res.json()).toEqual({ count: 0 });
  });

  it("PARENTがREPORTEDとSKIP_REPORTEDの件数を取得できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.count.mockResolvedValue(3);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual({ count: 3 });
    expect(mockPrisma.questInstance.count).toHaveBeenCalledWith({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: "fam-1" },
      },
    });
  });

  it("承認待ちが0件の場合、count: 0 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.count.mockResolvedValue(0);

    const res = await GET();
    expect(await res.json()).toEqual({ count: 0 });
  });
});
