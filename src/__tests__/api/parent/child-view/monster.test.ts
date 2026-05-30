import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/monster/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/monster?childId=${childId}`
    : "http://localhost/api/parent/child-view/monster";
  return new Request(url);
}

describe("GET /api/parent/child-view/monster", () => {
  it("未認証で401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 図鑑描画に必要な side / collectedPaths / monsterLevels / usedEggBonuses を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        side: "LIGHT",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        collectedPaths: '["STUDY","STUDY_STUDY"]',
        monsterLevels: '{"STUDY_STUDY_STUDY":2}',
        usedEggBonuses: '["STUDY"]',
      }) as any,
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.side).toBe("LIGHT");
    expect(json.collectedPaths).toBe('["STUDY","STUDY_STUDY"]');
    expect(json.monsterLevels).toBe('{"STUDY_STUDY_STUDY":2}');
    expect(json.usedEggBonuses).toBe('["STUDY"]');
  });
});
