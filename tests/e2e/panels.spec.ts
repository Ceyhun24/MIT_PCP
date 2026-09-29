// Provider panel (claim → edit own center, courses, photos, replies) and the
// site-admin panel (claims, hide/show, create, CSV import) on FAKE data.
import { expect, test } from "@playwright/test";
import { adminInsert, adminRest, expectNoEnglish, expectNoHorizontalScroll, makeAdmin, signIn, trackErrors } from "./helpers";

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

type C = { id: string; slug: string; name: string; type: string; price_min_azn: number | null };

test("provider claims a center, admin approves, provider edits only own center", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const run = `${info.project.name}-${Date.now()}`;
  // A fresh unclaimed FAKE listing for this run, and another center the provider must not touch.
  const center = await adminInsert<C>("centers", {
    type: "kindergarten",
    name: `TEST Panel Bağçası ${run}`,
    slug: `test-panel-${run.toLowerCase()}`,
    external_id: `test:panel-${run}`,
    // Spread out so pins from repeated runs don't overlap on the map.
    location: `SRID=4326;POINT(${(49.7 + Math.random() * 0.08).toFixed(5)} ${(40.44 + Math.random() * 0.03).toFixed(5)})`,
    source_url: "https://example.test/panel",
    collected_at: new Date().toISOString(),
  });
  const [other] = await adminRest<C[]>("centers?select=id,slug,name,type,price_min_azn&slug=eq.test-bagca-1");

  // --- Provider asks to manage the listing
  const provider = await (await browser.newContext()).newPage();
  const errors = trackErrors(provider);
  await signIn(provider, `provider-${run}@example.test`, `/merkez/${center.slug}`);
  await provider.getByRole("link", { name: "İdarəetmə üçün müraciət et" }).click();
  await provider.getByLabel("Təşkilatın adı").fill(`TEST MMC ${run}`);
  await provider.getByLabel("Əlaqə telefonu").fill("+994 50 000 00 99");
  await provider.getByLabel("Mərkəzdəki vəzifəniz").fill("Direktoram.");
  await provider.getByRole("button", { name: "Müraciət göndər" }).click();
  await expect(provider.getByText("Müraciətiniz qəbul edildi")).toBeVisible();
  await provider.goto("/panel");
  await expect(provider.getByText("Yoxlanılır")).toBeVisible();
  await expectNoEnglish(provider);
  await expectNoHorizontalScroll(provider);
  // Not approved yet → cannot edit.
  await provider.goto(`/panel/merkez/${center.id}`);
  await expect(provider.getByText("Bu mərkəzi redaktə etmək icazəniz yoxdur.")).toBeVisible();

  // --- Admin approves the claim
  const admin = await (await browser.newContext()).newPage();
  const adminEmail = `admin-${run}@example.test`;
  await signIn(admin, adminEmail);
  await makeAdmin(adminEmail);
  await admin.goto("/admin/iddialar");
  const claim = admin.locator("li", { hasText: `TEST MMC ${run}` });
  await expect(claim).toContainText(center.name);
  await expectNoEnglish(admin);
  await expectNoHorizontalScroll(admin);
  await claim.getByRole("button", { name: "Təsdiqlə" }).click();
  await expect(admin.locator("li", { hasText: `TEST MMC ${run}` })).toHaveCount(0);

  // --- Provider edits own center
  await provider.goto("/panel");
  await expect(provider.getByText("Təsdiqlənib").first()).toBeVisible();
  await provider.getByRole("link", { name: "Redaktə et" }).click();
  await expect(provider).toHaveURL(new RegExp(`/panel/merkez/${center.id}`));
  await expectNoHorizontalScroll(provider);
  await expectNoEnglish(provider);
  await provider.getByLabel("Aylıq qiymət, ən az (₼)").fill("250");
  await provider.getByLabel("Aylıq qiymət, ən çox (₼)").fill("400");
  await provider.getByLabel("Hovuz").check();
  await provider.getByLabel("İş saatları").fill("B.e.–Cümə 08:00–19:00");
  await provider.locator("#melumat").getByRole("button", { name: "Yadda saxla" }).click();
  await expect(provider.locator("#melumat").getByText("Yadda saxlandı.")).toBeVisible();

  // Course
  const newCourse = provider.locator("#kurslar form").last();
  await newCourse.getByLabel("Kursun adı").fill("Şahmat dərnəyi");
  await newCourse.getByLabel("Qiymət (₼)").fill("40");
  await newCourse.getByLabel("Qiymət nə üçündür").selectOption("month");
  await newCourse.getByRole("button", { name: "Kurs əlavə et" }).click();
  await expect(provider.locator("#kurslar input[name=name][value='Şahmat dərnəyi']")).toBeVisible();

  // Photo
  await provider.locator("#sekiller input[type=file]").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await provider.locator("#sekiller").getByLabel("Şəklin qısa təsviri").fill("Oyun otağı");
  await provider.locator("#sekiller button[type=submit]", { hasText: "Şəkil yüklə" }).click();
  await expect(provider.locator("#sekiller img[alt='Oyun otağı']")).toBeVisible();
  expect(await provider.locator("#sekiller img[alt='Oyun otağı']").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // --- Tampering: provider tries to save into ANOTHER center → blocked by RLS
  const before = (await adminRest<C[]>(`centers?select=id,name,price_min_azn&id=eq.${other.id}`))[0];
  await provider.locator("#melumat input[name=id]").evaluate((el, id) => ((el as HTMLInputElement).value = id), other.id);
  await provider.getByLabel("Ad", { exact: true }).fill("HACKED");
  await provider.locator("#melumat").getByRole("button", { name: "Yadda saxla" }).click();
  await expect(provider.locator("#melumat").getByText("bu mərkəzi redaktə etmək icazəniz yoxdur")).toBeVisible();
  const after = (await adminRest<C[]>(`centers?select=id,name,price_min_azn&id=eq.${other.id}`))[0];
  expect(after).toEqual(before);
  await provider.goto(`/panel/merkez/${other.id}`);
  await expect(provider.getByText("Bu mərkəzi redaktə etmək icazəniz yoxdur.")).toBeVisible();

  // --- Public page shows the provider's changes
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/merkez/${center.slug}`);
  const main = visitor.locator("main");
  await expect(main).toContainText("250–400 ₼ / ayda");
  await expect(main).toContainText("Hovuz");
  await expect(main).toContainText("Şahmat dərnəyi");
  await expect(main).toContainText("40 ₼ / ayda");
  await expect(main).toContainText("Təsdiqlənib");
  await expect(visitor.locator("img[alt='Oyun otağı']")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "İdarəetmə üçün müraciət et" })).toHaveCount(0);

  // --- A review (by the admin account), approved, then the provider replies
  await admin.goto(`/merkez/${center.slug}`);
  await admin.locator("label", { has: admin.getByRole("radio", { name: "5 ulduz" }) }).click();
  await admin.getByLabel("Rəyiniz").fill(`Əla bağçadır, tövsiyə edirəm. ${run}`);
  await admin.getByLabel("Rəyin yanında göstəriləcək adınız").fill("Kamran");
  await admin.getByRole("button", { name: "Göndər" }).click();
  await expect(admin.getByText("Moderasiyada gözləyir")).toBeVisible();
  await admin.goto("/admin/reyler");
  await admin.locator("li", { hasText: run }).getByRole("button", { name: "Təsdiqlə" }).click();
  await expect(admin.locator("li", { hasText: run })).toHaveCount(0);

  await provider.goto(`/panel/merkez/${center.id}#reyler`);
  const reviewItem = provider.locator("#reyler li", { hasText: run });
  await reviewItem.getByLabel("Cavab yazın").fill("Xoş sözlərə görə təşəkkür edirik!");
  await reviewItem.getByRole("button", { name: "Cavabı yadda saxla" }).click();
  await expect(reviewItem.getByText("Cavab dərc olundu.")).toBeVisible();
  await visitor.reload();
  await visitor.waitForLoadState("networkidle");
  const publicReview = visitor.locator("li", { hasText: run });
  await expect(publicReview).toContainText("Mərkəzin cavabı");
  await expect(publicReview).toContainText("Xoş sözlərə görə təşəkkür edirik!");
  await visitor.screenshot({ path: `test-results/provider-public-${info.project.name}.png`, fullPage: true });
  await provider.goto(`/panel/merkez/${center.id}`);
  await provider.waitForLoadState("networkidle");
  await provider.screenshot({ path: `test-results/provider-editor-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("admin hides/shows, creates a center, and imports CSV", async ({ page }, info) => {
  test.setTimeout(120_000);
  const run = `${info.project.name}-${Date.now()}`;
  const email = `admin2-${run}@example.test`;
  await signIn(page, email);
  await makeAdmin(email);
  for (const url of ["/admin", "/admin/iddialar", "/admin/reyler", "/admin/merkezler", "/admin/idxal", "/panel"]) {
    await page.goto(url);
    await expectNoEnglish(page);
    await expectNoHorizontalScroll(page);
  }

  // Hide → gone from public search → show again
  await page.goto("/admin/merkezler?q=TEST Bağça 5");
  const row = page.locator("li", { hasText: "TEST Bağça 5" });
  await row.getByRole("button", { name: "Gizlət" }).click();
  await expect(row).toContainText("Gizlədilib");
  const visitor = await (await page.context().browser()!.newContext()).newPage();
  await visitor.goto("/?district=xazar");
  await expect(visitor.getByText("Heç nə tapılmadı")).toBeVisible();
  await row.getByRole("button", { name: "Göstər" }).click();
  await expect(row).not.toContainText("Gizlədilib");
  await visitor.reload();
  await expect(visitor.locator("article h3", { hasText: "TEST Bağça 5" })).toBeVisible();

  // Create a new center → lands in the editor
  await page.goto("/admin/merkezler");
  await page.getByPlaceholder("Ad", { exact: true }).fill(`TEST Yeni Mərkəz ${run}`);
  await page.getByRole("button", { name: "Yeni mərkəz" }).click();
  await expect(page).toHaveURL(/\/panel\/merkez\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`TEST Yeni Mərkəz ${run}`);
  await expect(page.getByText("Yalnız administrator")).toBeVisible();

  // CSV import: bad file → Azerbaijani problems; good file → check, then import
  const header = "external_id,type,verification_status,name,district,address,lat,lng,phone,email,website,instagram,facebook,working_hours,age_min_years,age_max_years,price_min_azn,price_max_azn,languages,group_size_max,amenities,description,source_url,collected_at,field_sources";
  const good = `${header}\ntest:import-${run},kindergarten,unverified,TEST İdxal Bağçası ${run},nasimi,TEST ünvan,40.4500,49.7500,,,,,,,,,,,az,,playground,,https://example.test/idxal,2026-09-29T10:00:00Z,{}\n`;
  const bad = `${header}\ntest:bad-${run},school,unverified,TEST Səhv,moscow,,55.7,37.6,,,,,,,,,abc,,,,,,https://example.test/x,2026-09-29T10:00:00Z,{}\n`;
  await page.goto("/admin/idxal");
  await expectNoEnglish(page);
  await page.locator("input[name=centers]").setInputFiles({ name: "centers.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
  await page.getByRole("button", { name: "Yoxla" }).click();
  const alert = page.locator("form [role=alert]");
  await expect(alert).toContainText("problem tapıldı");
  await expect(alert).toContainText("Naməlum rayon «moscow»");
  await expect(alert).toContainText("Bakıdan kənardadır");
  await expect(page.getByRole("button", { name: "İdxal et" })).toBeDisabled();

  await page.locator("input[name=centers]").setInputFiles({ name: "centers.csv", mimeType: "text/csv", buffer: Buffer.from(good) });
  await page.getByRole("button", { name: "Yoxla" }).click();
  await expect(page.getByRole("status")).toContainText("Hər şey qaydasındadır. Yeni: 1");
  expect(await adminRest<unknown[]>(`centers?external_id=eq.test:import-${run}`)).toHaveLength(0); // check writes nothing
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "İdxal et" }).click();
  await expect(page.getByRole("status")).toContainText("İdxal tamamlandı: 1");
  await page.screenshot({ path: `test-results/admin-import-${info.project.name}.png`, fullPage: true });

  await visitor.goto(`/?q=${encodeURIComponent(`İdxal Bağçası ${run}`)}`);
  await expect(visitor.locator("article")).toHaveCount(1);
  await expect(visitor.locator("article")).toContainText("Təsdiqlənməyib");
});
