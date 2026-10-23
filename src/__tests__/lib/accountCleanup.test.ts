import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  routeLogger: vi.fn(),
}));

import { cleanupExternal } from "@/lib/accountCleanup";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockLogError = vi.mocked(log.error);

type Fn = ReturnType<typeof vi.fn>;
let deleteUser: Fn;
let list: Fn;
let remove: Fn;
let from: Fn;

const files = (n: number, prefix = "f") => Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}.webp` }));
const cleanup = (o: Partial<{ supabaseIds: string[]; childIds: string[]; photoPaths: string[]; familyId: string | null }> = {}) => ({
  supabaseIds: [] as string[],
  childIds: [] as string[],
  photoPaths: [] as string[],
  ...o,
});
const removedPaths = () => remove.mock.calls.flatMap((c) => c[0] as string[]);

beforeEach(() => {
  vi.clearAllMocks();
  deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
  list = vi.fn().mockResolvedValue({ data: [], error: null });
  remove = vi.fn().mockResolvedValue({ data: [], error: null });
  from = vi.fn(() => ({ list, remove }));
  mockCreateAdminClient.mockReturnValue({
    auth: { admin: { deleteUser } },
    storage: { from },
  } as unknown as ReturnType<typeof createAdminClient>);
});

describe("cleanupExternal: Auth ユーザー削除", () => {
  it("supabaseId ごとに auth.admin.deleteUser を呼ぶこと", async () => {
    await cleanupExternal(cleanup({ supabaseIds: ["s1", "s2"] }));
    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(deleteUser).toHaveBeenCalledWith("s1");
    expect(deleteUser).toHaveBeenCalledWith("s2");
  });

  it("supabaseIds の重複は 1 回にまとめること", async () => {
    await cleanupExternal(cleanup({ supabaseIds: ["s1", "s1", "s2", "s1"] }));
    expect(deleteUser).toHaveBeenCalledTimes(2);
  });

  it("途中の 1 件が例外で失敗しても残りを続行し、例外を投げず、対象 ID をログに残すこと", async () => {
    deleteUser.mockImplementation(async (id: string) => {
      if (id === "s2") throw new Error("auth down");
      return { data: {}, error: null };
    });

    await expect(cleanupExternal(cleanup({ supabaseIds: ["s1", "s2", "s3"] }))).resolves.toEqual(expect.objectContaining({ supabaseIds: expect.any(Array), childIds: expect.any(Array), photoPaths: expect.any(Array) }));

    expect(deleteUser).toHaveBeenCalledTimes(3);
    expect(deleteUser).toHaveBeenCalledWith("s3");
    expect(mockLogError).toHaveBeenCalledWith(
      "account cleanup failed",
      expect.objectContaining({ kind: "auth_user", id: "s2" }),
    );
  });

  it("deleteUser が { error } を返した場合も失敗としてログに残し、続行すること", async () => {
    deleteUser.mockImplementation(async (id: string) =>
      id === "s1" ? { data: null, error: { message: "user not found" } } : { data: {}, error: null },
    );

    await cleanupExternal(cleanup({ supabaseIds: ["s1", "s2"] }));

    expect(deleteUser).toHaveBeenCalledWith("s2");
    expect(mockLogError).toHaveBeenCalledWith(
      "account cleanup failed",
      expect.objectContaining({ kind: "auth_user", id: "s1" }),
    );
  });

  it("空の cleanup では何も呼ばず、エラーログも出さないこと", async () => {
    await cleanupExternal(cleanup());
    expect(deleteUser).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(mockLogError).not.toHaveBeenCalled();
  });
});

describe("cleanupExternal: Storage 削除（quest-photos）", () => {
  it("quest-photos バケットを使い、childId ごとに list(childId, { limit: 1000, offset }) すること", async () => {
    list.mockResolvedValue({ data: files(2), error: null });

    await cleanupExternal(cleanup({ childIds: ["c1"] }));

    expect(from).toHaveBeenCalledWith("quest-photos");
    expect(list).toHaveBeenCalledWith("c1", expect.objectContaining({ limit: 1000, offset: 0 }));
    expect(removedPaths().sort()).toEqual(["c1/f0.webp", "c1/f1.webp"]);
  });

  it("list が 0 件なら 1 回で終了し、remove を呼ばないこと（境界）", async () => {
    list.mockResolvedValue({ data: [], error: null });

    await cleanupExternal(cleanup({ childIds: ["c1"] }));

    expect(list).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("list が 999 件なら次ページを取りに行かないこと（境界）", async () => {
    list.mockResolvedValue({ data: files(999), error: null });

    await cleanupExternal(cleanup({ childIds: ["c1"] }));

    expect(list).toHaveBeenCalledTimes(1);
    expect(removedPaths()).toHaveLength(999);
  });

  it("list がちょうど 1000 件なら次ページ（offset=1000）も取得し、空で終了すること（境界）", async () => {
    list.mockImplementation(async (_dir: string, opts: { offset: number }) =>
      opts.offset === 0 ? { data: files(1000), error: null } : { data: [], error: null },
    );

    await cleanupExternal(cleanup({ childIds: ["c1"] }));

    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1][1]).toEqual(expect.objectContaining({ limit: 1000, offset: 1000 }));
    expect(removedPaths()).toHaveLength(1000);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("list が 1001 件（1000 + 1）なら 2 ページ取得し、全 1001 件を remove すること（境界）", async () => {
    list.mockImplementation(async (_dir: string, opts: { offset: number }) =>
      opts.offset === 0 ? { data: files(1000, "a"), error: null } : { data: files(1, "b"), error: null },
    );

    await cleanupExternal(cleanup({ childIds: ["c1"] }));

    expect(list).toHaveBeenCalledTimes(2);
    expect(new Set(removedPaths()).size).toBe(1001);
    // remove は 1000 件ずつ
    expect(remove.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([1000, 1]);
  });

  it("remove は 1000 件ずつの chunk で呼ぶこと（2500 件 → 1000/1000/500）", async () => {
    const paths = Array.from({ length: 2500 }, (_, i) => `c1/p${i}.webp`);

    await cleanupExternal(cleanup({ photoPaths: paths }));

    expect(remove.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([1000, 1000, 500]);
    expect(removedPaths()).toHaveLength(2500);
  });

  it("remove がちょうど 1000 件なら 1 回で呼ぶこと（境界）", async () => {
    const paths = Array.from({ length: 1000 }, (_, i) => `c1/p${i}.webp`);
    await cleanupExternal(cleanup({ photoPaths: paths }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("photoPaths と list の結果、childIds の重複は排除すること", async () => {
    list.mockResolvedValue({ data: [{ name: "a.webp" }, { name: "b.webp" }], error: null });

    await cleanupExternal(
      cleanup({ childIds: ["c1", "c1"], photoPaths: ["c1/a.webp", "c1/a.webp", "legacy_q1.webp"] }),
    );

    expect(list).toHaveBeenCalledTimes(1); // 重複した childId は 1 回だけ
    expect(removedPaths().sort()).toEqual(["c1/a.webp", "c1/b.webp", "legacy_q1.webp"]);
  });

  it("旧形式（フラット）の photoPaths も remove 対象になること（childIds が空でも）", async () => {
    await cleanupExternal(cleanup({ photoPaths: ["q1_1.webp"] }));
    expect(list).not.toHaveBeenCalled();
    expect(removedPaths()).toEqual(["q1_1.webp"]);
  });

  it("list の name が安全な単一ファイル名でないもの（.., /, \\, 空, 制御文字）は remove 対象にしないこと", async () => {
    list.mockResolvedValue({
      data: [
        { name: "ok.webp" },
        { name: ".." },
        { name: "." },
        { name: "" },
        { name: "a/b.webp" },
        { name: "a\\b.webp" },
        { name: "../x.webp" },
        { name: "bad\u0000.webp" },
      ],
      error: null,
    });

    await cleanupExternal(cleanup({ childIds: ["c1"] }));

    expect(removedPaths()).toEqual(["c1/ok.webp"]);
  });

  it("list が 1 ページ失敗（error）しても他の child の削除を続行し、例外を投げず、ログに残すこと", async () => {
    list.mockImplementation(async (dir: string) =>
      dir === "c1" ? { data: null, error: { message: "boom" } } : { data: [{ name: "x.webp" }], error: null },
    );

    await expect(cleanupExternal(cleanup({ childIds: ["c1", "c2"] }))).resolves.toEqual(expect.objectContaining({ supabaseIds: expect.any(Array), childIds: expect.any(Array), photoPaths: expect.any(Array) }));

    expect(removedPaths()).toEqual(["c2/x.webp"]);
    expect(mockLogError).toHaveBeenCalledWith(
      "account cleanup failed",
      expect.objectContaining({ kind: "storage_list", id: "c1" }),
    );
  });

  it("list が data=null かつ error=null を返しても失敗として扱い、続行すること", async () => {
    list.mockImplementation(async (dir: string) =>
      dir === "c1" ? { data: null, error: null } : { data: [{ name: "x.webp" }], error: null },
    );

    await cleanupExternal(cleanup({ childIds: ["c1", "c2"] }));

    expect(removedPaths()).toEqual(["c2/x.webp"]);
    expect(mockLogError).toHaveBeenCalledWith(
      "account cleanup failed",
      expect.objectContaining({ kind: "storage_list", id: "c1" }),
    );
  });

  it("list が例外を投げても他の child を続行すること", async () => {
    list.mockImplementation(async (dir: string) => {
      if (dir === "c1") throw new Error("network");
      return { data: [{ name: "x.webp" }], error: null };
    });

    await expect(cleanupExternal(cleanup({ childIds: ["c1", "c2"] }))).resolves.toEqual(expect.objectContaining({ supabaseIds: expect.any(Array), childIds: expect.any(Array), photoPaths: expect.any(Array) }));
    expect(removedPaths()).toEqual(["c2/x.webp"]);
  });

  it("remove の 1 chunk が失敗しても次の chunk を続行し、失敗した photo path 自体をログに残すこと", async () => {
    const paths = Array.from({ length: 1500 }, (_, i) => `c1/p${i}.webp`);
    remove.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await expect(cleanupExternal(cleanup({ photoPaths: paths }))).resolves.toEqual(expect.objectContaining({ supabaseIds: expect.any(Array), childIds: expect.any(Array), photoPaths: expect.any(Array) }));

    expect(remove).toHaveBeenCalledTimes(2);
    const logged = mockLogError.mock.calls.find(
      ([msg, ctx]) => msg === "account cleanup failed" && (ctx as { kind?: string }).kind === "storage_remove",
    );
    expect(logged).toBeDefined();
    expect((logged![1] as { paths: string[] }).paths).toContain("c1/p0.webp");
  });

  it("remove が例外を投げても cleanupExternal は例外にしないこと", async () => {
    remove.mockRejectedValue(new Error("network"));
    await expect(cleanupExternal(cleanup({ photoPaths: ["c1/a.webp"] }))).resolves.toEqual(expect.objectContaining({ supabaseIds: expect.any(Array), childIds: expect.any(Array), photoPaths: expect.any(Array) }));
    expect(mockLogError).toHaveBeenCalled();
  });

  it("Auth 削除と Storage 削除は互いに独立（Auth が全滅しても Storage は実行される）", async () => {
    deleteUser.mockRejectedValue(new Error("auth down"));
    await cleanupExternal(cleanup({ supabaseIds: ["s1"], photoPaths: ["c1/a.webp"] }));
    expect(removedPaths()).toEqual(["c1/a.webp"]);
  });
});

describe("cleanupExternal: ログ文脈", () => {
  it("失敗ログに cleanupId（文字列）が付き、cleanup.familyId があれば familyId も付くこと", async () => {
    deleteUser.mockRejectedValue(new Error("auth down"));

    await cleanupExternal(cleanup({ supabaseIds: ["s1"], familyId: "fam-1" }));

    expect(mockLogError).toHaveBeenCalledWith(
      "account cleanup failed",
      expect.objectContaining({ cleanupId: expect.any(String), familyId: "fam-1" }),
    );
  });
});

describe("cleanupExternal: admin クライアント生成失敗", () => {
  it("createAdminClient が throw しても例外にせず、ログに残すこと", async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    });

    await expect(
      cleanupExternal(cleanup({ supabaseIds: ["s1"], childIds: ["c1"], photoPaths: ["c1/a.webp"] })),
    ).resolves.toEqual(expect.objectContaining({ supabaseIds: expect.any(Array), childIds: expect.any(Array), photoPaths: expect.any(Array) }));

    expect(mockLogError).toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("cleanupExternal: 戻り値は未完了分（outbox 再試行用）", () => {
  it("全部成功なら空の supabaseIds / childIds / photoPaths を返すこと", async () => {
    list.mockResolvedValue({ data: [{ name: "a.webp" }], error: null });
    const r = await cleanupExternal(
      cleanup({ supabaseIds: ["s1"], childIds: ["c1"], photoPaths: ["c1/b.webp"], familyId: "fam-1" }),
    );
    expect(r.supabaseIds).toEqual([]);
    expect(r.childIds).toEqual([]);
    expect(r.photoPaths).toEqual([]);
  });

  it("空の cleanup は空を返すこと", async () => {
    const r = await cleanupExternal(cleanup());
    expect(r).toEqual(expect.objectContaining({ supabaseIds: [], childIds: [], photoPaths: [] }));
  });

  it("Auth 削除に失敗した ID だけが supabaseIds に残ること（例外・{ error } とも）", async () => {
    deleteUser.mockImplementation(async (id: string) => {
      if (id === "s2") throw new Error("auth down");
      if (id === "s3") return { data: null, error: { message: "boom", status: 500 } };
      return { data: {}, error: null };
    });
    const r = await cleanupExternal(cleanup({ supabaseIds: ["s1", "s2", "s3"] }));
    expect([...r.supabaseIds].sort()).toEqual(["s2", "s3"]);
  });

  it("user_not_found（code）/ status 404 は完了扱いで残さないこと", async () => {
    deleteUser.mockImplementation(async (id: string) => {
      if (id === "s1") return { data: null, error: { code: "user_not_found", message: "x" } };
      if (id === "s2") return { data: null, error: { status: 404, message: "x" } };
      return { data: null, error: { status: 500, message: "x" } };
    });
    const r = await cleanupExternal(cleanup({ supabaseIds: ["s1", "s2", "s3"] }));
    expect(r.supabaseIds).toEqual(["s3"]);
  });

  it("list に失敗した childId だけが childIds に残り、成功分の写真は削除されること", async () => {
    list.mockImplementation(async (dir: string) =>
      dir === "c1" ? { data: null, error: { message: "boom" } } : { data: [{ name: "x.webp" }], error: null },
    );
    const r = await cleanupExternal(cleanup({ childIds: ["c1", "c2"] }));
    expect(r.childIds).toEqual(["c1"]);
    expect(r.photoPaths).toEqual([]);
    expect(removedPaths()).toEqual(["c2/x.webp"]);
  });

  it("list が例外 / data=null の childId も残ること", async () => {
    list.mockImplementation(async (dir: string) => {
      if (dir === "c1") throw new Error("network");
      if (dir === "c2") return { data: null, error: null };
      return { data: [], error: null };
    });
    const r = await cleanupExternal(cleanup({ childIds: ["c1", "c2", "c3"] }));
    expect([...r.childIds].sort()).toEqual(["c1", "c2"]);
  });

  it("remove に失敗した chunk のパスだけが photoPaths に残ること（1500 件の先頭 1000 件が失敗）", async () => {
    const paths = Array.from({ length: 1500 }, (_, i) => `c1/p${i}.webp`);
    remove.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const r = await cleanupExternal(cleanup({ photoPaths: paths }));
    expect(r.photoPaths).toHaveLength(1000);
    expect(r.photoPaths).toContain("c1/p0.webp");
    expect(r.photoPaths).not.toContain("c1/p1000.webp");
  });

  it("remove が例外でも該当 chunk のパスが残ること", async () => {
    remove.mockRejectedValue(new Error("network"));
    const r = await cleanupExternal(cleanup({ photoPaths: ["c1/a.webp", "c1/b.webp"] }));
    expect([...r.photoPaths].sort()).toEqual(["c1/a.webp", "c1/b.webp"]);
  });

  it("admin クライアント生成失敗なら入力を（重複排除して）そのまま返すこと", async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    });
    const r = await cleanupExternal(
      cleanup({ supabaseIds: ["s1", "s1"], childIds: ["c1", "c1"], photoPaths: ["c1/a.webp", "c1/a.webp"], familyId: "fam-1" }),
    );
    expect(r.supabaseIds).toEqual(["s1"]);
    expect(r.childIds).toEqual(["c1"]);
    expect(r.photoPaths).toEqual(["c1/a.webp"]);
  });
});
