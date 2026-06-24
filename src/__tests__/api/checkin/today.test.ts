import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { recordCheckin } from "@/lib/checkin";
import { POST } from "@/app/api/checkin/today/route";
import { childUser, parentUser } from "../../helpers/fixtures";

vi.mock("@/lib/checkin", () => ({
  recordCheckin: vi.fn(),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRecordCheckin = vi.mocked(recordCheckin);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/checkin/today", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("親ユーザーは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("子供のチェックインで recordCheckin の結果をそのまま返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockRecordCheckin.mockResolvedValue({
      enabled: true,
      deadline: "16:00",
      todayStatus: "success",
      justNow: true,
      currentStreak: 3,
      bestStreak: 5,
    });

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      enabled: true,
      deadline: "16:00",
      todayStatus: "success",
      justNow: true,
      currentStreak: 3,
      bestStreak: 5,
    });
    expect(mockRecordCheckin).toHaveBeenCalledWith("child-1", expect.any(Date));
  });
});
