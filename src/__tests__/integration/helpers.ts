import { vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import type { QuestStatus } from "@/generated/prisma/client";

// 実Prismaクライアントを再エクスポート
export { prisma };

// ──────────────────────────────────────────────
// Auth ヘルパー
// ──────────────────────────────────────────────

/**
 * getCurrentUser() のモック返り値を設定する。
 * `AuthUser`（`User & { family: Family | null }`）を要求するため、呼び出し側は
 * `seedFamily()` で作った `family` を含めて渡す（`{ ...parent, family, role: "PARENT" }` 等）。
 */
export function mockAsUser(user: AuthUser) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

// ──────────────────────────────────────────────
// シードヘルパー
// ──────────────────────────────────────────────

export async function seedFamily() {
  const uid = crypto.randomUUID().slice(0, 8);

  const family = await prisma.family.create({
    data: { code: `T${uid}` },
  });

  const parent = await prisma.user.create({
    data: {
      supabaseId: `sb-p-${uid}`,
      role: "PARENT",
      name: "テスト親",
      familyId: family.id,
    },
  });

  const child = await prisma.user.create({
    data: {
      supabaseId: `sb-c-${uid}`,
      role: "CHILD",
      name: "テスト子",
      side: "LIGHT",
      monsterName: "テストモンスター",
      familyId: family.id,
      childCode: uid.slice(0, 4),
      minTasksForStreak: 1,
    },
  });

  return { family, parent, child };
}

export async function seedTask(familyId: string, overrides?: Record<string, unknown>) {
  return prisma.taskTemplate.create({
    data: {
      title: "テストタスク",
      emoji: "📚",
      category: "STUDY",
      repeatDays: [0, 1, 2, 3, 4, 5, 6], // 毎日
      familyId,
      ...overrides,
    },
  });
}

export async function seedQuestForDate(
  templateId: string,
  childId: string,
  date: Date,
  status: QuestStatus = "PENDING",
) {
  const template = await prisma.taskTemplate.findUniqueOrThrow({ where: { id: templateId } });
  return prisma.questInstance.create({
    data: {
      templateId,
      childId,
      date,
      status,
      snapshotTitle: template.title,
      snapshotEmoji: template.emoji,
      snapshotCategory: template.category,
    },
  });
}

// ──────────────────────────────────────────────
// クリーンアップ（テスト間分離）
// ──────────────────────────────────────────────

export async function cleanAll() {
  // 外部キー制約を考慮した削除順序
  await prisma.streak.deleteMany();
  await prisma.taskStreak.deleteMany();
  await prisma.questInstance.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.family.deleteMany();
}

// ──────────────────────────────────────────────
// リクエストビルダー（既存ユニットテストと同じパターン）
// ──────────────────────────────────────────────

export function makeRequest(path: string, body: Record<string, unknown>, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
  });
}

export function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}
