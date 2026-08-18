import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, PATCH } from "@/app/api/family/members/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { makeRequest } from "../../helpers/request";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/family/members", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/family/members", { monsterName: "test", side: "LIGHT" }));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeRequest("/api/family/members", { monsterName: "test", side: "LIGHT" }));
    expect(res.status).toBe(403);
  });

  it("familyIdがない場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await POST(makeRequest("/api/family/members", { monsterName: "test", side: "LIGHT" }));
    expect(res.status).toBe(403);
  });

  it("monsterNameがない場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/family/members", { side: "LIGHT" }));
    expect(res.status).toBe(400);
  });

  it("sideがない場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/family/members", { monsterName: "テスト" }));
    expect(res.status).toBe(400);
  });

  it("子どもアカウントを正常に作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(
      childUser({
        id: "child-new",
        monsterName: "リュウ",
        side: "DARK",
        childCode: "5678",
      }),
    );

    const res = await POST(makeRequest("/api/family/members", { monsterName: "リュウ", side: "DARK" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("child-new");
    expect(json.monsterName).toBe("リュウ");
    expect(json.side).toBe("DARK");
    expect(json.childCode).toBe("5678");
  });

  it("childCodeが重複する場合、リトライすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // 1回目: 既存あり, 2回目: なし
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(childUser({ id: "existing" }))
      .mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValue(
      childUser({
        id: "child-x",
        monsterName: "テスト",
        side: "LIGHT",
        childCode: "9999",
      }),
    );

    const res = await POST(makeRequest("/api/family/members", { monsterName: "テスト", side: "LIGHT" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("10回リトライしてもchildCodeが生成できない場合、500を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // 全10回とも既存あり
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ id: "existing" }));

    const res = await POST(makeRequest("/api/family/members", { monsterName: "テスト", side: "LIGHT" }));
    expect(res.status).toBe(500);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(10);
  });

  it("作成されるユーザーがplaceholder supabaseIdを持つこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(
      childUser({
        id: "child-1",
        monsterName: "テスト",
        side: "DARK",
        childCode: "1234",
      }),
    );

    await POST(makeRequest("/api/family/members", { monsterName: "テスト", side: "DARK" }));

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supabaseId: expect.stringContaining("pending_"),
        role: "CHILD",
        monsterName: "テスト",
        side: "DARK",
        familyId: "fam-1",
      }),
    });
  });

  it("side: DARKで作成した場合、monsterSetIdがdarkになること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(
      childUser({
        id: "child-dark",
        monsterName: "テスト",
        side: "DARK",
        monsterSetId: "dark",
        childCode: "1111",
      }),
    );

    await POST(makeRequest("/api/family/members", { monsterName: "テスト", side: "DARK" }));

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        side: "DARK",
        monsterSetId: "dark",
      }),
    });
  });

  it("side: LIGHTで作成した場合、monsterSetIdがlightになること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(
      childUser({
        id: "child-light",
        monsterName: "テスト",
        side: "LIGHT",
        monsterSetId: "light",
        childCode: "2222",
      }),
    );

    await POST(makeRequest("/api/family/members", { monsterName: "テスト", side: "LIGHT" }));

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        side: "LIGHT",
        monsterSetId: "light",
      }),
    });
  });
});

describe("PATCH /api/family/members", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest("/api/family/members", { childId: "c1", minTasksForStreak: 3 }, "PATCH"));
    expect(res.status).toBe(403);
  });

  it("minTasksForStreakが0以下なら400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await PATCH(makeRequest("/api/family/members", { childId: "c1", minTasksForStreak: 0 }, "PATCH"));
    expect(res.status).toBe(400);
  });

  it("存在しない子供IDで404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest("/api/family/members", { childId: "c-none", minTasksForStreak: 3 }, "PATCH"));
    expect(res.status).toBe(404);
  });

  it("minTasksForStreakを正常に更新できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser());
    mockPrisma.user.update.mockResolvedValue(childUser({ minTasksForStreak: 3 }));

    const res = await PATCH(makeRequest("/api/family/members", { childId: "child-1", minTasksForStreak: 3 }, "PATCH"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { minTasksForStreak: 3 },
    });
  });
});
