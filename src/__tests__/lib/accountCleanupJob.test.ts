import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/accountCleanup", () => ({ cleanupExternal: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  routeLogger: vi.fn(),
}));

import { runAccountCleanupJob, runPendingAccountCleanupJobs } from "@/lib/accountCleanupJob";
import { cleanupExternal } from "@/lib/accountCleanup";
import { log } from "@/lib/logger";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";

const mockCleanup = vi.mocked(cleanupExternal);
const mockLogError = vi.mocked(log.error);

const payload = { supabaseIds: ["s1"], childIds: ["c1"], photoPaths: ["c1/a.webp"], familyId: "fam-1" };
const empty = { supabaseIds: [], childIds: [], photoPaths: [] };
const job = (o: Record<string, unknown> = {}) =>
  ({ id: "job-1", payload, attempts: 0, lastError: null, createdAt: new Date(), updatedAt: new Date(), ...o }) as never;
const byId = (jobs: unknown[]) =>
  (async ({ where }: { where: { id: string } }) =>
    jobs.find((j) => (j as { id: string }).id === where.id) ?? null) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(job());
  mockPrisma.accountCleanupJob.delete.mockResolvedValue(job());
  mockPrisma.accountCleanupJob.update.mockResolvedValue(job());
  mockCleanup.mockResolvedValue(empty);
});

describe("runAccountCleanupJob", () => {
  it("ジョブを id で読み、payload を cleanupExternal に渡すこと", async () => {
    await runAccountCleanupJob("job-1");
    expect(mockPrisma.accountCleanupJob.findUnique).toHaveBeenCalledWith({ where: { id: "job-1" } });
    expect(mockCleanup).toHaveBeenCalledWith(payload);
  });

  it("全成功（未完了が空）ならジョブを delete し、update しないこと", async () => {
    await runAccountCleanupJob("job-1");
    expect(mockPrisma.accountCleanupJob.delete).toHaveBeenCalledWith({ where: { id: "job-1" } });
    expect(mockPrisma.accountCleanupJob.update).not.toHaveBeenCalled();
  });

  it("部分失敗なら payload=残り・attempts+1・lastError で update し、delete しないこと", async () => {
    const remaining = { supabaseIds: ["s1"], childIds: [], photoPaths: ["c1/a.webp"], familyId: "fam-1" };
    mockCleanup.mockResolvedValue(remaining);
    mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(job({ attempts: 2 }));

    await runAccountCleanupJob("job-1");

    expect(mockPrisma.accountCleanupJob.delete).not.toHaveBeenCalled();
    expect(mockPrisma.accountCleanupJob.update).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.accountCleanupJob.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "job-1" });
    expect(arg.data.payload).toEqual(remaining);
    expect(arg.data.attempts).toBe(3);
    expect(typeof arg.data.lastError).toBe("string");
  });

  it("ジョブが無ければ何もせず、cleanupExternal も呼ばないこと", async () => {
    mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(null);
    await expect(runAccountCleanupJob("nope")).resolves.toBeUndefined();
    expect(mockCleanup).not.toHaveBeenCalled();
    expect(mockPrisma.accountCleanupJob.delete).not.toHaveBeenCalled();
    expect(mockPrisma.accountCleanupJob.update).not.toHaveBeenCalled();
  });

  it("cleanupExternal が想定外に throw しても例外を出さず、ジョブを消さず、ログに残すこと", async () => {
    mockCleanup.mockRejectedValue(new Error("unexpected"));
    await expect(runAccountCleanupJob("job-1")).resolves.toBeUndefined();
    expect(mockPrisma.accountCleanupJob.delete).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });

  it("DB（findUnique / delete）が失敗しても例外を出さないこと", async () => {
    mockPrisma.accountCleanupJob.findUnique.mockRejectedValue(new Error("db down"));
    await expect(runAccountCleanupJob("job-1")).resolves.toBeUndefined();
    mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(job());
    mockPrisma.accountCleanupJob.delete.mockRejectedValue(new Error("db down"));
    await expect(runAccountCleanupJob("job-1")).resolves.toBeUndefined();
  });

  it("境界: 更新後の attempts が 10 になる失敗（9 -> 10）では jobId 付きの log.error を出すこと", async () => {
    mockCleanup.mockResolvedValue({ ...empty, supabaseIds: ["s1"] });
    mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(job({ attempts: 9 }));
    await runAccountCleanupJob("job-1");
    expect(mockLogError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ jobId: "job-1" }));
    expect(mockPrisma.accountCleanupJob.update.mock.calls[0][0].data.attempts).toBe(10);
  });

  it("境界: 更新後の attempts が 9（8 -> 9）では log.error を出さないこと", async () => {
    mockCleanup.mockResolvedValue({ ...empty, supabaseIds: ["s1"] });
    mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(job({ attempts: 8 }));
    await runAccountCleanupJob("job-1");
    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockPrisma.accountCleanupJob.update).toHaveBeenCalled();
  });

  it("attempts が 10 を超えても再試行は続け、update すること", async () => {
    mockCleanup.mockResolvedValue({ ...empty, photoPaths: ["c1/a.webp"] });
    mockPrisma.accountCleanupJob.findUnique.mockResolvedValue(job({ attempts: 25 }));
    await runAccountCleanupJob("job-1");
    expect(mockPrisma.accountCleanupJob.update.mock.calls[0][0].data.attempts).toBe(26);
    expect(mockPrisma.accountCleanupJob.delete).not.toHaveBeenCalled();
  });
});

describe("runPendingAccountCleanupJobs", () => {
  beforeEach(() => {
    mockPrisma.accountCleanupJob.findMany.mockResolvedValue([]);
  });

  it("updatedAt 昇順・既定 take=50 で取得すること", async () => {
    await runPendingAccountCleanupJobs();
    expect(mockPrisma.accountCleanupJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { updatedAt: "asc" }, take: 50 }),
    );
  });

  it("limit 引数を take に渡すこと", async () => {
    await runPendingAccountCleanupJobs(5);
    expect(mockPrisma.accountCleanupJob.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it("0 件なら 0 を返し、cleanupExternal を呼ばないこと（境界）", async () => {
    expect(await runPendingAccountCleanupJobs()).toBe(0);
    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it("各ジョブを順に処理し、処理件数を返すこと", async () => {
    const jobs = [job({ id: "j1" }), job({ id: "j2" }), job({ id: "j3" })];
    mockPrisma.accountCleanupJob.findMany.mockResolvedValue(jobs);
    mockPrisma.accountCleanupJob.findUnique.mockImplementation(byId(jobs));

    const n = await runPendingAccountCleanupJobs();

    expect(n).toBe(3);
    expect(mockCleanup).toHaveBeenCalledTimes(3);
    expect(mockPrisma.accountCleanupJob.delete.mock.calls.map((c) => c[0].where.id)).toEqual(["j1", "j2", "j3"]);
  });

  it("1 件が失敗（cleanupExternal が throw）しても残りを続行し、件数に数えること", async () => {
    const jobs = [job({ id: "j1" }), job({ id: "j2" })];
    mockPrisma.accountCleanupJob.findMany.mockResolvedValue(jobs);
    mockPrisma.accountCleanupJob.findUnique.mockImplementation(byId(jobs));
    mockCleanup.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(empty);

    const n = await runPendingAccountCleanupJobs();

    expect(n).toBe(2);
    expect(mockCleanup).toHaveBeenCalledTimes(2);
    expect(mockPrisma.accountCleanupJob.delete).toHaveBeenCalledWith({ where: { id: "j2" } });
  });
});
