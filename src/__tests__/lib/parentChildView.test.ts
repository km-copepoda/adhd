import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTargetChild } from "@/lib/parentChildView";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { parentUserWithFamily, childUser, childUserWithFamily } from "../helpers/fixtures";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveTargetChild", () => {
  it("PARENT ロールでない場合は 403 エラーを返す", async () => {
    const child = childUserWithFamily();
    const result = await resolveTargetChild(child, "child-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("familyId が無い場合は 403 エラーを返す", async () => {
    const parent = parentUserWithFamily({ familyId: null }, null);
    const result = await resolveTargetChild(parent, "child-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("childId が空文字 / undefined の場合は 400 を返す", async () => {
    const parent = parentUserWithFamily();
    const result = await resolveTargetChild(parent, "");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("同一 family の CHILD が見つからない場合は 404 を返す", async () => {
    const parent = parentUserWithFamily();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await resolveTargetChild(parent, "child-9");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "child-9", familyId: "fam-1", role: "CHILD" },
    });
  });

  it("正しい子供が見つかった場合は ok:true で child を返す", async () => {
    const parent = parentUserWithFamily();
    const child = childUser({ id: "child-3" });
    mockPrisma.user.findFirst.mockResolvedValue(child);
    const result = await resolveTargetChild(parent, "child-3");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.child.id).toBe("child-3");
    }
  });

  it("別 family の childId を指定された場合は 404 を返す（family クロス検証）", async () => {
    const parent = parentUserWithFamily({ familyId: "fam-1" });
    // 別ファミリーの子は findFirst の where 条件で除外され null が返る
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await resolveTargetChild(parent, "child-other-family");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});
