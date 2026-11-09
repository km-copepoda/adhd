import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/family/settings/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function req(body: unknown) {
  return new Request("http://localhost/api/family/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ id: "parent-1" }));
  mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
  mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1" }));
});

describe("PATCH /api/family/settings — reportDeadlineTime の検証", () => {
  it.each(["99:99", "24:00", "12:60", "7:30", "", "abc", "12:5"])("%j は 400", async (value) => {
    const res = await PATCH(req({ childId: "child-1", reportDeadlineTime: value }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it.each(["00:00", "23:59", "07:30"])("%s は保存できる", async (value) => {
    const res = await PATCH(req({ childId: "child-1", reportDeadlineTime: value }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { reportDeadlineTime: value },
    });
  });

  it("null は解除として保存できる", async () => {
    const res = await PATCH(req({ childId: "child-1", reportDeadlineTime: null }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { reportDeadlineTime: null },
    });
  });

  it("数値など文字列以外は 400", async () => {
    const res = await PATCH(req({ childId: "child-1", reportDeadlineTime: 1200 }));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/family/settings — 部分適用の防止", () => {
  it("後のフィールドが不正なら先のフィールドも更新しない", async () => {
    const res = await PATCH(
      req({ childId: "child-1", reportDeadlineTime: "20:00", checkinDeadlineTime: "99:99" }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("boolean が不正なら時刻も更新しない", async () => {
    const res = await PATCH(
      req({ childId: "child-1", reportDeadlineTime: "20:00", rubyEnabled: "yes" }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("全て妥当なら 1 回の update にまとめて反映する", async () => {
    const res = await PATCH(
      req({ childId: "child-1", reportDeadlineTime: "20:00", checkinDeadlineTime: "21:00", rubyEnabled: false }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { reportDeadlineTime: "20:00", checkinDeadlineTime: "21:00", rubyEnabled: false },
    });
  });

  it("更新対象が無い（childId のみ）なら 400", async () => {
    const res = await PATCH(req({ childId: "child-1" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("childId が無いなら 400", async () => {
    const res = await PATCH(req({ rubyEnabled: true }));
    expect(res.status).toBe(400);
  });

  it("他ファミリーの子供は 404", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await PATCH(req({ childId: "x", rubyEnabled: true }));
    expect(res.status).toBe(404);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
