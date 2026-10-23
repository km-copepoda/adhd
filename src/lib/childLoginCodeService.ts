import { prisma } from "@/lib/prisma";
import { generateLoginCode, hashLoginCode } from "@/lib/childLoginCode";
import { isUniqueViolation } from "@/lib/prismaErrors";

// 子どものログインコードの DB 操作。#184

export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const ISSUE_MAX_ATTEMPTS = 5;

/**
 * 子ども1人につき有効なコードは1つ（再発行で上書き）。期限は10分。
 * codeHash の unique 衝突（P2002）は別のコードで有限回再試行する。
 */
export async function issueLoginCode(
  childId: string,
): Promise<{ code: string; expiresAt: Date }> {
  for (let attempt = 1; ; attempt++) {
    const code = generateLoginCode();
    const codeHash = hashLoginCode(code);
    const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS);
    try {
      await prisma.childLoginCode.upsert({
        where: { childId },
        create: { childId, codeHash, expiresAt },
        update: { codeHash, expiresAt, createdAt: new Date() },
      });
      return { code, expiresAt };
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= ISSUE_MAX_ATTEMPTS) throw e;
    }
  }
}

type RawClient = Pick<typeof prisma, "$queryRaw">;

/**
 * コードを消費して childId を返す。1文の DELETE ... RETURNING で「有効なものを1回だけ」を
 * アトミックに保証する。付け替えと同じトランザクションで呼べるよう client を受け取る。
 * 該当なし（不一致・期限切れ・使用済み）は null。
 */
export async function consumeLoginCode(
  code: string,
  client: RawClient = prisma,
): Promise<string | null> {
  const rows = await client.$queryRaw<{ childId: string }[]>`
    DELETE FROM "ChildLoginCode"
    WHERE "codeHash" = ${hashLoginCode(code)} AND "expiresAt" > now()
    RETURNING "childId"`;
  return rows[0]?.childId ?? null;
}
