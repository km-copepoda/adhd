import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/cron/quest-time-notify/route";
import { prisma } from "@/lib/prisma";
import { sendPushToChild } from "@/lib/push";

const mockPrisma = vi.mocked(prisma);
const mockSendPush = vi.mocked(sendPushToChild);

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request("http://localhost/api/cron/quest-time-notify", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});

describe("GET /api/cron/quest-time-notify", () => {
  it("CRON_SECRET が一致しない場合 401 を返すこと", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("Authorization ヘッダーが無い場合 401 を返すこと", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("CHILD ロールのみを対象にすること（PARENT は対象外）", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await GET(makeRequest("test-secret"));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "CHILD" }),
      }),
    );
  });

  it("questTimeNotifyEnabled=false の子供は除外されること", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await GET(makeRequest("test-secret"));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ questTimeNotifyEnabled: true }),
      }),
    );
  });

  it("PENDING/REJECTED が残っている子供に Push を送ること", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1" },
    ] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { status: "PENDING" },
      { status: "PENDING" },
      { status: "APPROVED" }, // 進捗 1/3
    ] as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith(
      "child-1",
      expect.objectContaining({
        title: expect.stringContaining("クエストタイム"),
        body: expect.any(String),
        url: "/app/child/quests",
      }),
    );
    expect(body.notified).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it("全クエスト完了済み(100%)の子供には Push を送らずスキップ件数を増やすこと", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1" },
    ] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { status: "APPROVED" },
      { status: "APPROVED" },
      { status: "SKIPPED" },
    ] as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(body.notified).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it("今日のクエストが0件の子供には Push を送らずスキップすること", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1" },
    ] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(body.skipped).toBe(1);
  });

  it("複数の子供がそれぞれ独立して判定されること", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1" },
      { id: "child-2" },
      { id: "child-3" },
    ] as any);
    mockPrisma.questInstance.findMany.mockImplementation(((args: any) => {
      const childId = args?.where?.childId;
      if (childId === "child-1") {
        // 進捗 0/2 → 送信
        return Promise.resolve([
          { status: "PENDING" },
          { status: "PENDING" },
        ] as any);
      }
      if (childId === "child-2") {
        // 100% 完了 → スキップ
        return Promise.resolve([
          { status: "APPROVED" },
        ] as any);
      }
      // child-3: クエスト0件 → スキップ
      return Promise.resolve([] as any);
    }) as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith("child-1", expect.any(Object));
    expect(body.notified).toBe(1);
    expect(body.skipped).toBe(2);
  });
});
