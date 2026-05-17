import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/quests/today/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-12T09:00:00Z")); // JST 2026-03-12 木曜
});

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/quests/today?childId=${childId}`
    : "http://localhost/api/parent/child-view/quests/today";
  return new Request(url);
}

describe("GET /api/parent/child-view/quests/today", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールでアクセスした場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId が指定されていない場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定した場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 指定した子のクエスト一覧を返す（snapshot 優先）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: "20:00" }) as any,
    );
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      {
        id: "q1",
        snapshotTitle: "宿題",
        snapshotEmoji: "📚",
        snapshotCategory: "STUDY",
        template: { id: "tpl-1", title: "old", emoji: "?", category: "LIFE" },
      },
    ] as any);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].template.title).toBe("宿題");
    expect(json[0].template.emoji).toBe("📚");
    expect(json[0].template.category).toBe("STUDY");
    expect(json[0].hasDeadline).toBe(true);
  });

  it("子供のクエストを子供ID で検索すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-3" }) as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET(makeReq("child-3"));

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ childId: "child-3" }),
      }),
    );
  });

  it("reportDeadlineTime が null の子供は hasDeadline=false", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ reportDeadlineTime: null }) as any,
    );
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { id: "q1", template: { id: "t1", title: "x", emoji: "?", category: "STUDY" } },
    ] as any);

    const res = await GET(makeReq("child-1"));
    const json = await res.json();
    expect(json[0].hasDeadline).toBe(false);
  });
});
