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
              side: "DARK",
            },
          },
          {
            child: {
              id: "child-2",
              name: "花子",
              monsterName: null,
              evolutionStage: 0,
              evolutionPath: "",
              side: "LIGHT",
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
    expect(me.name).toBe("太郎");
    expect(me.isMe).toBe(true);
    expect(me.monsterImage).toContain("STUDY_STUDY");

    const other = data.members.find((m: { id: string }) => m.id === "child-2");
    expect(other.isMe).toBe(false);
    expect(other.monsterImage).toContain("egg.webp");
    expect(other.monsterImage).toContain("light");
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
              side: "DARK",
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
