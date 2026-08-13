import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/monster/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../../helpers/fixtures";

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 図鑑描画に必要な side / collectedPaths / monsterLevels / usedEggBonuses を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        side: "LIGHT",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        collectedPaths: '["STUDY","STUDY_STUDY"]',
        monsterLevels: '{"STUDY_STUDY_STUDY":2}',
        usedEggBonuses: '["STUDY"]',
      }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.side).toBe("LIGHT");
    expect(json.collectedPaths).toBe('["STUDY","STUDY_STUDY"]');
    expect(json.monsterLevels).toBe('{"STUDY_STUDY_STUDY":2}');
    expect(json.usedEggBonuses).toBe('["STUDY"]');
  });
});
