/**
 * 子セッションの GET /api/monster-status のスナップショット取得（Issue #222）。
 * XP・進化・ストリークを「前後の差分」で検証するために使う（絶対値は他 spec の影響を受ける）。
 */
import type { APIRequestContext } from "@playwright/test";
import { getBypassHeaders } from "../credentials";

export type MonsterSnapshot = {
  evolutionStage: number;
  rebirthPending: boolean;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  /** REPORTED（未承認）の見込み分。承認で減り、差し戻しで減る */
  pendingStudyPt: number;
  pendingStaminaPt: number;
  pendingLifePt: number;
  currentStreak: number;
  /** サーバ応答の "YYYY-MM-DD"（JST 日付）。未達成なら null */
  lastAchievedDate: string | null;
};

const NUMBER_KEYS = [
  "evolutionStage",
  "studyPt",
  "staminaPt",
  "lifePt",
  "pendingStudyPt",
  "pendingStaminaPt",
  "pendingLifePt",
  "currentStreak",
] as const;

/** 子セッション。2xx 以外・必須項目の欠落は status と本文を含めて throw する。 */
export async function getMonsterSnapshot(childReq: APIRequestContext): Promise<MonsterSnapshot> {
  const res = await childReq.fetch("/api/monster-status", {
    method: "GET",
    headers: getBypassHeaders(),
  });
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(`[monsterSnapshot] GET /api/monster-status が失敗しました（status=${res.status()}）: ${text}`);
  }
  const json = JSON.parse(text) as Record<string, unknown>;
  for (const key of NUMBER_KEYS) {
    if (typeof json[key] !== "number") {
      throw new Error(`[monsterSnapshot] ${key} が数値ではありません: ${text}`);
    }
  }
  if (typeof json.rebirthPending !== "boolean") {
    throw new Error(`[monsterSnapshot] rebirthPending が boolean ではありません: ${text}`);
  }
  const last = json.lastAchievedDate;
  if (last !== null && typeof last !== "string") {
    throw new Error(`[monsterSnapshot] lastAchievedDate が不正です: ${text}`);
  }
  return {
    evolutionStage: json.evolutionStage as number,
    rebirthPending: json.rebirthPending,
    studyPt: json.studyPt as number,
    staminaPt: json.staminaPt as number,
    lifePt: json.lifePt as number,
    pendingStudyPt: json.pendingStudyPt as number,
    pendingStaminaPt: json.pendingStaminaPt as number,
    pendingLifePt: json.pendingLifePt as number,
    currentStreak: json.currentStreak as number,
    lastAchievedDate: last,
  };
}
