import { describe, it, expect, vi } from "vitest";
import { lockUserForUpdate } from "@/lib/rowLock";

describe("lockUserForUpdate", () => {
  it("トランザクション内で User 行を FOR UPDATE でロックする", async () => {
    const $queryRaw = vi.fn().mockResolvedValue([]);
    await lockUserForUpdate({ $queryRaw } as never, "child-1");
    expect($queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = $queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join("?")).toMatch(/FOR UPDATE/);
    expect(values).toEqual(["child-1"]);
  });
});
