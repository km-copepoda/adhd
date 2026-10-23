import type { Prisma } from "@/generated/prisma/client";

/**
 * トランザクション内で User 行を SELECT ... FOR UPDATE でロックする。
 * 同じ子どもの XP・pity などを read-modify-write する処理を直列化するために使う。
 */
export async function lockUserForUpdate(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}
