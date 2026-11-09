import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { issueLoginCode, consumeLoginCode } from "@/lib/childLoginCodeService";
import { hashLoginCode } from "@/lib/childLoginCode";

const NOW = new Date("2026-10-23T03:00:00.000Z");
const TEN_MIN_MS = 10 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("issueLoginCode（#184）", () => {
  it("子ども1人につき1行を upsert し、期限は10分後ちょうどになること", async () => {
    mockPrisma.childLoginCode.upsert.mockResolvedValue({} as never);

    const result = await issueLoginCode("child-1");

    expect(result.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + TEN_MIN_MS);
    expect(mockPrisma.childLoginCode.upsert).toHaveBeenCalledTimes(1);
    const args = mockPrisma.childLoginCode.upsert.mock.calls[0][0];
    const hash = hashLoginCode(result.code);
    expect(args.where).toEqual({ childId: "child-1" });
    expect(args.create).toMatchObject({ childId: "child-1", codeHash: hash });
    expect(args.create.expiresAt).toEqual(result.expiresAt);
    expect(args.update).toMatchObject({ codeHash: hash });
    expect(args.update.expiresAt).toEqual(result.expiresAt);
  });

  it("DB には平文のコードを渡さないこと", async () => {
    mockPrisma.childLoginCode.upsert.mockResolvedValue({} as never);
    const { code } = await issueLoginCode("child-1");
    expect(JSON.stringify(mockPrisma.childLoginCode.upsert.mock.calls)).not.toContain(code);
  });

  it("codeHash の unique 衝突（P2002）では別のコードで再試行すること", async () => {
    mockPrisma.childLoginCode.upsert
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({} as never);

    const result = await issueLoginCode("child-1");

    expect(mockPrisma.childLoginCode.upsert).toHaveBeenCalledTimes(2);
    const [first, second] = mockPrisma.childLoginCode.upsert.mock.calls.map(
      (c) => c[0].create.codeHash,
    );
    expect(first).not.toBe(second);
    expect(second).toBe(hashLoginCode(result.code));
  });

  it("衝突が続く場合は有限回で諦めて例外を投げること", async () => {
    mockPrisma.childLoginCode.upsert.mockRejectedValue(uniqueViolation());
    await expect(issueLoginCode("child-1")).rejects.toThrow();
    const n = mockPrisma.childLoginCode.upsert.mock.calls.length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(10);
  });

  it("unique 衝突以外のエラーは再試行せずそのまま投げること", async () => {
    mockPrisma.childLoginCode.upsert.mockRejectedValue(new Error("db down"));
    await expect(issueLoginCode("child-1")).rejects.toThrow("db down");
    expect(mockPrisma.childLoginCode.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("consumeLoginCode（#184）", () => {
  const sqlText = (first: unknown): string => {
    if (Array.isArray(first)) return first.join("?");
    const s = first as { strings?: string[]; sql?: string };
    return s.strings ? s.strings.join("?") : (s.sql ?? "");
  };

  it('DELETE ... RETURNING "childId" の $queryRaw を1回だけ発行し、childId を返すこと', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ childId: "child-1" }] as never);

    const childId = await consumeLoginCode("ABCD2345");

    expect(childId).toBe("child-1");
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    const call = mockPrisma.$queryRaw.mock.calls[0] as unknown[];
    const text = sqlText(call[0]);
    expect(text).toContain('DELETE FROM "ChildLoginCode"');
    expect(text).toContain('"codeHash"');
    expect(text).toContain('"expiresAt"');
    expect(text).toContain('RETURNING "childId"');
    // 平文ではなくハッシュで照合する
    expect(call).toContain(hashLoginCode("ABCD2345"));
    expect(call).not.toContain("ABCD2345");
  });

  it("該当なし（期限切れ・使用済み・不一致）は0件で null を返すこと", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([] as never);
    expect(await consumeLoginCode("ABCD2345")).toBeNull();
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("client を渡した場合はそのクライアント（トランザクション）で実行すること", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ childId: "child-9" }]) };
    const childId = await consumeLoginCode("ABCD2345", tx as never);
    expect(childId).toBe("child-9");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});
