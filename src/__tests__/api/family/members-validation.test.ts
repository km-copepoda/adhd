import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, PATCH } from "@/app/api/family/members/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { makeRequest } from "../../helpers/request";
import { parentUserWithFamily, childUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
});

describe("POST /api/family/members — 入力検証", () => {
  it.each([
    ["数値", 123],
    ["配列", ["a"]],
    ["オブジェクト", { a: 1 }],
    ["空白のみ", "   "],
    ["21文字", "あ".repeat(21)],
  ])("monsterName が %s なら 400", async (_l, monsterName) => {
    const res = await POST(makeRequest("/api/family/members", { monsterName, side: "LIGHT" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it.each(["", "light", "NEUTRAL", 1, null])("side が %j なら 400", async (side) => {
    const res = await POST(makeRequest("/api/family/members", { monsterName: "ぽち", side }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/family/members — minTasksForStreak 検証", () => {
  beforeEach(() => {
    mockPrisma.user.findFirst.mockResolvedValue(childUser());
    mockPrisma.user.update.mockResolvedValue(childUser());
  });

  it.each([0, -1, 1.5, 1e10, 21, "3", null])("%j は 400", async (v) => {
    const res = await PATCH(
      makeRequest("/api/family/members", { childId: "child-1", minTasksForStreak: v }, "PATCH"),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it.each([1, 20])("%i は更新できる", async (v) => {
    const res = await PATCH(
      makeRequest("/api/family/members", { childId: "child-1", minTasksForStreak: v }, "PATCH"),
    );
    expect(res.status).toBe(200);
  });
});
