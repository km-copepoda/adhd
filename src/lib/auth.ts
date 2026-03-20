import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateFamilyCode } from "@/lib/constants";
import { log } from "@/lib/logger";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { family: true },
  });

  // DB リセット後などで Supabase セッションは有効だが DB ユーザーが存在しない場合に再作成
  if (!dbUser && user.email) {
    log.warn("DB user missing, auto-recreating", { supabaseId: user.id });
    await prisma.family.create({
      data: {
        code: generateFamilyCode(),
        users: {
          create: {
            supabaseId: user.id,
            role: "PARENT",
            name: user.email.split("@")[0],
          },
        },
      },
    });
    return prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { family: true },
    });
  }

  return dbUser;
}
