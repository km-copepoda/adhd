import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "@/app/api/streak/rest-pass/route";
import { childUser, streak } from "../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/streak/rest-pass", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("ストリーク未作成の場合、404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("休息券が未使用なら正常に使用できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ restPassUsedAt: null }) as any
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: { restPassUsedAt: expect.any(Date) },
    });
  });

  it("今週既に使用済みなら400を返すこと", async () => {
    // 今週の月曜以降の日付を restPassUsedAt に設定
    const thisWeek = new Date();
    const day = thisWeek.getDay();
    const diff = thisWeek.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), diff);

    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ restPassUsedAt: monday }) as any
    );

    const res = await POST();
    expect(res.status).toBe(400);
    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });
});
