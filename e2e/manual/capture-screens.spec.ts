/**
 * 利用マニュアル（docs/manual）用のスクショを撮る。
 *
 *   npx playwright test -c playwright.manual.config.ts
 *
 * 1. 撮影用の家族（親1人・子「ハルト」1人、PREMIUM）を新しく作る
 * 2. マニュアルらしいタスク・ごほうびを登録し、報告・承認・宝箱の開封まで進めながら各画面を撮る
 * 3. 最後に家族ごと削除する（DELETE /api/account）
 *
 * 画像は docs/manual/images/<名前>.png（iPhone 13 の 1 画面分）。
 * 1 枚の撮影に失敗しても続行し、最後に失敗した一覧を出す。
 *
 * 前提: 撮影先のデプロイで E2E 専用 API（POST /api/dev/subscription）が有効なこと（ALLOW_E2E_SETUP）。
 * .env.test の VERCEL_BYPASS_SECRET（必要なら E2E_SETUP_SECRET）と、
 * playwright/.auth/parent.json（Vercel 保護を通るクッキー）を使う。
 * ごほうびの抽選は確率なので、当たらなかった回は使用申請の画面が撮れない（最後に表示される）。
 */
import fs from "fs";
import path from "path";
import { test, devices, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { getE2EBaseUrl, getE2ERoutePattern } from "../baseUrl";
import { AUTH_DIR, getBypassHeaders, issueChildLoginCode } from "../credentials";

const OUT = path.join(process.cwd(), "docs/manual/images");
const PASSWORD = "ManualPass123";
const failures: string[] = [];

type QuestRow = { id: string; status: string; template: { title: string } };

function setupHeaders(): Record<string, string> {
  const h: Record<string, string> = { ...getBypassHeaders() };
  if (process.env.E2E_SETUP_SECRET) h["x-e2e-setup-secret"] = process.env.E2E_SETUP_SECRET;
  return h;
}

/** iPhone 13 相当の未ログインコンテキスト（Vercel 保護は parent.json の Vercel クッキーと bypass ヘッダーで通す） */
async function newMobileContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    deviceScaleFactor: 2,
    baseURL: getE2EBaseUrl(),
    storageState: { cookies: [], origins: [] },
  });
  const parentState = path.join(AUTH_DIR, "parent.json");
  if (fs.existsSync(parentState)) {
    const state = JSON.parse(fs.readFileSync(parentState, "utf8")) as { cookies?: { name: string }[] };
    const vercel = (state.cookies ?? []).filter((c) => !c.name.startsWith("sb-"));
    if (vercel.length > 0) await ctx.addCookies(vercel as Parameters<BrowserContext["addCookies"]>[0]);
  }
  const secret = process.env.VERCEL_BYPASS_SECRET;
  if (secret) {
    await ctx.route(getE2ERoutePattern(), (r) =>
      r.continue({ headers: { ...r.request().headers(), "x-vercel-protection-bypass": secret } }),
    );
  }
  // 「ホーム画面に追加」バナーを出さない
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("ios-install-prompt-dismissed", "1");
    } catch {}
  });
  return ctx;
}

async function api<T = unknown>(
  ctx: BrowserContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  data?: unknown,
  headers: Record<string, string> = getBypassHeaders(),
): Promise<T> {
  const res = await ctx.request.fetch(url, { method, headers, ...(data === undefined ? {} : { data }) });
  const text = await res.text();
  if (!res.ok()) throw new Error(`${method} ${url} -> ${res.status()}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

async function settle(page: Page) {
  await page
    .waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

/** 進化・孵化・チェックインなどのカットインが出ていれば閉じる */
async function dismissOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    const tap = page.getByText("タップして閉じる").first();
    if (!(await tap.isVisible().catch(() => false))) return;
    await tap.click().catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function shot(page: Page, name: string) {
  try {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log("captured", name);
  } catch (e) {
    failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** url を開いて撮る。失敗しても続行する */
async function snap(page: Page, name: string, url: string, opts: { overlays?: boolean } = {}) {
  try {
    await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
    await settle(page);
    if (opts.overlays !== false) await dismissOverlays(page);
    await shot(page, name);
  } catch (e) {
    failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 操作してから撮る。失敗しても続行する */
async function act(page: Page, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    await page.waitForTimeout(1200);
    await shot(page, name);
  } catch (e) {
    failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const RECURRING_TASKS = [
  { title: "しゅくだい", emoji: "📝", category: "STUDY", photoBonus: true },
  { title: "音読", emoji: "📖", category: "STUDY" },
  { title: "なわとび", emoji: "🏃", category: "STAMINA" },
  { title: "はみがき", emoji: "😁", category: "LIFE" },
  { title: "明日の準備", emoji: "🎒", category: "LIFE" },
];
const TEMP_TASKS = { report: "プリントを出す", skip: "上ばきを洗う", reject: "ピアノの練習" };
const REWARDS = [
  { title: "おやつをひとつ選べる", rarity: "COMMON" },
  { title: "YouTube あと15分OK", rarity: "COMMON" },
  { title: "好きなアイスを買える", rarity: "UNCOMMON" },
  { title: "ゲーム +30分延長", rarity: "UNCOMMON" },
  { title: "好きな本・マンガ1冊", rarity: "RARE" },
];

test("利用マニュアルのスクショを撮る", async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const parentCtx = await newMobileContext(browser);
  const childCtx = await newMobileContext(browser);
  const p = await parentCtx.newPage();
  const c = await childCtx.newPage();
  let registered = false;

  try {
    // ---------- 未ログイン ----------
    await snap(p, "public-login", "/login");
    await snap(p, "public-parent-login", "/app/parent/login");
    await snap(c, "public-child-login", "/app/child/login");
    await snap(p, "public-register", "/app/register");

    // ---------- 親の登録と初期データ ----------
    const email = `QA_manual_${Date.now()}@example.com`;
    await p.fill('input[placeholder="メールアドレス"]', email);
    await p.fill('input[placeholder="パスワード（6文字以上）"]', PASSWORD);
    await p.click('button:has-text("アカウントを作成")');
    // 画面遷移の待機が失敗してもアカウントはできている可能性があるので、先に後片付けの対象にする
    registered = true;
    await p.waitForURL("**/app/parent/tasks", { timeout: 30000 });
    await settle(p);
    await shot(p, "parent-tasks-empty");

    await api(parentCtx, "POST", "/api/dev/subscription", undefined, setupHeaders());
    const { id: childId } = await api<{ id: string }>(parentCtx, "POST", "/api/family/members", {
      monsterName: "ハルト",
      side: "LIGHT",
    });
    for (const t of RECURRING_TASKS) {
      await api(parentCtx, "POST", "/api/tasks", {
        ...t,
        assignedChildId: childId,
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
      });
    }
    for (const r of REWARDS) await api(parentCtx, "POST", "/api/treasures", { childId, ...r });

    await snap(p, "parent-family", "/app/parent/family");

    // ---------- 子のログイン ----------
    const code = await issueChildLoginCode(parentCtx.request, childId);
    await c.goto("/app/child/login");
    await c.fill('input[placeholder="ABCD2345"]', code);
    await shot(c, "child-login-filled");
    await c.click('button:has-text("ログイン")');
    await c.waitForURL("**/app/child/quests", { timeout: 30000 });
    await settle(c);
    await shot(c, "child-first-open");
    await dismissOverlays(c);
    await snap(c, "child-quests-pending", "/app/child/quests");

    await act(c, "child-quest-sheet", async () => {
      await c.getByText("しゅくだい", { exact: true }).first().click();
    });
    await act(c, "child-quest-skip-form", async () => {
      await c.getByText(/今日はスキップする/).click();
    });

    // ---------- 報告（全部報告 → 宝箱2個） ----------
    const today = () => api<QuestRow[]>(childCtx, "GET", "/api/quests/today");
    for (const q of await today()) {
      if (q.status === "PENDING") {
        await api(childCtx, "POST", `/api/quests/${q.id}/report`, { comment: "できたよ" });
      }
    }
    await snap(c, "child-quests-reported", "/app/child/quests");
    await snap(c, "child-treasures-locked", "/app/child/treasures");
    await snap(p, "parent-approve", "/app/parent/approve");

    // ---------- 承認 → 宝箱を開ける ----------
    for (const q of await today()) {
      if (q.status === "REPORTED") {
        await api(parentCtx, "POST", `/api/approve/${q.id}`, { kind: "quest", action: "approve" });
      }
    }
    await snap(c, "child-quests-approved", "/app/child/quests");
    await snap(c, "child-treasures-unlocked", "/app/child/treasures");
    for (const n of [1, 2]) {
      await act(c, `child-treasure-open-${n}`, async () => {
        await c.getByRole("button", { name: "あける" }).click();
        await c.waitForTimeout(3000);
      });
      await dismissOverlays(c);
      await c.goto("/app/child/treasures");
      await settle(c);
    }
    await shot(c, "child-treasures-history");
    await act(c, "child-treasure-rewards", async () => {
      await c.getByText("🎁 ごほうび一覧").first().click();
    });
    const useBtn = c.getByRole("button", { name: "つかう" }).first();
    if (await useBtn.isVisible().catch(() => false)) {
      await act(c, "child-treasure-use-confirm", async () => {
        await useBtn.click();
      });
      await act(c, "child-treasure-use-requested", async () => {
        await c.getByRole("button", { name: "つかう" }).last().click();
      });
    } else {
      failures.push("child-treasure-use-*: ごほうびが当たらなかったため使用申請の画面は撮れていません");
    }

    // ---------- 承認待ち・差し戻し・スキップの状態を作る ----------
    for (const title of Object.values(TEMP_TASKS)) {
      await api(parentCtx, "POST", "/api/tasks", {
        title,
        emoji: "⭐",
        category: "LIFE",
        assignedChildId: childId,
        isTemporary: true,
      });
    }
    const byTitle = async (title: string) => (await today()).find((q) => q.template.title === title)!;
    const qr = await byTitle(TEMP_TASKS.report);
    const qs = await byTitle(TEMP_TASKS.skip);
    const qj = await byTitle(TEMP_TASKS.reject);
    await api(childCtx, "POST", `/api/quests/${qr.id}/report`, { comment: "出したよ" });
    await api(childCtx, "POST", `/api/quests/${qs.id}/skip`, { comment: "あめでぬれちゃった" });
    await api(childCtx, "POST", `/api/quests/${qj.id}/report`, { comment: "やったよ" });
    await api(parentCtx, "POST", `/api/approve/${qj.id}`, {
      kind: "quest",
      action: "reject",
      rejectionReason: "あと10分がんばろう",
    });
    await snap(c, "child-quests-mixed", "/app/child/quests");

    // ---------- 親の画面 ----------
    await snap(p, "parent-approve-mixed", "/app/parent/approve");
    await act(p, "parent-approve-reject-modal", async () => {
      await p.getByRole("button", { name: "差し戻し" }).first().click();
    });
    await snap(p, "parent-tasks", "/app/parent/tasks");
    await act(p, "parent-task-form", async () => {
      await p.getByRole("button", { name: /タスク追加/ }).first().click();
    });
    await p.goto("/app/parent/tasks");
    await settle(p);
    await act(p, "parent-tasks-template", async () => {
      await p.getByRole("button", { name: /テンプレート/ }).first().click();
    });
    await snap(p, "parent-treasures", "/app/parent/treasures");
    await snap(p, "parent-treasures-history", "/app/parent/treasures/pending");
    await snap(p, "parent-records", "/app/parent/records");
    await snap(p, "parent-completed", "/app/parent/completed");
    await snap(p, "parent-history", "/app/parent/history");
    await snap(p, "parent-family-after", "/app/parent/family");
    await snap(p, "parent-plan", "/app/parent/plan");
    await snap(p, "parent-gathering", "/app/parent/gathering");
    await snap(p, "parent-child-view", "/app/parent/child-view");
    await snap(p, "parent-child-view-quests", `/app/parent/child-view/${childId}/quests`);
    await snap(p, "parent-child-view-monster", `/app/parent/child-view/${childId}/monster`);
    await snap(p, "parent-child-view-treasures", `/app/parent/child-view/${childId}/treasures`);

    // ---------- 子の画面 ----------
    await snap(c, "child-monster", "/app/child/monster");
    await snap(c, "child-collection", "/app/child/collection");
    await act(c, "child-collection-items", async () => {
      await c.getByRole("button", { name: /🎁 アイテム/ }).click();
    });
    await act(c, "child-collection-badges", async () => {
      await c.getByRole("button", { name: /🏅 実績/ }).click();
    });
    await snap(c, "child-gathering", "/app/child/gathering");
  } finally {
    if (registered) {
      await parentCtx.request
        .delete("/api/dev/subscription", { headers: setupHeaders() })
        .catch(() => {});
      const del = await parentCtx.request
        .delete("/api/account", { headers: getBypassHeaders(), data: { confirm: "削除します" } })
        .catch((e) => e);
      console.log("cleanup /api/account:", "status" in del ? del.status() : String(del));
    }
    await parentCtx.close();
    await childCtx.close();
    if (failures.length > 0) console.log("\n撮れなかったもの:\n- " + failures.join("\n- "));
  }
});
