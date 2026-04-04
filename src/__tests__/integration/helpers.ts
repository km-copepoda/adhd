import { vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 実Prismaクライアントを再エクスポート
export { prisma };

// ──────────────────────────────────────────────
// Auth ヘルパー
// ──────────────────────────────────────────────

type MockUser = {
  id: string;
  supabaseId: string;
  role: "PARENT" | "CHILD";
  name: string;
  familyId: string;
  side?: string | null;
  monsterName?: string | null;
  evolutionStage?: number;
  studyPt?: number;
  staminaPt?: number;
  lifePt?: number;
  minTasksForStreak?: number;
  family?: { id: string; code: string };
};

export function mockAsUser(user: MockUser) {
  vi.mocked(getCurrentUser).mockResolvedValue(user as any);
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
  status: string = "PENDING",
) {
  return prisma.questInstance.create({
    data: {
      templateId,
      childId,
      date,
      status: status as any,
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
