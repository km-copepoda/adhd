import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * vitest globalSetup: テスト群全体の前に1回だけ実行。
 * 全テーブルのデータを削除してクリーンな状態にする。
 * スキーマは prisma db push で事前に同期されている前提。
 */
export async function setup() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("\n🔄 Cleaning database for integration tests ...");

  // 外部キー制約を考慮した削除順序
  await prisma.streak.deleteMany();
  await prisma.taskStreak.deleteMany();
  await prisma.questInstance.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.family.deleteMany();

  console.log("✅ Database cleaned.\n");
}
