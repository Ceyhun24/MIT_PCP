// Sign-in by e-mail link, writing a review, and admin moderation.
import { expect, test } from "@playwright/test";
import { expectNoEnglish, expectNoHorizontalScroll, makeAdmin, signIn, trackErrors } from "./helpers";

test("a review appears only after admin approval", async ({ browser }, info) => {
  const run = `${info.project.name}-${Date.now()}`;
  const parentEmail = `parent-${run}@example.test`;
  const adminEmail = `admin-${run}@example.test`;
  const center = "/merkez/test-bagca-2";
  const text = `Çox səliqəli bağçadır, müəllimlər diqqətlidir. (${run})`;

  // 1. Visitor is asked to sign in.
  const parent = await (await browser.newContext()).newPage();
  const errors = trackErrors(parent);
  await parent.goto(center);
  await parent.getByRole("link", { name: "Rəy yazmaq üçün daxil olun" }).click();
  await expect(parent).toHaveURL(/\/giris\?next=/);
  await expectNoHorizontalScroll(parent);

  // 2. Parent signs in with the e-mail link and is sent back to the listing.
  await signIn(parent, parentEmail, center);
  await expect(parent).toHaveURL(new RegExp(`${center}$`));

  // 3. Writes a review (4 stars).
  await parent.locator("label", { has: parent.getByRole("radio", { name: "4 ulduz" }) }).click();
  await expect(parent.getByRole("radio", { name: "4 ulduz" })).toBeChecked();
  await parent.getByLabel("Rəyiniz").fill(text);
  await parent.getByLabel("Rəyin yanında göstəriləcək adınız").fill("Aysel");
  await parent.getByRole("button", { name: "Göndər" }).click();
  await expect(parent.getByText("Təşəkkür edirik! Rəyiniz moderator")).toBeVisible();
  await expect(parent.getByText("Moderasiyada gözləyir")).toBeVisible();
  await expectNoHorizontalScroll(parent);
  await expectNoEnglish(parent);
  await parent.screenshot({ path: `test-results/review-submitted-${info.project.name}.png`, fullPage: true });

  // 4. Not public yet.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(center);
  await expect(visitor.getByText(text)).toHaveCount(0);

  // 5. A non-admin cannot open moderation.
  await parent.goto("/admin/reyler");
  await expect(parent.getByText("Bu səhifə yalnız administratorlar üçündür.")).toBeVisible();

  // 6. Admin approves it.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, adminEmail);
  await makeAdmin(adminEmail);
  await admin.goto("/admin/reyler");
  const item = admin.locator("li", { hasText: text });
  await expect(item).toBeVisible();
  await expectNoHorizontalScroll(admin);
  await expectNoEnglish(admin);
  if (info.project.name === "desktop-1440") await admin.screenshot({ path: "test-results/admin-moderation.png" });
  await item.getByRole("button", { name: "Təsdiqlə" }).click();
  await expect(admin.locator("li", { hasText: text })).toHaveCount(0);

  // 7. Now public, with name and stars; average rating shown.
  await visitor.reload();
  const review = visitor.locator("li", { hasText: text });
  await expect(review).toBeVisible();
  await expect(review).toContainText("Aysel");
  await expect(review.getByLabel("4 ulduz")).toBeVisible();
  await expect(visitor.locator("main")).toContainText("rəy)");
  await review.screenshot({ path: `test-results/review-public-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
