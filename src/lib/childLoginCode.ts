import crypto from "node:crypto";
import { LOGIN_CODE_CHARS, normalizeLoginCodeText } from "@/lib/input";

// 子どものログインコード（親が発行するワンタイムコード）の純粋関数。#184
// サーバー専用（node:crypto を使う）。画面側は node:crypto を避けるため input.ts の normalizeLoginCodeText を使う。

export const LOGIN_CODE_LENGTH = 8;

export function generateLoginCode(): string {
  let code = "";
  for (let i = 0; i < LOGIN_CODE_LENGTH; i++) {
    code += LOGIN_CODE_CHARS[crypto.randomInt(LOGIN_CODE_CHARS.length)];
  }
  return code;
}

/** DB にはハッシュだけを保存する（平文は保存しない） */
export function hashLoginCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** 半角化 → 大文字化 → 許可文字以外を除去。長さの切り詰めはしない */
export function normalizeLoginCode(raw: string): string {
  return normalizeLoginCodeText(raw);
}
