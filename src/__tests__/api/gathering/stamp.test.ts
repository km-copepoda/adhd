import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/gathering/stamp/route";
import { GET as GET_TODAY } from "@/app/api/gathering/stamp/today/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToChild } from "@/lib/push";
import { makeRequest } from "../../helpers/request";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockSendPush = vi.mocked(sendPushToChild);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/gathering/stamp ────────────────────────────────────────────────
describe("POST /api/gathering/stamp", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/gathering/stamp", {}));
    expect(res.status).toBe(401);
  });

  it("PARENTは401（子供専用）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await POST(makeRequest("/api/gathering/stamp", {}));
    expect(res.status).toBe(401);
  });

  it("グループ未参加は404", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("/api/gathering/stamp", {}));
    expect(res.status).toBe(404);
  });

  it("既に今日送信済みは409", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: { members: [] },
    } as never);
    vi.mocked(prisma.stamp.findUnique).mockResolvedValue({ id: "s-1" } as never);
    const res = await POST(makeRequest("/api/gathering/stamp", {}));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("今日");
  });

  it("正常系: Stamp を INSERT し、自分以外の全メンバーに Push 配信", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1", monsterName: "ドラゴン" }) as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: {
        members: [
          { childId: "child-1" }, // 送信者自身
          { childId: "child-2" },
          { childId: "child-3" },
        ],
      },
    } as never);
    vi.mocked(prisma.stamp.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.stamp.create).mockResolvedValue({ id: "s-1" } as never);
    // 並行実行のため mockResolvedValueOnce では順序保証できないので一律 0 を返す
    vi.mocked(prisma.questInstance.count).mockResolvedValue(0);

    const res = await POST(makeRequest("/api/gathering/stamp", {}));
    expect(res.status).toBe(200);

    // Stamp 作成
    expect(prisma.stamp.create).toHaveBeenCalledTimes(1);
    expect(prisma.stamp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupId: "g-1", senderId: "child-1" }),
      }),
    );

    // 送信者自身には送られない、他2人にだけ送られる
    expect(mockSendPush).toHaveBeenCalledTimes(2);
    const pushedIds = mockSendPush.mock.calls.map((c) => c[0]);
    expect(pushedIds).toEqual(expect.arrayContaining(["child-2", "child-3"]));
    expect(pushedIds).not.toContain("child-1");
  });

  it("Push のペイロードは送信者名と状況別メッセージを含む", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1", monsterName: "ドラゴン", name: "たろう" }) as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: {
        members: [{ childId: "child-1" }, { childId: "child-2" }],
      },
    } as never);
    vi.mocked(prisma.stamp.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.stamp.create).mockResolvedValue({ id: "s-1" } as never);
    vi.mocked(prisma.questInstance.count)
      .mockResolvedValueOnce(3) // total
      .mockResolvedValueOnce(1); // done → IN_PROGRESS

    await POST(makeRequest("/api/gathering/stamp", {}));

    const payload = mockSendPush.mock.calls[0][1];
    // 送信者の monsterName を優先
    expect(payload.body).toContain("ドラゴン");
    expect(payload.body).toContain("エール");
    expect(payload.title).toBeTruthy();
  });

  it("ユニーク制約違反（race condition）でも409にフォールバック", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: { members: [{ childId: "child-1" }] },
    } as never);
    vi.mocked(prisma.stamp.findUnique).mockResolvedValue(null);
    // race: findUnique 後の create で unique violation
    vi.mocked(prisma.stamp.create).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const res = await POST(makeRequest("/api/gathering/stamp", {}));
    expect(res.status).toBe(409);
  });
});

// ─── GET /api/gathering/stamp/today ───────────────────────────────────────────
describe("GET /api/gathering/stamp/today", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET_TODAY();
    expect(res.status).toBe(401);
  });

  it("PARENTは401", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await GET_TODAY();
    expect(res.status).toBe(401);
  });

  it("今日まだ送ってないと sentToday=false", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.stamp.findUnique).mockResolvedValue(null);
    const res = await GET_TODAY();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sentToday).toBe(false);
  });

  it("今日送信済みなら sentToday=true", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.stamp.findUnique).mockResolvedValue({ id: "s-1" } as never);
    const res = await GET_TODAY();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sentToday).toBe(true);
  });
});
