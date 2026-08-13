import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/quests/today/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import {
  parentUserWithFamily,
  childUserWithFamily,
  childUser,
  questInstance,
  taskTemplate,
  questDeclaration,
} from "../../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/**
 * `questInstance.findMany` の `include: { template: { select: {...taskStreaks...} } } }` 相当の
 * テストデータを構築する。
 *
 * `prismaMock`（DeepMockProxy）の `mockResolvedValue` は常にベースの QuestInstance 完全型を
 * 要求し、`include`/`select` によるリレーション拡張までは型チェックされない
 * （`src/__tests__/helpers/prisma-mock.ts` 参照）。そのためリレーション部分
 * （`template` とその `taskStreaks`）の型安全性はこのヘルパーの責務とし、実装
 * （`src/app/api/parent/child-view/quests/today/route.ts`）が実際に参照するフィールドを
 * 過不足なく埋める。
 */
function makeTodayQuest(
  overrides?: Parameters<typeof questInstance>[0],
  templateOverrides?: Parameters<typeof taskTemplate>[0],
  taskStreaks: { currentStreak: number; bestStreak: number }[] = [],
) {
  return {
    ...questInstance(overrides),
    template: { ...taskTemplate(templateOverrides), taskStreaks },
  };
}

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId が指定されていない場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("questInstance.findMany の where で date-branch / carryOver-branch 両方に template.pausedAt: null が入っていること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET(makeReq("child-1"));

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            expect.objectContaining({ template: expect.objectContaining({ pausedAt: null }) }),
            expect.objectContaining({ template: expect.objectContaining({ pausedAt: null, carryOver: true }) }),
          ],
        }),
      }),
    );
  });

  it("別 family の子を指定した場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 指定した子のクエスト一覧を返す（snapshot 優先）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", reportDeadlineTime: "20:00" }),
    );
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      makeTodayQuest(
        { id: "q1", snapshotTitle: "宿題", snapshotEmoji: "📚", snapshotCategory: "STUDY" },
        { id: "tpl-1", title: "old", emoji: "?", category: "LIFE" },
      ),
    ]);

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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-3" }));
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    await GET(makeReq("child-3"));

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ childId: "child-3" }),
      }),
    );
  });

  it("reportDeadlineTime が null の子供は hasDeadline=false", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ reportDeadlineTime: null }),
    );
    mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      // 旧テストは snapshot* フィールドを省略していた（= フォールバック分岐
      // `q.snapshotTitle ?? q.template.title` 等を通す）ため、明示的に undefined を指定して再現する。
      makeTodayQuest(
        { id: "q1", snapshotTitle: undefined, snapshotEmoji: undefined, snapshotCategory: undefined },
        { id: "t1", title: "x", emoji: "?", category: "STUDY" },
      ),
    ]);

    const res = await GET(makeReq("child-1"));
    const json = await res.json();
    expect(json[0].hasDeadline).toBe(false);
  });

  describe("declaredToday: 子供の今日やる宣言を親画面でも表示する", () => {
    it("当日の宣言レコードがあれば declaredToday=true を返す", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", reportDeadlineTime: "20:00" }),
      );
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
      mockPrisma.questInstance.findMany.mockResolvedValue([
        makeTodayQuest(
          {
            id: "q1",
            templateId: "tpl-1",
            childId: "child-1",
            status: "PENDING",
            snapshotTitle: undefined,
            snapshotEmoji: undefined,
            snapshotCategory: undefined,
          },
          { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY" },
        ),
      ]);
      mockPrisma.questDeclaration.findMany.mockResolvedValue([
        questDeclaration({ templateId: "tpl-1" }),
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json[0].declaredToday).toBe(true);
    });

    it("当日の宣言レコードが無ければ declaredToday=false を返す", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", reportDeadlineTime: "20:00" }),
      );
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
      mockPrisma.questInstance.findMany.mockResolvedValue([
        makeTodayQuest(
          {
            id: "q1",
            templateId: "tpl-1",
            childId: "child-1",
            status: "PENDING",
            snapshotTitle: undefined,
            snapshotEmoji: undefined,
            snapshotCategory: undefined,
          },
          { id: "tpl-1", title: "宿題", emoji: "📚", category: "STUDY" },
        ),
      ]);
      mockPrisma.questDeclaration.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json[0].declaredToday).toBe(false);
    });

    it("テンプレートが無い場合は QuestDeclaration を検索しない", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", reportDeadlineTime: null }),
      );
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      expect(res.status).toBe(200);
      // 空配列なら declaration クエリを発行しないこと（無駄な DB アクセス回避）
      expect(mockPrisma.questDeclaration.findMany).not.toHaveBeenCalled();
    });
  });
});
