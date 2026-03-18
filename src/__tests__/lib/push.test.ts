import { describe, it, expect, vi, beforeEach } from "vitest";

// setup.ts が @/lib/push をグローバルモックしているため、実装をテストするためにアンモック
vi.unmock("@/lib/push");

import { sendPushToChild } from "@/lib/push";
import { prisma } from "@/lib/prisma";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = "test-pub";
  process.env.VAPID_PRIVATE_KEY = "test-priv";
});

describe("sendPushToChild", () => {
  it("子供のsubscriptionが存在する場合、通知を送信すること", async () => {
    const subs = [
      { id: "sub-1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1" },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as any);

    const webpush = (await import("web-push")).default;

    await sendPushToChild("child-1", { title: "テスト", body: "宿題をやろう！" });

    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: "child-1" },
    });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: subs[0].endpoint, keys: { p256dh: subs[0].p256dh, auth: subs[0].auth } },
      JSON.stringify({ title: "テスト", body: "宿題をやろう！" })
    );
  });

  it("subscriptionが存在しない場合、何も送らないこと", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([]);

    const webpush = (await import("web-push")).default;

    await sendPushToChild("child-1", { title: "テスト", body: "本文" });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("410 Gone エラーが返ったとき、subscriptionを削除すること", async () => {
    const subs = [
      { id: "sub-1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1" },
    ];
    mockPrisma.pushSubscription.findMany.mockResolvedValue(subs as any);
    mockPrisma.pushSubscription.delete.mockResolvedValue({} as any);

    const webpush = (await import("web-push")).default;
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });

    await sendPushToChild("child-1", { title: "テスト", body: "本文" });

    expect(mockPrisma.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: "sub-1" },
    });
  });

  it("VAPID未設定の場合、スキップすること", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const webpush = (await import("web-push")).default;

    await sendPushToChild("child-1", { title: "テスト", body: "本文" });

    expect(mockPrisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
