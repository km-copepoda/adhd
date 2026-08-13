import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/push/subscribe/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, pushSubscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

const subBody = {
  endpoint: "https://push.example.com/sub",
  keys: { p256dh: "key123", auth: "auth123" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/push/subscribe", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    expect(res.status).toBe(403);
  });

  it("PARENTが購読登録できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.pushSubscription.upsert.mockResolvedValue(pushSubscription({ userId: "parent-1" }));

    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: subBody.endpoint },
      create: {
        userId: "parent-1",
        endpoint: subBody.endpoint,
        p256dh: subBody.keys.p256dh,
        auth: subBody.keys.auth,
      },
      update: {
        userId: "parent-1",
        p256dh: subBody.keys.p256dh,
        auth: subBody.keys.auth,
      },
    });
  });

  it("CHILDも購読登録できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.pushSubscription.upsert.mockResolvedValue(pushSubscription({ userId: "child-1" }));

    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: subBody.endpoint },
      create: {
        userId: "child-1",
        endpoint: subBody.endpoint,
        p256dh: subBody.keys.p256dh,
        auth: subBody.keys.auth,
      },
      update: {
        userId: "child-1",
        p256dh: subBody.keys.p256dh,
        auth: subBody.keys.auth,
      },
    });
  });
});
