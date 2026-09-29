// Test-only: runs PostgREST (database API), GoTrue (Supabase Auth, if
// $GOTRUE_BIN is set) and a fake mailbox behind one address,
// http://localhost:54321, the way Supabase serves them (/rest/v1, /auth/v1).
// Never used in production.
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import http from "node:http";
import { readFileSync } from "node:fs";
import { startMailCatcher } from "./mail-catcher.mjs";
import { handleStorage } from "./fake-storage.mjs";

const SECRET = "local-dev-only-secret-not-used-anywhere-else-000";
const PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54321);
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const PGRST_PORT = 54330;
const GOTRUE_PORT = 54331;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: "local", exp: 4102444800, ...payload });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const children = [];
function run(bin, args, env) {
  const child = spawn(bin, args, { stdio: "inherit", env: { ...process.env, ...env } });
  children.push(child);
  return child;
}
process.on("exit", () => children.forEach((c) => c.kill()));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

run(process.env.POSTGREST_BIN, [], {
  PGRST_DB_URI: process.env.DEV_DB_URI,
  PGRST_DB_SCHEMAS: "public",
  PGRST_DB_ANON_ROLE: "anon",
  PGRST_JWT_SECRET: SECRET,
  PGRST_SERVER_PORT: String(PGRST_PORT),
  PGRST_LOG_LEVEL: "warn",
});

const routes = { "/rest/v1": PGRST_PORT, "/storage/v1": null };
if (process.env.GOTRUE_BIN) {
  startMailCatcher({ smtpPort: 2500, httpPort: 2501 });
  run(process.env.GOTRUE_BIN, ["serve"], {
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: process.env.GOTRUE_DB_URI,
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(GOTRUE_PORT),
    API_EXTERNAL_URL: `http://localhost:${PORT}/auth/v1`,
    GOTRUE_SITE_URL: SITE_URL,
    GOTRUE_URI_ALLOW_LIST: `${SITE_URL}/**`,
    GOTRUE_JWT_SECRET: SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated", // same as Supabase's own docker setup
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "false",
    GOTRUE_SMTP_HOST: "127.0.0.1",
    GOTRUE_SMTP_PORT: "2500",
    GOTRUE_SMTP_ADMIN_EMAIL: "noreply@kurstap.test",
    GOTRUE_SMTP_SENDER_NAME: "KursTap.az",
    GOTRUE_SMTP_MAX_FREQUENCY: "1s",
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_MAILER_URLPATHS_CONFIRMATION: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_RECOVERY: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_INVITE: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: "/auth/v1/verify",
    GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: `http://localhost:${PORT}/__templates/magic-link.html`,
    GOTRUE_MAILER_TEMPLATES_CONFIRMATION: `http://localhost:${PORT}/__templates/confirmation.html`,
    GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: "KursTap.az — daxil olmaq üçün link",
    GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "KursTap.az — e-poçtunuzu təsdiqləyin",
    GOTRUE_LOG_LEVEL: "warn",
  });
  routes["/auth/v1"] = GOTRUE_PORT;
  routes["/__mail"] = 2501;
}

http
  .createServer((req, res) => {
    // The Azerbaijani e-mail templates, read by GoTrue.
    const tpl = req.url.match(/^\/__templates\/([a-z-]+\.html)$/);
    if (tpl) {
      try {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(readFileSync(`supabase/email-templates/${tpl[1]}`));
      } catch {
        res.writeHead(404).end();
      }
      return;
    }
    const prefix = Object.keys(routes).find((p) => req.url === p || req.url.startsWith(p + "/") || req.url.startsWith(p + "?"));
    if (!prefix) {
      res.writeHead(404).end();
      return;
    }
    // CORS like Supabase's API gateway does in production.
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
        "access-control-max-age": "3600",
      }).end();
      return;
    }
    if (prefix === "/storage/v1") {
      req.url = req.url.slice(prefix.length);
      handleStorage(req, res, `http://127.0.0.1:${PGRST_PORT}`).catch((e) => res.writeHead(500).end(String(e)));
      return;
    }
    const port = routes[prefix];
    const upstream = http.request(
      { host: "127.0.0.1", port, path: req.url.slice(prefix.length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
      (up) => {
        const headers = { ...up.headers };
        for (const h of Object.keys(headers)) if (h.startsWith("access-control-")) delete headers[h];
        res.writeHead(up.statusCode ?? 502, headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => res.writeHead(502).end(String(e)));
    req.pipe(upstream);
  })
  .listen(PORT, () => {
    console.log(`Local Supabase stand-in on http://localhost:${PORT}`);
    console.log(`NEXT_PUBLIC_SUPABASE_URL=http://localhost:${PORT}`);
    console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${sign({ role: "anon" })}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY=${sign({ role: "service_role" })}`);
  });
