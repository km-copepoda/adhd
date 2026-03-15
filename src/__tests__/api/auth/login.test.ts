import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { makeRequest } from "../../helpers/request";
import { mockSupabaseSignIn } from "../../helpers/auth-mock";

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/login", body);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/login", () => {
  it("ログイン成功時にユーザー情報を返すこと", async () => {
    const mockUser = { id: "sup-1", email: "test@test.com" };
    mockSupabaseSignIn({ user: mockUser });

    const res = await POST(req({ email: "test@test.com", password: "pass123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toEqual(mockUser);
  });

  it("ログイン失敗時に400とエラーメッセージを返すこと", async () => {
    mockSupabaseSignIn(null, { message: "Invalid login credentials" });

    const res = await POST(req({ email: "bad@test.com", password: "wrong" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid login credentials");
  });
});
