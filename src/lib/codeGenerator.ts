import crypto from "node:crypto";

// サーバー専用。クライアントバンドルに node:crypto を含めないため categories.ts とは分離している。
// 乱数は暗号論的乱数（crypto.randomInt）を使う。#184

function randomString(chars: string, length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

// Generate 6-char family code
export function generateFamilyCode(): string {
  return randomString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6); // Exclude confusing chars
}

// Generate 4-digit child code (ユーザーコード)
export function generateChildCode(): string {
  return randomString("0123456789", 4);
}
