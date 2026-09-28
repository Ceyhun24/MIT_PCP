import { expect, type Page } from "@playwright/test";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";

/** Collects JavaScript errors on the page (map tile loading errors are ignored). */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/tile|Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

export const cardNames = (page: Page) => page.locator("article h3 a").allTextContents();

type Mail = { to: string[]; body: string; receivedAt: string };

/** Signs in through the real e-mail link flow, reading the link from the local fake mailbox. */
export async function signIn(page: Page, email: string, next = "/") {
  const since = new Date().toISOString();
  await page.goto(`/giris?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-poçt").fill(email);
  await page.getByRole("button", { name: "Link göndər" }).click();
  await expect(page.getByText("E-poçtunuzu yoxlayın")).toBeVisible();

  let link: string | undefined;
  for (let i = 0; i < 30 && !link; i++) {
    const mails = (await (await fetch(`${SUPABASE_URL}/__mail`)).json()) as Mail[];
    const mail = mails.filter((m) => m.to.includes(email) && m.receivedAt >= since).pop();
    link = mail?.body.match(/href="([^"]+)"/)?.[1].replace(/&amp;/g, "&");
    if (!link) await page.waitForTimeout(500);
  }
  expect(link, "sign-in e-mail received").toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole("button", { name: "Çıxış" })).toBeVisible();
}

/** Test-only: makes an existing user a site admin through the local service key. */
export async function makeAdmin(email: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is needed for the admin test");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const users = (await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { id: string; email: string }[] };
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`no user ${email}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, { method: "PATCH", headers, body: JSON.stringify({ role: "admin" }) });
  if (!res.ok) throw new Error(`makeAdmin failed: ${res.status} ${await res.text()}`);
}

const ENGLISH = /\b(the|and|search|filter|map|list|next|previous|loading|error|page|not found|price|home|back|zoom|results|sign in|sign out|submit|review|approve|reject|email|password|confirm)\b/i;

/** Fails if the page shows English interface text (brand names excluded). */
export async function expectNoEnglish(page: Page) {
  const texts = await page.evaluate(() =>
    [document.title, document.body.innerText, ...[...document.querySelectorAll("[aria-label],[placeholder],[title],img[alt]")].flatMap((e) =>
      ["aria-label", "placeholder", "title", "alt"].map((a) => e.getAttribute(a) ?? ""),
    )].join("\n"),
  );
  const allowed = texts.replace(/Leaflet|OpenStreetMap|ODbL|Instagram|Facebook|KursTap\.az|TEST|\S+@example\.test|example\.test\S*/g, "");
  expect(allowed.match(ENGLISH)?.[0] ?? null, `English text on ${page.url()}`).toBeNull();
}
