import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/users/me/route";
import { getCurrentUser } from "@/lib/auth";
import { childUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users/me", () => {
  it("未認証の場合 401 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reportDeadlineTime が null のユーザーは null を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.reportDeadlineTime).toBeNull();
  });

  it("reportDeadlineTime が設定されていれば返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUser({ reportDeadlineTime: "20:00" } as any) as any
    );
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.reportDeadlineTime).toBe("20:00");
  });
});
