// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seed } from "@/lib/repositories/prototype";
import type { Snapshot, NotificationLog } from "@/types/domain";
const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  snapshot: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/repositories", () => ({
  repository: async () => ({ snapshot: mocks.snapshot }),
}));
import Auth from "@/app/auth/page";
import { Workspace } from "@/components/layout/workspace";
import { notificationMessage } from "@/components/admin/admin-pages";
let root: Root;
let container: HTMLDivElement;
let data: Snapshot;
const forbidden =
  /試用モード|試用通知|実送信なし|メンバーとして試す|管理者として試す|操作内容はこのブラウザー内に保存されます/;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const seeded = seed();
  data = { ...seeded, user: seeded.users[0], managerNames: {} };
  mocks.snapshot.mockResolvedValue(data);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function render(component: ReturnType<typeof createElement>) {
  await act(async () => {
    root.render(component);
  });
  return container.textContent || "";
}
describe("real UI components respect the explicit mode", () => {
  it("production login contains only email/password login", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
    const text = await render(createElement(Auth));
    expect(text).toContain("メールアドレス");
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(text).not.toMatch(forbidden);
  });
  it("prototype login retains the existing demo buttons", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "prototype");
    const text = await render(createElement(Auth));
    expect(text).toContain("メンバーとして試す");
    expect(text).toContain("管理者として試す");
  });
  it.each(["home", "admin"])(
    "production %s workspace has no prototype badge",
    async (path) => {
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
      const text = await render(createElement(Workspace, { path: [path] }));
      expect(container.querySelector(".main-content")).not.toBeNull();
      expect(text).not.toMatch(forbidden);
      expect(container.querySelector(".badge.prototype")).toBeNull();
    },
  );
  it("prototype workspace still shows its badge", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "prototype");
    await render(createElement(Workspace, { path: ["home"] }));
    expect(container.querySelector(".badge.prototype")?.textContent).toBe(
      "試用モード",
    );
  });
  it("production history does not expose demo labels even with a simulated log", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
    data.changes.push({
      id: "change",
      eventId: "welcome",
      changedBy: "admin",
      changedAt: data.user.createdAt,
      fromVersion: 1,
      toVersion: 2,
      changes: [{ field: "notes", oldValue: "before", newValue: "after" }],
      notificationStatus: "sent",
    });
    const log: NotificationLog = {
      id: "change",
      eventId: "welcome",
      changeLogIds: ["change"],
      type: "event_changed",
      sentBy: "admin",
      recipientCount: 1,
      status: "completed",
      createdAt: data.user.createdAt,
      completedAt: data.user.createdAt,
      simulated: true,
    };
    data.notifications.push(log);
    const text = await render(
      createElement(Workspace, {
        path: ["admin", "events", "welcome", "history"],
      }),
    );
    expect(text).toContain("通知：完了");
    expect(text).not.toMatch(forbidden);
    expect(notificationMessage(log)).toBe("1名への通知が完了しました。");
  });
});
