// Public site on the FAKE "TEST" listings of the local stack.
import { expect, test } from "@playwright/test";
import { cardNames, expectNoEnglish, expectNoHorizontalScroll, trackErrors } from "./helpers";

test("home, section toggle, text search, filters", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("article").first()).toBeVisible();
  expect((await cardNames(page)).every((n) => n.startsWith("TEST Bağça"))).toBe(true);
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Tədris mərkəzləri" }).click();
  await page.waitForURL(/type=training_center/);
  await expect(page.locator("article").first()).toBeVisible();
  expect((await cardNames(page)).every((n) => n.startsWith("TEST Kurs"))).toBe(true);

  // A course name finds its center.
  await page.locator("#q").fill("riyaziyyat");
  await page.getByRole("button", { name: "Axtar", exact: true }).click();
  await page.waitForURL(/q=riyaziyyat/);
  await expect(page.locator("article h3", { hasText: "TEST Kurs Mərkəzi 1" })).toBeVisible();
  expect(await cardNames(page)).toEqual(["TEST Kurs Mərkəzi 1"]);

  // Price ≤ 400 ₼ + playground.
  await page.goto("/");
  await page.getByRole("button", { name: /Filtrlər/ }).click();
  await page.locator("input[name=pmax]").fill("400");
  await page.getByLabel("Oyun meydançası").check();
  await page.getByRole("button", { name: "Tətbiq et" }).click();
  await page.waitForURL(/pmax=400/);
  await expect(page.getByText("nəticə").first()).toBeVisible();
  expect((await cardNames(page)).sort()).toEqual(["TEST Bağça 1", "TEST Bağça 2"]);

  await page.goto("/?district=xazar");
  await expect(page.locator("article").first()).toBeVisible();
  expect(await cardNames(page)).toEqual(["TEST Bağça 5"]);

  await page.goto("/?age=10&type=training_center");
  await expect(page.locator("article").first()).toBeVisible();
  expect(await cardNames(page)).toContain("TEST Kurs Mərkəzi 1");
  expect(await cardNames(page)).not.toContain("TEST Kurs Mərkəzi 3");
  expect(errors).toEqual([]);
});

test("near me: distance order and radius", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Yaxınlığımda/ }).click();
  await page.waitForURL(/lat=/);
  await expect(page.getByText("Məsafəyə görə sıralanıb")).toBeVisible();
  const five = await cardNames(page);
  expect(five).toEqual(["TEST Bağça 1", "TEST Bağça 6", "TEST Bağça 2", "TEST Bağça 3"]);

  await page.getByLabel("Radius").selectOption("3");
  await page.waitForURL(/r=3/);
  await expect(page.locator("article h3", { hasText: "TEST Bağça 2" })).toHaveCount(0);
  expect(await cardNames(page)).toEqual(["TEST Bağça 1", "TEST Bağça 6"]);
  await expect(page.locator("article").first()).toContainText("40 m məsafədə");

  await page.getByLabel("Radius").selectOption("1");
  await page.waitForURL(/r=1/);
  await expect(page.locator("article h3", { hasText: "TEST Bağça 6" })).toHaveCount(0);
  expect(await cardNames(page)).toEqual(["TEST Bağça 1"]);
});

test("list and map stay in sync", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator("article").first()).toBeVisible();
  if (info.project.name === "mobile-375") {
    await page.locator("article").first().getByRole("button", { name: /Xəritə/ }).click();
    await expect(page.locator(".kt-pin--selected")).toBeVisible();
  } else {
    await expect(page.locator(".kt-pin").first()).toBeVisible();
    await page.locator("article").nth(1).hover();
    const second = (await page.locator("article h3 a").allTextContents())[1];
    await expect(page.locator(".leaflet-marker-icon:has(.kt-pin--selected)")).toHaveAttribute("title", second);
    // A pin that sits apart from the others, so nothing covers it.
    await page.locator('.leaflet-marker-icon[title="TEST Bağça 4"]').click();
    await expect(page.locator("article.ring-2 h3")).toHaveText("TEST Bağça 4");
  }
});

test("listing pages", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/merkez/test-kurs-1");
  const main = page.locator("main");
  await expect(main).toContainText("İngilis dili (başlanğıc)");
  await expect(main).toContainText("90 ₼ / ayda");
  await expect(main).toContainText("80–200 ₼ / ayda");
  await expectNoHorizontalScroll(page);

  await page.goto("/merkez/test-bagca-3");
  await expect(main).toContainText("Təsdiqlənməyib");
  await expect(main).toContainText("Məlumat yoxdur");

  const res = await page.goto("/merkez/movcud-deyil");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Səhifə tapılmadı")).toBeVisible();
  expect(errors).toEqual([]);
});

test("no untranslated (English) interface text", async ({ page }) => {
  for (const url of ["/", "/?type=training_center", "/merkez/test-kurs-1", "/merkez/test-bagca-6", "/giris", "/movcud-deyil"]) {
    await page.goto(url);
    await page.waitForTimeout(500);
    await expectNoEnglish(page);
    await expectNoHorizontalScroll(page);
  }
});
