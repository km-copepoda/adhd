import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/gathering/join/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/gathering/join", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "テスト" }));
    expect(res.status).toBe(401);
  });

  it("PARENTは401", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "テスト" }));
    expect(res.status).toBe(401);
  });

  it("不正な場所は400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    const res = await POST(makeRequest("/api/gathering/join", { location: "INVALID", secretWord: "テスト" }));
    expect(res.status).toBe(400);
  });

  it("合言葉が空は400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    const res = await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "   " }));
    expect(res.status).toBe(400);
  });

  it("すでに別グループに参加中は409", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-existing" } as never);
    const res = await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "テスト" }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("すでに");
  });

  it("満員の場合は409", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.gatheringGroup.upsert).mockResolvedValue({
      id: "g-1",
      location: "PARK",
      secretWord: "テスト",
      createdAt: new Date(),
      _count: { members: 10 }, // 公園は10人満員
    } as never);
    const res = await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "テスト" }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("満員");
  });

  it("正常に参加できる（新規グループ作成）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.gatheringGroup.upsert).mockResolvedValue({
      id: "g-1",
      location: "PARK",
      secretWord: "テスト",
      createdAt: new Date(),
      _count: { members: 3 },
    } as never);
    vi.mocked(prisma.gatheringMember.create).mockResolvedValue({
      id: "m-1",
      groupId: "g-1",
      childId: "child-1",
      joinedAt: new Date(),
    } as never);

    const res = await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "テスト" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.groupId).toBe("g-1");
  });

  it("合言葉がひらがなの場合カタカナに正規化してupsertされる", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.gatheringGroup.upsert).mockResolvedValue({
      id: "g-1",
      _count: { members: 0 },
    } as never);
    vi.mocked(prisma.gatheringMember.create).mockResolvedValue({ id: "m-1", groupId: "g-1" } as never);

    await POST(makeRequest("/api/gathering/join", { location: "PARK", secretWord: "ぱーく" }));

    expect(prisma.gatheringGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ location_secretWord: { location: "PARK", secretWord: "パーク" } }),
      }),
    );
  });
});
