import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, TreasureUseStatus } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  approveQuestInstance,
  approveSkipQuestInstance,
  approveTreasureUse,
} from "@/lib/approve";
import { canApproveUse } from "@/lib/treasureUse";
import { routeLogger } from "@/lib/logger";

type BulkItem = { kind: "quest" | "treasure_use"; id: string };

type BulkQuest = Prisma.QuestInstanceGetPayload<{ include: { template: true; child: true } }>;

type FetchedItem =
  | { kind: "quest"; id: string; quest: BulkQuest | null }
  | { kind: "treasure_use"; id: string; log: { id: string; useStatus: TreasureUseStatus } | null };

/**
 * リクエストボディから承認対象アイテムの一覧を組み立てる。
 * 旧 `{ ids: string[] }` 形式は quest 専用として後方互換維持する。
 */
function parseItems(body: unknown): BulkItem[] | null {
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)) {
    const items = (body as { items: unknown[] }).items;
    const parsed: BulkItem[] = [];
    for (const raw of items) {
      if (
        !raw ||
        typeof raw !== "object" ||
        ((raw as { kind?: unknown }).kind !== "quest" && (raw as { kind?: unknown }).kind !== "treasure_use") ||
        typeof (raw as { id?: unknown }).id !== "string"
      ) {
        return null;
      }
      parsed.push(raw as BulkItem);
    }
    return parsed;
  }
  if (body && typeof body === "object" && Array.isArray((body as { ids?: unknown }).ids)) {
    const ids = (body as { ids: unknown[] }).ids;
    if (!ids.every((id) => typeof id === "string")) return null;
    return (ids as string[]).map((id) => ({ kind: "quest" as const, id }));
  }
  return [];
}

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/approve/bulk");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    rlog.warn("Unauthorized bulk approve attempt", { userId: user?.id });
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();
  const items = parseItems(body);
  if (items === null) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  // 重複 (kind, id) は不正リクエストとして扱う
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) {
      return NextResponse.json({ error: "重複したアイテムが含まれています" }, { status: 400 });
    }
    seen.add(key);
  }

  rlog.info("Bulk approve started", { userId: user.id, total: items.length });

  // ── Step 1: 全対象を family スコープ付きで取得する（1件ずつ）
  const fetched: FetchedItem[] = [];
  for (const item of items) {
    if (item.kind === "quest") {
      const quest = await prisma.questInstance.findUnique({
        where: { id: item.id },
        include: { template: true, child: true },
      });
      fetched.push({ kind: "quest", id: item.id, quest });
    } else {
      const log = await prisma.treasureLog.findFirst({
        where: { id: item.id, child: { familyId: user.familyId } },
        select: { id: true, useStatus: true },
      });
      fetched.push({ kind: "treasure_use", id: item.id, log });
    }
  }

  // ── Step 2: 1件でも不明ID・他家庭ID・不正状態があれば全体を 400（all-or-nothing）
  for (const f of fetched) {
    if (f.kind === "quest") {
      const quest = f.quest;
      if (!quest || quest.template.familyId !== user.familyId || quest.child.familyId !== user.familyId) {
        return NextResponse.json({ error: `クエストが見つかりません: ${f.id}` }, { status: 400 });
      }
      if (quest.status !== "REPORTED" && quest.status !== "SKIP_REPORTED") {
        return NextResponse.json({ error: `操作できないクエストです: ${f.id}` }, { status: 400 });
      }
    } else {
      if (!f.log || !canApproveUse(f.log.useStatus)) {
        return NextResponse.json({ error: `承認できないごほうび申請です: ${f.id}` }, { status: 400 });
      }
    }
  }

  // ── Step 3: 全件処理。並列処理するとXPのread-modify-writeがレース状態になるため、順次処理する
  let count = 0;
  for (const f of fetched) {
    if (f.kind === "quest") {
      const quest = f.quest!;
      if (quest.status === "SKIP_REPORTED") {
        await approveSkipQuestInstance(quest);
      } else {
        await approveQuestInstance(quest);
      }
    } else {
      await approveTreasureUse(f.id);
    }
    count++;
  }

  rlog.done("Bulk approve completed", { userId: user.id, approved: count });
  return NextResponse.json({ ok: true, count });
}
