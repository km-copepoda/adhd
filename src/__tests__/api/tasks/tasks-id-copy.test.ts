import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/tasks/[id]/copy/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { parentUser, childUser, taskTemplate } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-19T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/tasks/[id]/copy", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/tasks/t1/copy", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeRequest("/api/tasks/t1/copy", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("タスクが見つからない場合、404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest("/api/tasks/t1/copy", {}), makeParams("t1"));
    expect(res.status).toBe(404);
  });

  it("一時タスクでない場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(
      taskTemplate({ isTemporary: false }) as any
    );

    const res = await POST(makeRequest("/api/tasks/t1/copy", {}), makeParams("t1"));
    expect(res.status).toBe(400);
  });

  it("targetDate未指定の場合、翌日の一時タスクをコピーすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const original = taskTemplate({
      id: "tpl-1",
      title: "英語の宿題",
      emoji: "📖",
      category: "STUDY",
      difficulty: "NORMAL",
      isTemporary: true,
      targetDate: new Date("2026-03-19"),
      repeatDays: [],
      createdBy: "PARENT",
      familyId: "fam-1",
    });
    mockPrisma.taskTemplate.findFirst.mockResolvedValue({
      ...original,
      assignedChildId: "child-1",
    } as any);
    const newTask = { id: "tpl-2", title: "英語の宿題", isTemporary: true };
    mockPrisma.taskTemplate.create.mockResolvedValue(newTask as any);

    const res = await POST(makeRequest("/api/tasks/tpl-1/copy", {}), makeParams("tpl-1"));
    expect(res.status).toBe(200);

    const tomorrow = new Date("2026-03-20T00:00:00Z");
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "英語の宿題",
        emoji: "📖",
        category: "STUDY",
        difficulty: "NORMAL",
        isTemporary: true,
        repeatDays: [],
        targetDate: tomorrow,
        createdBy: "PARENT",
        familyId: "fam-1",
        assignedChildId: "child-1",
      }),
    });
  });

  it("targetDate指定の場合、その日の一時タスクをコピーすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const original = taskTemplate({
      isTemporary: true,
      targetDate: new Date("2026-03-19"),
      repeatDays: [],
    });
    mockPrisma.taskTemplate.findFirst.mockResolvedValue({
      ...original,
      assignedChildId: "child-1",
    } as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "tpl-new" } as any);

    const res = await POST(
      makeRequest("/api/tasks/tpl-1/copy", { targetDate: "2026-03-21" }),
      makeParams("tpl-1")
    );
    expect(res.status).toBe(200);

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetDate: new Date("2026-03-21"),
      }),
    });
  });

  it("コピーされた新タスクを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(
      taskTemplate({ isTemporary: true, targetDate: new Date("2026-03-19"), repeatDays: [] }) as any
    );
    const newTask = { id: "tpl-new", title: "宿題", isTemporary: true, targetDate: new Date("2026-03-20") };
    mockPrisma.taskTemplate.create.mockResolvedValue(newTask as any);

    const res = await POST(makeRequest("/api/tasks/tpl-1/copy", {}), makeParams("tpl-1"));
    const json = await res.json();

    expect(json.id).toBe("tpl-new");
  });
});
