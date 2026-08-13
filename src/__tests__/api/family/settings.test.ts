import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/family/settings/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../helpers/fixtures";

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
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ id: "parent-1" }));
});

describe("PATCH /api/family/settings — questTimeNotifyEnabled", () => {
  it("親が自分のファミリーの子供の通知フラグを true→false に更新できること", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", questTimeNotifyEnabled: false }));

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
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", questTimeNotifyEnabled: true }));

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));

    const res = await PATCH(
      makeRequest({ childId: "child-1", questTimeNotifyEnabled: false }),
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("questTimeNotifyEnabled が boolean でない場合は 400 を返すこと", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));

    const res = await PATCH(
      makeRequest({ childId: "child-1", questTimeNotifyEnabled: "true" }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/family/settings — checkinDeadlineTime", () => {
  it("HH:mm 形式で更新できること", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", checkinDeadlineTime: "16:00" }));

    const res = await PATCH(
      makeRequest({ childId: "child-1", checkinDeadlineTime: "16:00" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { checkinDeadlineTime: "16:00" },
    });
  });

  it("null でクリアできること", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", checkinDeadlineTime: null }));

    const res = await PATCH(
      makeRequest({ childId: "child-1", checkinDeadlineTime: null }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { checkinDeadlineTime: null },
    });
  });

  it("不正な時刻フォーマットは 400", async () => {
    const res = await PATCH(
      makeRequest({ childId: "child-1", checkinDeadlineTime: "25:00" }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("ファミリー外の子供 ID は 404", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest({ childId: "child-other", checkinDeadlineTime: "16:00" }),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
