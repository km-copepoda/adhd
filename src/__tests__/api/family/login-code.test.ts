import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/family/members/[id]/login-code/route";
import { getCurrentUser } from "@/lib/auth";
import { issueLoginCode } from "@/lib/childLoginCodeService";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { makeParams } from "../../helpers/request";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../helpers/fixtures";

// DB を伴うコード発行はサービス層をモックし、ルートの認可・対象確認だけを検証する
vi.mock("@/lib/childLoginCodeService", () => ({
  issueLoginCode: vi.fn(),
  consumeLoginCode: vi.fn(),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockIssue = vi.mocked(issueLoginCode);

const call = (id = "child-1") =>
  POST(new Request("http://localhost", { method: "POST" }), makeParams(id));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/family/members/[id]/login-code（#184）", () => {
  it("未認証の場合、401を返し、コードを発行しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockIssue).not.toHaveBeenCalled();
  });

  it("CHILDロールの場合、403を返し、コードを発行しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockIssue).not.toHaveBeenCalled();
  });

  it("familyIdがない親の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockIssue).not.toHaveBeenCalled();
  });

  it("他の家族の子・存在しない子・PARENT の指定は404（同じ家族の CHILD だけを検索する）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await call("child-other");

    expect(res.status).toBe(404);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-other", familyId: "fam-1", role: "CHILD" },
      }),
    );
    expect(mockIssue).not.toHaveBeenCalled();
  });

  it("成功すると { code, expiresAt } を返すこと", async () => {
    const expiresAt = new Date("2026-10-23T03:10:00.000Z");
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser());
    mockIssue.mockResolvedValue({ code: "ABCD2345", expiresAt });

    const res = await call("child-1");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ code: "ABCD2345", expiresAt: expiresAt.toISOString() });
    expect(mockIssue).toHaveBeenCalledWith("child-1");
  });

  it("コード発行で例外が出たら500を返し、コードを漏らさないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser());
    mockIssue.mockRejectedValue(new Error("db down"));

    const res = await call("child-1");
    expect(res.status).toBe(500);
  });
});
