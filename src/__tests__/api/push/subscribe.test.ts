import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
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
    mockPrisma.pushSubscription.create.mockResolvedValue(pushSubscription({ userId: "parent-1" }));

    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.pushSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: "parent-1",
        endpoint: subBody.endpoint,
        p256dh: subBody.keys.p256dh,
        auth: subBody.keys.auth,
      },
    });
  });

  it.each([
    ["keys 欠落", { endpoint: "https://push.example.com/sub" }],
    ["p256dh 欠落", { endpoint: "https://push.example.com/sub", keys: { auth: "a" } }],
    ["auth が文字列でない", { endpoint: "https://push.example.com/sub", keys: { p256dh: "k", auth: 1 } }],
    ["endpoint 欠落", { keys: { p256dh: "k", auth: "a" } }],
    ["endpoint が空文字", { endpoint: "", keys: { p256dh: "k", auth: "a" } }],
    ["endpoint が文字列でない", { endpoint: 123, keys: { p256dh: "k", auth: "a" } }],
  ])("%s の場合、400を返すこと", async (_label, body) => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/push/subscribe", body));
    expect(res.status).toBe(400);
    expect(mockPrisma.pushSubscription.create).not.toHaveBeenCalled();
  });

  it("create が一意制約違反で、他ユーザー所有の endpoint は上書きせず409を返すこと（競合時も atomic）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.pushSubscription.create.mockRejectedValue({ code: "P2002" });
    mockPrisma.pushSubscription.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    expect(res.status).toBe(409);
    expect(mockPrisma.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { endpoint: subBody.endpoint, userId: "parent-1" },
      data: { p256dh: subBody.keys.p256dh, auth: subBody.keys.auth },
    });
  });

  it("自分の endpoint の更新は成功すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.pushSubscription.create.mockRejectedValue({ code: "P2002" });
    mockPrisma.pushSubscription.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    expect(res.status).toBe(200);
  });

  it("一意制約違反以外のエラーは再スローされること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.pushSubscription.create.mockRejectedValue(new Error("db down"));
    await expect(POST(makeRequest("/api/push/subscribe", subBody))).rejects.toThrow("db down");
  });

  it("不正な JSON は400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const bad = new NextRequest("http://localhost/api/push/subscribe", { method: "POST", body: "{x" });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("CHILDも購読登録できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.pushSubscription.create.mockResolvedValue(pushSubscription({ userId: "child-1" }));

    const res = await POST(makeRequest("/api/push/subscribe", subBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.pushSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: "child-1",
        endpoint: subBody.endpoint,
        p256dh: subBody.keys.p256dh,
        auth: subBody.keys.auth,
      },
    });
  });
});
