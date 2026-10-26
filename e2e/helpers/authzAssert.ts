/**
 * API 認可 spec（s30）用のアサーション・読み直しヘルパー（Issue #224）
 */
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect } from "../fixtures";
import { callApi, createTodayTask, type QuestStatus } from "./testData";

/** 未認証・ロール違いで許容するステータス */
export const DENIED_ROLE = [401, 403];
/** 他家族・他人のリソースで許容するステータス */
export const DENIED_OTHER = [403, 404];

/** 書き込み系: 指定した集合のどれかで拒否され、500 にならず、2xx でもない */
export async function expectDenied(res: APIResponse, allowed: number[]) {
  expect(res.status(), `status=${res.status()} body=${await res.text()}`).toBeLessThan(500);
  expect(res.ok(), "2xx にならない").toBe(false);
  expect(allowed, `status=${res.status()}`).toContain(res.status());
}

/** 読み取り系: 2xx 以外、または 2xx で空のデータ */
export async function expectNoData(res: APIResponse, empty: unknown) {
  expect(res.status(), `status=${res.status()}`).toBeLessThan(500);
  if (res.ok()) {
    expect(await res.json()).toEqual(empty);
  }
}

/** 親セッションで、子のクエストの今日の状態を読み直す */
export async function readQuestStatus(
  parentReq: APIRequestContext,
  childId: string,
  title: string,
): Promise<QuestStatus> {
  const quests = await callApi<{ id: string; status: QuestStatus; template: { title: string } }[]>(
    parentReq,
    "GET",
    `/api/parent/child-view/quests/today?childId=${childId}`,
  );
  const found = quests.find((q) => q.template.title === title);
  if (!found) throw new Error(`クエスト「${title}」が見つかりません（childId=${childId}）`);
  return found.status;
}

/** 親セッションから見たタスク一覧（JSON 文字列。含まれる／含まれないの確認用） */
export async function parentTasksJson(parentReq: APIRequestContext): Promise<string> {
  return JSON.stringify(await callApi(parentReq, "GET", "/api/tasks"));
}

/** 指定した子に今日の一時タスクを作り、その PENDING のクエストを返す（#221 の seedQuestInStatus は QA_child 専用のため） */
export async function seedPendingQuest(
  parentReq: APIRequestContext,
  childId: string,
  tag: string,
): Promise<{ taskId: string; questId: string; title: string }> {
  const t = await createTodayTask(parentReq, { childId, tag });
  const quests = await callApi<{ id: string; template: { title: string } }[]>(
    parentReq,
    "GET",
    `/api/parent/child-view/quests/today?childId=${childId}`,
  );
  const q = quests.find((x) => x.template.title === t.title);
  if (!q) throw new Error(`子 ${childId} のクエスト「${t.title}」が見つかりません`);
  return { taskId: t.taskId, questId: q.id, title: t.title };
}
