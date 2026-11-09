import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/accountCleanupJob", () => ({
  runPendingAccountCleanupJobs: vi.fn(),
}));

import { GET } from "@/app/api/cron/account-cleanup/route";
import { runPendingAccountCleanupJobs } from "@/lib/accountCleanupJob";

const mockRunPending = vi.mocked(runPendingAccountCleanupJobs);

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers["authorization"] = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/account-cleanup", { method: "GET", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  mockRunPending.mockResolvedValue(3);
});

describe("GET /api/cron/account-cleanup", () => {
  it("CRON_SECRET が一致しない場合 401 を返し、実行しないこと", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
    expect(mockRunPending).not.toHaveBeenCalled();
  });

  it("Authorization ヘッダーが無い場合 401 を返すこと", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockRunPending).not.toHaveBeenCalled();
  });

  it("CRON_SECRET が空（未設定相当）なら、空の Bearer でも 401 を返すこと", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(401);
    expect(mockRunPending).not.toHaveBeenCalled();
  });

  it("一致すれば runPendingAccountCleanupJobs を呼び、200 を返すこと", async () => {
    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);
    expect(mockRunPending).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await res.json())).toContain("3");
  });

  it("対象ジョブが 0 件でも 200 を返すこと（境界）", async () => {
    mockRunPending.mockResolvedValue(0);
    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);
  });
});
