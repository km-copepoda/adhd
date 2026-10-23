/**
 * E2E テストデータ準備ヘルパー（Issue #221）
 *
 * 公開 API だけでテストデータを準備する（E2E 専用 API・DB 直接書き換えは使わない）。
 * 準備に失敗したら skip ではなく throw し、テストを fail させる。
 *
 * 方針:
 * - 公開 API（/api/tasks, /api/quests/*, /api/approve/[id], /api/gathering/*, /api/family/code）だけを使う。
 * - 各 API 呼び出しには getBypassHeaders() を付け、2xx 以外は status と本文を含めて throw する（skip に逃がさない）。
 * - 状態遷移は CLAUDE.md のステータス遷移規約の経路のみ
 *   （APPROVED は PENDING -> REPORTED -> APPROVED、SKIPPED は PENDING -> SKIP_REPORTED -> SKIPPED）。
 * - 日付はクライアントで計算しない。サーバ応答（targetDate 等）を使い、エラーメッセージに作成時刻を入れる。
 * - 前提: 子に reportDeadlineTime は設定されていない（XP が報告時刻で変わらない）。
 * - FREE プランの家族で使うとタスク数の上限に当たりうる（本 Issue の対象外）。
 * - タイトルは 32 文字以内（/api/tasks の制約）かつ、同一実行内・--repeat-each でも衝突しない。
 * - 後片付け（タスク削除）はしない。作成物はテスト用 QA アカウント内に閉じ、タイトルが毎回一意なため。
 */
import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import path from "path";
import { getE2EBaseUrl } from "../baseUrl";
import { AUTH_DIR, getBypassHeaders, readCredentials } from "../credentials";

export type QuestStatus =
  | "PENDING"
  | "REPORTED"
  | "SKIP_REPORTED"
  | "APPROVED"
  | "REJECTED"
  | "SKIPPED";

export type ChildMember = {
  id: string;
  role: string;
  name?: string | null;
  monsterName?: string | null;
};

/** 親・子それぞれのセッションを持つ APIRequestContext の束。使い終わったら dispose() する。 */
export type Sessions = {
  parentReq: APIRequestContext;
  childReq: APIRequestContext;
  /** child-light.json のセッションに対応する子（qa-credentials.json の childIdLight） */
  childId: string;
  dispose: () => Promise<void>;
};

export type SeededQuest = {
  taskId: string;
  questId: string;
  title: string;
  childId: string;
};

export type TodayQuest = { id: string; status: QuestStatus; title: string };

const DEFAULT_REJECTION_REASON = "もう一度やってみよう";
const TITLE_MAX = 32;

/** 2xx 以外なら status と本文を含めて throw し、2xx なら JSON を返す。 */
async function callApi<T = unknown>(
  req: APIRequestContext,
  method: "GET" | "POST",
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await req.fetch(url, {
    method,
    headers: getBypassHeaders(),
    ...(data === undefined ? {} : { data }),
  });
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(`[testData] ${method} ${url} が失敗しました（status=${res.status()}）: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

/** `E2E_<tag>_<一意な接尾辞>` を返す（32 文字以内。呼ぶたびに異なる値）。 */
export function uniqueTitle(tag: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const prefix = `E2E_${tag}_`.slice(0, TITLE_MAX - suffix.length);
  return `${prefix}${suffix}`;
}

/** parent.json / child-light.json から APIRequestContext を作る。dispose() を忘れないこと。 */
export async function openSessions(): Promise<Sessions> {
  const baseURL = getE2EBaseUrl();
  const parentReq = await playwrightRequest.newContext({
    baseURL,
    storageState: path.join(AUTH_DIR, "parent.json"),
  });
  const childReq = await playwrightRequest.newContext({
    baseURL,
    storageState: path.join(AUTH_DIR, "child-light.json"),
  });
  return {
    parentReq,
    childReq,
    childId: readCredentials().childIdLight,
    dispose: async () => {
      await parentReq.dispose();
      await childReq.dispose();
    },
  };
}

/** 親セッション。GET /api/family/code の members のうち role=CHILD。0 件なら throw。 */
export async function getChildMembers(parentReq: APIRequestContext): Promise<ChildMember[]> {
  const data = await callApi<{ members?: ChildMember[] }>(parentReq, "GET", "/api/family/code");
  const children = (data.members ?? []).filter((m) => m.role === "CHILD");
  if (children.length === 0) {
    throw new Error("[testData] 家族に子供アカウントがありません（auth.setup.ts が作成するはずです）");
  }
  return children;
}

type TaskOpts = {
  childId: string;
  title?: string;
  tag?: string;
  category?: string;
  emoji?: string;
};

type TaskResponse = { id: string; title: string; targetDate?: string | null };

async function postTask(
  parentReq: APIRequestContext,
  opts: TaskOpts,
  extra: Record<string, unknown>,
): Promise<TaskResponse> {
  return callApi<TaskResponse>(parentReq, "POST", "/api/tasks", {
    title: opts.title ?? uniqueTitle(opts.tag ?? "task"),
    emoji: opts.emoji ?? "⚔️",
    category: opts.category ?? "LIFE",
    assignedChildId: opts.childId,
    ...extra,
  });
}

/** 親セッション。POST /api/tasks（isTemporary: true）。title 省略時は uniqueTitle(tag ?? "task")。 */
export async function createTodayTask(
  parentReq: APIRequestContext,
  opts: TaskOpts & { photoBonus?: boolean },
): Promise<{ taskId: string; title: string; targetDate: string | null }> {
  const task = await postTask(parentReq, opts, {
    isTemporary: true,
    ...(opts.photoBonus ? { photoBonus: true } : {}),
  });
  return { taskId: task.id, title: task.title, targetDate: task.targetDate ?? null };
}

/** 親セッション。POST /api/tasks（毎日繰り返す通常タスク）。編集・削除 UI の検証用。 */
export async function createRecurringTask(
  parentReq: APIRequestContext,
  opts: TaskOpts,
): Promise<{ taskId: string; title: string }> {
  const task = await postTask(parentReq, opts, { repeatDays: [0, 1, 2, 3, 4, 5, 6] });
  return { taskId: task.id, title: task.title };
}

/** 子セッション。GET /api/quests/today から title 一致を探す。無ければ throw。 */
export async function getTodayQuestByTitle(
  childReq: APIRequestContext,
  title: string,
): Promise<TodayQuest> {
  const quests = await callApi<{ id: string; status: QuestStatus; template: { title: string } }[]>(
    childReq,
    "GET",
    "/api/quests/today",
  );
  const found = quests.find((q) => q.template.title === title);
  if (!found) {
    throw new Error(
      `[testData] 今日のクエストに「${title}」が見つかりません（取得時刻=${new Date().toISOString()}、件数=${quests.length}）`,
    );
  }
  return { id: found.id, status: found.status, title };
}

/** 子セッション。POST /api/quests/[id]/report（PENDING|REJECTED -> REPORTED）。 */
export async function reportQuest(childReq: APIRequestContext, questId: string): Promise<void> {
  await callApi(childReq, "POST", `/api/quests/${questId}/report`, { comment: "E2E 報告" });
}

/** 子セッション。POST /api/quests/[id]/skip（PENDING|REJECTED -> SKIP_REPORTED）。 */
export async function requestSkip(
  childReq: APIRequestContext,
  questId: string,
  reason: string,
): Promise<void> {
  await callApi(childReq, "POST", `/api/quests/${questId}/skip`, { comment: reason });
}

/**
 * 親セッション。POST /api/approve/[id]（kind=quest）。
 * REPORTED: approve -> APPROVED / reject -> REJECTED（rejectionReason 必須。省略時は固定値）
 * SKIP_REPORTED: approve -> SKIPPED / reject -> PENDING
 */
export async function approveQuest(
  parentReq: APIRequestContext,
  questId: string,
  opts: { action: "approve" | "reject"; rejectionReason?: string },
): Promise<void> {
  await callApi(parentReq, "POST", `/api/approve/${questId}`, {
    kind: "quest",
    action: opts.action,
    ...(opts.action === "reject"
      ? { rejectionReason: opts.rejectionReason ?? DEFAULT_REJECTION_REASON }
      : {}),
  });
}

/** 親+子。指定状態のクエストを 1 件作る（タスク作成 -> 今日のクエスト取得 -> 規約どおりの遷移）。 */
export async function seedQuestInStatus(
  sessions: Sessions,
  status: QuestStatus,
  opts?: { tag?: string; title?: string },
): Promise<SeededQuest> {
  const { parentReq, childReq, childId } = sessions;
  const { taskId, title } = await createTodayTask(parentReq, {
    childId,
    tag: opts?.tag,
    title: opts?.title,
  });
  const quest = await getTodayQuestByTitle(childReq, title);
  if (quest.status !== "PENDING") {
    throw new Error(`[testData] 作成直後のクエストが PENDING ではありません（status=${quest.status}）`);
  }

  switch (status) {
    case "PENDING":
      break;
    case "REPORTED":
      await reportQuest(childReq, quest.id);
      break;
    case "APPROVED":
      await reportQuest(childReq, quest.id);
      await approveQuest(parentReq, quest.id, { action: "approve" });
      break;
    case "REJECTED":
      await reportQuest(childReq, quest.id);
      await approveQuest(parentReq, quest.id, { action: "reject" });
      break;
    case "SKIP_REPORTED":
      await requestSkip(childReq, quest.id, "E2E スキップ");
      break;
    case "SKIPPED":
      await requestSkip(childReq, quest.id, "E2E スキップ");
      await approveQuest(parentReq, quest.id, { action: "approve" });
      break;
  }
  return { taskId, questId: quest.id, title, childId };
}

/** 子セッション。GET /api/gathering/current が非 null なら POST /api/gathering/leave。 */
export async function leaveGatheringIfJoined(childReq: APIRequestContext): Promise<void> {
  const current = await callApi<unknown>(childReq, "GET", "/api/gathering/current");
  if (current) {
    await callApi(childReq, "POST", "/api/gathering/leave");
  }
}
