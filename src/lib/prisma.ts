import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // DIRECT_URL はセッションモード pooler (port 5432) でプリペアドステートメントをサポートする。
  // DATABASE_URL がトランザクションモード pooler (port 6543) の場合、Prisma 7.x との
  // 相性問題 (P2022) が発生するため DIRECT_URL を優先する。
  const connectionString = (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

globalForPrisma.prisma = prisma;
