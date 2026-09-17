import { test, expect } from "@playwright/test";
test("login protection, member responses, edit confirmation and delivery history", async ({
  page,
}) => {
  await page.goto("/events");
  await expect(page).toHaveURL(/\/auth$/);
  await page.getByRole("button", { name: "メンバーとして試す" }).click();
  await expect(
    page.getByRole("heading", { name: "次の参加予定" }),
  ).toBeVisible();
  await page.goto("/events/draft");
  await expect(
    page.getByRole("heading", { name: "イベントが見つかりません" }),
  ).toBeVisible();
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "管理者権限が必要です" }),
  ).toBeVisible();
  await page.goto("/events/welcome");
  await page.getByRole("button", { name: "未定", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "未定", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "参加", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "参加", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/auth");
  await page.getByRole("button", { name: "管理者として試す" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/admin/events/new");
  await page.getByLabel("イベント名").fill("実装検証イベント");
  await page.getByLabel("開催日時").fill("2027-10-01T13:00");
  await page.getByLabel("開催場所", { exact: false }).fill("福島市");
  await page.getByLabel("公開状態").selectOption("published");
  await page.getByRole("button", { name: "保存のみ" }).click();
  await expect(
    page.getByRole("heading", { name: "イベントを編集" }),
  ).toBeVisible();
  await page.goto("/admin/events/welcome");
  const meeting = page.getByLabel("集合時刻", { exact: true });
  const old = await meeting.inputValue();
  await meeting.fill(`${old.slice(0, 11)}12:00`);
  await page.getByRole("button", { name: "保存して参加者へ通知" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("12:30");
  await expect(page.getByRole("dialog")).toContainText("12:00");
  await expect(page.getByRole("dialog")).toContainText("参加 1名");
  await page.getByRole("button", { name: "1名へ通知", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("1名");
  await page.goto("/admin/events/welcome/history");
  await expect(page.getByText("通知：完了 · 1名")).toBeVisible();
  await page.getByText("ユーザーごとの送信結果").click();
  await expect(
    page.getByText("member@frontier.example", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ren@frontier.example", { exact: true }),
  ).not.toBeVisible();
  for (const route of [
    "/home",
    "/events",
    "/my-events",
    "/profile",
    "/admin",
    "/admin/events",
    "/admin/events/welcome",
    "/admin/events/welcome/participants",
    "/admin/events/welcome/history",
    "/admin/users",
  ]) {
    await page.goto(route);
    await expect(page.locator(".main-content")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/home");
  await page.goto("/auth");
  await page.getByRole("button", { name: "メンバーとして試す" }).click();
  await expect(
    page.getByRole("heading", { name: "次の参加予定" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});
