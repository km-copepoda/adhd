import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/gathering/current/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeGetRequest(url: string) {
  return new Request(`http://localhost${url}`, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/gathering/current", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/gathering/current"));
    expect(res.status).toBe(401);
  });

  it("子供: グループ未参加はnull", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/gathering/current"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("子供: グループ参加中は members 配列を含む", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: {
        id: "g-1",
        location: "PARK",
        secretWord: "テスト",
        _count: { members: 2 },
        members: [
          {
            child: {
              id: "child-1",
              name: "太郎",
              monsterName: "ドラゴン",
              evolutionStage: 2,
              evolutionPath: "STUDY_STUDY",
              monsterSetId: "dark",
            },
          },
          {
            child: {
              id: "child-2",
              name: "花子",
              monsterName: null,
              evolutionStage: 0,
              evolutionPath: "",
              monsterSetId: "light",
            },
          },
        ],
      },
    } as never);

    const res = await GET(makeGetRequest("/api/gathering/current"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.groupId).toBe("g-1");
    expect(data.location).toBe("PARK");
    expect(data.memberCount).toBe(2);
    expect(data.members).toHaveLength(2);

    const me = data.members.find((m: { id: string }) => m.id === "child-1");
    expect(me).toBeDefined();
    // 本名(name)はAPIレスポンスから除去（プライバシー: 他ファミリーに本名を晒さない）
    expect(me.name).toBeUndefined();
    expect(me.monsterName).toBe("ドラゴン");
    expect(me.isMe).toBe(true);
    expect(me.monsterImage).toContain("STUDY_STUDY");
    expect(typeof me.speciesName).toBe("string");
    expect(me.speciesName.length).toBeGreaterThan(0);

    const other = data.members.find((m: { id: string }) => m.id === "child-2");
    expect(other.name).toBeUndefined();
    expect(other.isMe).toBe(false);
    expect(other.monsterImage).toContain("egg.webp");
    expect(other.monsterImage).toContain("light");
    expect(typeof other.speciesName).toBe("string");
    expect(other.speciesName.length).toBeGreaterThan(0);
  });

  it("子供: monsterName あり → monsterName をそのまま返す（name フィールドは存在しない）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: {
        id: "g-1",
        location: "PARK",
        secretWord: "テスト",
        _count: { members: 1 },
        members: [
          {
            child: {
              id: "child-1",
              name: null,
              monsterName: "ドラちゃん",
              evolutionStage: 2,
              evolutionPath: "STUDY",
              monsterSetId: "dark",
            },
          },
        ],
      },
    } as never);

    const res = await GET(makeGetRequest("/api/gathering/current"));
    const data = await res.json();
    expect(data.members[0].name).toBeUndefined();
    expect(data.members[0].monsterName).toBe("ドラちゃん");
    expect(typeof data.members[0].speciesName).toBe("string");
    expect(data.members[0].speciesName.length).toBeGreaterThan(0);
  });

  it("子供: monsterName=null → monsterName は種族名にフォールバック ('なまえなし' は使わない)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: {
        id: "g-1",
        location: "PARK",
        secretWord: "テスト",
        _count: { members: 1 },
        members: [
          {
            child: {
              id: "child-1",
              name: null,
              monsterName: null,
              evolutionStage: 0,
              evolutionPath: "",
              monsterSetId: "dark",
            },
          },
        ],
      },
    } as never);

    const res = await GET(makeGetRequest("/api/gathering/current"));
    const data = await res.json();
    expect(data.members[0].name).toBeUndefined();
    expect(data.members[0].monsterName).not.toBe("なまえなし");
    expect(typeof data.members[0].monsterName).toBe("string");
    expect(data.members[0].monsterName.length).toBeGreaterThan(0);
    // monsterName=null だったので種族名にフォールバック → speciesName と一致
    expect(data.members[0].monsterName).toBe(data.members[0].speciesName);
  });

  it("親: childId未指定はnull", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await GET(makeGetRequest("/api/gathering/current"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("親: 他ファミリーの子供は404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/gathering/current?childId=other-child"));
    expect(res.status).toBe(404);
  });

  it("親: 自分のファミリーの子供のグループ + members を返す（誰もisMe=trueにならない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "child-1" } as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
      group: {
        id: "g-1",
        location: "SCHOOL",
        secretWord: "シュー",
        _count: { members: 1 },
        members: [
          {
            child: {
              id: "child-1",
              name: "太郎",
              monsterName: "ドラゴン",
              evolutionStage: 1,
              evolutionPath: "STUDY",
              monsterSetId: "dark",
            },
          },
        ],
      },
    } as never);

    const res = await GET(makeGetRequest("/api/gathering/current?childId=child-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.location).toBe("SCHOOL");
    expect(data.members).toHaveLength(1);
    expect(data.members[0].isMe).toBe(false);
  });
});
