import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  triggerTaskProgressLog,
  triggerBadgeLog,
  triggerStreakTitleLog,
  triggerMonsterEvolvedLog,
  triggerMonsterRebornLog,
  triggerStampSentLog,
  triggerCollectionItemLog,
} from "@/lib/bulletinLog";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import {
  bulletinLog as bulletinLogFixture,
  childUser,
  gatheringMember,
} from "../helpers/fixtures";

/** `gatheringMember.findUnique` の select は `{ groupId: true }` だが、DeepMockProxy の
 * `mockResolvedValue` は select 付き部分型を受け付けないため完全なフィクスチャで代替する。 */
function groupIdOnly(groupId: string) {
  return gatheringMember({ groupId });
}

/** `user.findUnique` の select は `{ name: true, monsterName: true }` だが、同様の理由で
 * 完全な User フィクスチャで代替する（実装は name/monsterName のみ参照する）。 */
function nameOnly(name: string | null, monsterName: string | null) {
  return childUser({ name, monsterName });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triggerTaskProgressLog", () => {
  it("グループ未参加なら何も書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(null);
    await triggerTaskProgressLog("child-1");
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("name が null でも monsterName があれば monsterName で書き込む", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(2) // total
      .mockResolvedValueOnce(2); // done
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).toHaveBeenCalled();
    const firstCall = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(firstCall.data.message).toContain("ドラゴン");
  });

  it("name も monsterName も両方 null なら書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, null));

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("monsterName が優先される（プライバシー: 本名はグループ内に晒さない）", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly("鈴木太郎", "ドラゴン"));
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());

    await triggerTaskProgressLog("child-1");

    const firstCall = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(firstCall.data.message).toContain("ドラゴン");
    expect(firstCall.data.message).not.toContain("鈴木太郎");
  });

  it("当日タスク0件なら書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly("太郎", null));
    mockPrisma.questInstance.count.mockResolvedValueOnce(0); // total = 0

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("達成率に応じて複数のマイルストーンを書き込む", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "モンスタロウ"));
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(4) // total
      .mockResolvedValueOnce(4); // done = 100%
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());

    await triggerTaskProgressLog("child-1");

    // 100%達成時はSTART/25/50/75/100の5マイルストーンが書き込まれる
    expect(mockPrisma.bulletinLog.create).toHaveBeenCalledTimes(5);
  });
});

describe("triggerBadgeLog / triggerStreakTitleLog / triggerMonsterEvolvedLog / triggerMonsterRebornLog", () => {
  beforeEach(() => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());
  });

  it("triggerBadgeLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerBadgeLog("child-1", "はじめの一歩");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("はじめの一歩");
  });

  it("triggerStreakTitleLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerStreakTitleLog("child-1", "一週間の戦士");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("一週間の戦士");
  });

  it("triggerMonsterEvolvedLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerMonsterEvolvedLog("child-1", "フレアドラゴン");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("フレアドラゴン");
  });

  it("triggerMonsterRebornLog: monsterName fallback で書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerMonsterRebornLog("child-1", "べんきょう");

    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { message: string } };
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("べんきょう");
  });

  it("どのトリガーも name と monsterName が両方 null なら書き込まない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, null));
    await triggerBadgeLog("child-1", "はじめの一歩");
    await triggerStreakTitleLog("child-1", "一週間");
    await triggerMonsterEvolvedLog("child-1", "ドラゴン");
    await triggerMonsterRebornLog("child-1", "べんきょう");

    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("triggerBadgeLog: data.key にバッジ名をセット（同日に別バッジ複数件を許可するため）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerBadgeLog("child-1", "はじめの一歩");
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { key: string } };
    expect(call.data.key).toBe("はじめの一歩");
  });

  it("triggerStreakTitleLog: data.key に称号名をセット", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerStreakTitleLog("child-1", "一週間の戦士");
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { key: string } };
    expect(call.data.key).toBe("一週間の戦士");
  });

  it("triggerMonsterEvolvedLog: data.key に進化先モンスター名をセット", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerMonsterEvolvedLog("child-1", "フレアドラゴン");
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { key: string } };
    expect(call.data.key).toBe("フレアドラゴン");
  });

  it("triggerMonsterRebornLog: data.key に卵タイプをセット", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerMonsterRebornLog("child-1", "べんきょう");
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { key: string } };
    expect(call.data.key).toBe("べんきょう");
  });
});

describe("triggerStampSentLog", () => {
  beforeEach(() => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());
  });

  it("グループ未参加なら何も書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(null);
    await triggerStampSentLog("child-1");
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("name と monsterName が両方 null なら書き込まない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, null));
    await triggerStampSentLog("child-1");
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("monsterName を優先して STAMP_SENT を書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly("鈴木太郎", "ドラゴン"));
    await triggerStampSentLog("child-1");
    expect(mockPrisma.bulletinLog.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as {
      data: { type: string; message: string; key: string };
    };
    expect(call.data.type).toBe("STAMP_SENT");
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).not.toContain("鈴木太郎");
    expect(call.data.message).toContain("エール");
  });

  it("data.key は \"エール\" 固定（同日1回制約は Stamp 側で担保済みなので key で衝突は起きない）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerStampSentLog("child-1");
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as { data: { key: string } };
    expect(call.data.key).toBe("エール");
  });

  it("unique 違反は握りつぶす（同日に2回 trigger されても例外を投げない）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    mockPrisma.bulletinLog.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    await expect(triggerStampSentLog("child-1")).resolves.not.toThrow();
  });
});

describe("triggerTaskProgressLog: key", () => {
  it("data.key は空文字（同日マイルストーン重複は引き続き禁止）", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    mockPrisma.questInstance.count
      .mockResolvedValueOnce(4) // total
      .mockResolvedValueOnce(1); // done (TASK_STARTED only)
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());

    await triggerTaskProgressLog("child-1");

    expect(mockPrisma.bulletinLog.create).toHaveBeenCalled();
    const calls = mockPrisma.bulletinLog.create.mock.calls as Array<[{ data: { key: string } }]>;
    for (const [arg] of calls) {
      expect(arg.data.key).toBe("");
    }
  });
});

describe("triggerCollectionItemLog", () => {
  beforeEach(() => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(groupIdOnly("g-1"));
    mockPrisma.bulletinLog.create.mockResolvedValue(bulletinLogFixture());
  });

  it("グループ未参加なら何も書き込まない", async () => {
    mockPrisma.gatheringMember.findUnique.mockResolvedValue(null);
    await triggerCollectionItemLog("child-1", "summer-01", 1);
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("name も monsterName も null なら書き込まない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, null));
    await triggerCollectionItemLog("child-1", "summer-01", 1);
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });

  it("monsterName 優先で type=COLLECTION_ITEM_OBTAINED + アイテム名+季節+★ を含むメッセージを書き込む", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly("鈴木太郎", "ドラゴン"));
    await triggerCollectionItemLog("child-1", "summer-04", 1); // リュウグウノツカイ (RARE)
    expect(mockPrisma.bulletinLog.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.bulletinLog.create.mock.calls[0][0] as {
      data: { type: string; message: string; key: string };
    };
    expect(call.data.type).toBe("COLLECTION_ITEM_OBTAINED");
    expect(call.data.message).toContain("ドラゴン");
    expect(call.data.message).toContain("リュウグウノツカイ");
    expect(call.data.message).toContain("夏");
    expect(call.data.message).toContain("★★★");
    expect(call.data.message).not.toContain("鈴木太郎");
  });

  it("data.key に id+count をセット (同日に同じアイテムをダブり獲得しても uniq 制約と衝突しない)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerCollectionItemLog("child-1", "fall-04", 1);
    await triggerCollectionItemLog("child-1", "fall-04", 2);
    await triggerCollectionItemLog("child-1", "fall-04", 3);
    const keys = mockPrisma.bulletinLog.create.mock.calls.map(
      (c) => (c[0] as { data: { key: string } }).data.key,
    );
    expect(keys).toEqual(["fall-04#1", "fall-04#2", "fall-04#3"]);
  });

  it("未知の id は書き込みスキップ (message が空文字列なので writeBulletinLog が早期 return)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(nameOnly(null, "ドラゴン"));
    await triggerCollectionItemLog("child-1", "bogus-99", 1);
    expect(mockPrisma.bulletinLog.create).not.toHaveBeenCalled();
  });
});
