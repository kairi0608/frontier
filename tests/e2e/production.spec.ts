import { test, expect } from "@playwright/test";
test("production build never exposes prototype UI or reads prototype storage", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "frontier-prototype-v1",
      "invalid-prototype-data-must-not-be-read",
    );
    sessionStorage.setItem("frontier-user", "admin");
  });
  await page.goto("/auth");
  await expect(
    page.getByLabel("メールアドレス", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("パスワード", { exact: true })).toBeVisible();
  const forbidden =
    /試用モード|試用通知|実送信なし|メンバーとして試す|管理者として試す/;
  await expect(page.locator("body")).not.toContainText(forbidden);
  await expect(page.locator(".badge.prototype")).toHaveCount(0);
  for (const url of ["/home", "/admin/events", "/events"]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator("body")).not.toContainText(forbidden);
  }
  expect(
    await page.evaluate(() => localStorage.getItem("frontier-prototype-v1")),
  ).toBe("invalid-prototype-data-must-not-be-read");
  const response = await request.get("/api/data");
  expect(response.status()).toBe(401);
  expect(await response.text()).not.toMatch(forbidden);
});
