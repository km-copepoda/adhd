import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/subscription/child-task-limit/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

/// GET /api/subscription/child-task-limit
/// CHILD 端末で「タスク追加ボタンを押す前」に上限判定するための最小情報を返す。
/// プラン名や金額は返さない (仕様書 §5.1「子供に課金 UI を見せない」に準拠)。
describe("GET /api/subscription/child-task-limit", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("PARENT は 403 (このエンドポイントは CHILD 専用)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("CHILD + Family の親が FREE → limit=10, current= 実カウント", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // 親 FREE
    mockPrisma.taskTemplate.count.mockResolvedValue(8);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ limit: 10, current: 8 });
    expect(json).not.toHaveProperty("plan"); // プラン名は返さない
    // enforce と同じ where (幽霊一時タスク除外)。develop の PR #13 と一致させる
    const call = mockPrisma.taskTemplate.count.mock.calls[0]?.[0] as
      | {
          where?: {
            assignedChildId?: string;
            isActive?: boolean;
            pausedAt?: null;
            NOT?: { isTemporary?: boolean; targetDate?: { lt?: Date } };
          };
        }
      | undefined;
    expect(call?.where?.assignedChildId).toBe("child-1");
    expect(call?.where?.isActive).toBe(true);
    expect(call?.where?.pausedAt).toBeNull();
    expect(call?.where?.NOT?.isTemporary).toBe(true);
    expect(call?.where?.NOT?.targetDate?.lt).toBeInstanceOf(Date);
  });

  it("CHILD + Family の親が PREMIUM 有効 → limit=null (無制限)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);
    mockPrisma.taskTemplate.count.mockResolvedValue(100);

    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ limit: null, current: 100 });
  });

  it("CHILD で familyId=null (単独モード) は limit=10, current=0 の FREE 扱い", async () => {
    // 単独モード CHILD は Family の親が居ないので、Phase 1-3 と同じく FREE 扱い
    mockGetCurrentUser.mockResolvedValue(childUser({ familyId: null }) as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ limit: 10, current: 0 });
    expect(mockPrisma.taskTemplate.count).not.toHaveBeenCalled();
  });

  it("current は境界値 (0/9/10/20) をそのまま返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(10);

    const res = await GET();
    const json = await res.json();
    expect(json.current).toBe(10);
    expect(json.limit).toBe(10);
  });
});
