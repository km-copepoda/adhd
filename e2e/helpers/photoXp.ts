/**
 * 写真付き報告・XP 検証用ヘルパー（Issue #223）
 *
 * 方針は testData.ts と同じ: 公開 API だけを使い、2xx 以外は status と本文を含めて throw する。
 */
import { deflateSync } from "zlib";
import type { APIRequestContext } from "@playwright/test";
import { getBypassHeaders } from "../credentials";
import { EVOLUTION_THRESHOLDS, REBIRTH_EGG_THRESHOLD } from "../../src/lib/evolution";
import {
  approveQuest,
  callApi,
  createTodayTask,
  getTodayQuestByTitle,
  reportQuest,
} from "./testData";

export type ChildPoints = { studyPt: number; staminaPt: number; lifePt: number };

type FamilyMember = {
  id: string;
  reportDeadlineTime?: string | null;
  studyPt?: number;
  staminaPt?: number;
  lifePt?: number;
  evolutionStage?: number;
  rebirthPending?: boolean;
  collectedPaths?: string;
};

async function getMember(parentReq: APIRequestContext, childId: string): Promise<FamilyMember> {
  const data = await callApi<{ members?: FamilyMember[] }>(parentReq, "GET", "/api/family/code");
  const member = (data.members ?? []).find((m) => m.id === childId);
  if (!member) {
    throw new Error(`[photoXp] 家族メンバーに childId=${childId} が見つかりません`);
  }
  return member;
}

/** 親セッション。value は "HH:mm"（JST）または null（期限なし）。2xx 以外は throw。 */
export async function setReportDeadline(
  parentReq: APIRequestContext,
  childId: string,
  value: string | null,
): Promise<void> {
  await callApi(parentReq, "PATCH", "/api/family/settings", { childId, reportDeadlineTime: value });
}

/** 親セッション。対象の子の reportDeadlineTime を返す。子が見つからなければ throw。 */
export async function getReportDeadline(
  parentReq: APIRequestContext,
  childId: string,
): Promise<string | null> {
  return (await getMember(parentReq, childId)).reportDeadlineTime ?? null;
}

/** 親セッション。承認の前後で呼び、差分で XP を検証する（絶対値は他 spec の影響を受ける）。 */
export async function getChildPoints(
  parentReq: APIRequestContext,
  childId: string,
): Promise<ChildPoints> {
  const m = await getMember(parentReq, childId);
  return { studyPt: m.studyPt ?? 0, staminaPt: m.staminaPt ?? 0, lifePt: m.lifePt ?? 0 };
}

/** 1 回の承認で付く XP の最大値（基本 1 + 期限 1 + 写真 1）。 */
const MAX_XP_PER_APPROVAL = 3;
const MAX_FILLER_APPROVALS = 12;

/**
 * 承認で pt が進化閾値に達すると pt が 0 にリセットされ、差分で XP を検証できなくなる。
 * テストの前に 1 回の承認（最大 3pt）で進化・転生判定に届かない状態にしておく。
 * 届きそうなら捨てクエストを承認して進化させる（転生待ちは XP 加算のみなので対象外）。
 */
export async function ensureXpHeadroom(
  parentReq: APIRequestContext,
  childReq: APIRequestContext,
  childId: string,
): Promise<void> {
  for (let i = 0; i < MAX_FILLER_APPROVALS; i++) {
    const m = await getMember(parentReq, childId);
    if (m.rebirthPending) return;
    const stage = m.evolutionStage ?? 0;
    const reborn = (JSON.parse(m.collectedPaths ?? "[]") as string[]).length > 0;
    const threshold =
      stage === 0 && reborn
        ? REBIRTH_EGG_THRESHOLD
        : EVOLUTION_THRESHOLDS[Math.min(stage, EVOLUTION_THRESHOLDS.length - 1)];
    const total = (m.studyPt ?? 0) + (m.staminaPt ?? 0) + (m.lifePt ?? 0);
    if (threshold === null || total + MAX_XP_PER_APPROVAL < threshold) return;

    const { title } = await createTodayTask(parentReq, { childId, category: "STUDY", tag: "s2xfill" });
    const quest = await getTodayQuestByTitle(childReq, title);
    await reportQuest(childReq, quest.id);
    await approveQuest(parentReq, quest.id, { action: "approve" });
  }
  throw new Error("[photoXp] ensureXpHeadroom: 進化の余裕を作れませんでした");
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 指定サイズの単色 PNG（RGB 8bit）。幅・高さは 1 以上の整数でなければ throw。 */
export function makePngBuffer(width: number, height: number): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`[photoXp] makePngBuffer: 幅・高さは 1 以上の整数にしてください（${width}x${height}）`);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const row = Buffer.alloc(1 + width * 3); // filter byte 0 + 単色ピクセル
  for (let x = 0; x < width; x++) row.set([0x4a, 0x90, 0xd9], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 子セッション。POST /api/quests/[id]/report。2xx 以外でも throw せず status を返す。 */
export async function postReportRaw(
  childReq: APIRequestContext,
  questId: string,
  body: { photoUrl?: string | null; comment?: string | null },
): Promise<{ status: number; body: string }> {
  const res = await childReq.fetch(`/api/quests/${questId}/report`, {
    method: "POST",
    headers: getBypassHeaders(),
    data: body,
  });
  return { status: res.status(), body: await res.text() };
}
