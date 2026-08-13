import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/nav/pending-counts/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/nav/pending-counts", () => {
  it("未認証の場合、両方0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  it("CHILDロールの場合、両方0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  it("familyIdがない場合、両方0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });

  it("承認待ちとタスク申請中の件数を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.questInstance.count.mockResolvedValue(3);
    mockPrisma.taskTemplate.count.mockResolvedValue(2);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual({ approvals: 3, tasks: 2 });

    expect(mockPrisma.questInstance.count).toHaveBeenCalledWith({
      where: {
        OR: [{ status: "REPORTED" }, { status: "SKIP_REPORTED" }],
        template: { familyId: "fam-1" },
      },
    });
    expect(mockPrisma.taskTemplate.count).toHaveBeenCalledWith({
      where: {
        familyId: "fam-1",
        isActive: true,
        createdBy: "CHILD",
      },
    });
  });

  it("両方0件の場合、0を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.questInstance.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);

    const res = await GET();
    expect(await res.json()).toEqual({ approvals: 0, tasks: 0 });
  });
});
