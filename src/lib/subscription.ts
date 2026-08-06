/// マネタイズプラン (FREE / PREMIUM) の純粋関数とデータ定義。
/// DB アクセスは含まない (それは subscriptionService.ts)。
/// 仕様: docs/未実装仕様書/monetization-plan.md

export type SubscriptionPlan = "FREE" | "PREMIUM";

/// 上限をかけるリソースの識別子。
/// - child: 子アカウント数 (Family 内の CHILD ロールの User)
/// - task: アクティブなタスク数 (isActive && pausedAt IS NULL) / 子1人あたり
/// - treasure_item: 親カスタムごほうび数 (isActive=true) / 子1人あたり
export type LimitedResource = "child" | "task" | "treasure_item";

/// プランごとの上限値テーブル。null = 無制限。
export const LIMITS: Record<SubscriptionPlan, Record<LimitedResource, number | null>> = {
  FREE: {
    child: 1,
    task: 10,
    treasure_item: 5,
  },
  PREMIUM: {
    child: null,
    task: null,
    treasure_item: null,
  },
};

export function computeLimit(plan: SubscriptionPlan, resource: LimitedResource): number | null {
  return LIMITS[plan][resource];
}

/// Subscription レコードから「プランが実効的にアクティブか」を判定。
/// - null (レコード無し) は false
/// - plan=FREE は常に false
/// - plan=PREMIUM で currentPeriodEnd が null は true (無期限 / 手動付与)
/// - plan=PREMIUM で currentPeriodEnd > now は true
/// - plan=PREMIUM で currentPeriodEnd <= now は false (期限切れ)
export function isPlanActive(
  sub: { plan: SubscriptionPlan; currentPeriodEnd: Date | null } | null,
  now: Date,
): boolean {
  if (!sub) return false;
  if (sub.plan !== "PREMIUM") return false;
  if (sub.currentPeriodEnd === null) return true;
  return sub.currentPeriodEnd.getTime() > now.getTime();
}

/// Subscription レコードから実効プランを返す。
/// isPlanActive が true なら PREMIUM、そうでなければ FREE。
export function resolvePlan(
  sub: { plan: SubscriptionPlan; currentPeriodEnd: Date | null } | null,
  now: Date,
): SubscriptionPlan {
  return isPlanActive(sub, now) ? "PREMIUM" : "FREE";
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
}

/// 現在の使用数 current が上限に達しているか判定する純粋関数。
/// 「追加できるか」を返す。current >= limit なら allowed=false (境界ちょうどでも追加不可)。
/// limit=null (無制限) の場合は常に allowed=true。
export function checkLimit(
  plan: SubscriptionPlan,
  resource: LimitedResource,
  current: number,
): LimitCheckResult {
  const limit = computeLimit(plan, resource);
  const allowed = limit === null ? true : current < limit;
  return { allowed, current, limit };
}
