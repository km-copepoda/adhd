import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * /api/dev/* (e2eテスト専用API) の二重ガード。通過したら null、弾く場合はそのレスポンスを返す。
 * 1. ALLOW_E2E_SETUP !== "1" の場合は 404 を返し、エンドポイントの存在自体を隠す
 * 2. x-e2e-setup-secret ヘッダーが E2E_SETUP_SECRET と一致しない場合は 401
 */
export function checkE2eSetupGuard(request: NextRequest): NextResponse | null {
  if (process.env.ALLOW_E2E_SETUP !== "1") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const expectedSecret = process.env.E2E_SETUP_SECRET;
  const providedSecret = request.headers.get("x-e2e-setup-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
