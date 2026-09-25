// Test-only: runs PostgREST and a tiny proxy on http://localhost:54321 so that
// @supabase/supabase-js can talk to the local test database like to Supabase.
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import http from "node:http";

const SECRET = "local-dev-only-secret-not-used-anywhere-else-000";
const PGRST_PORT = 54330;
const PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54321);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: "local", exp: 4102444800, ...payload });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const pgrst = spawn(process.env.POSTGREST_BIN, [], {
  stdio: "inherit",
  env: {
    ...process.env,
    PGRST_DB_URI: process.env.DEV_DB_URI,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: SECRET,
    PGRST_SERVER_PORT: String(PGRST_PORT),
    PGRST_LOG_LEVEL: "warn",
  },
});
process.on("exit", () => pgrst.kill());
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

http
  .createServer((req, res) => {
    if (!req.url.startsWith("/rest/v1")) {
      res.writeHead(404).end();
      return;
    }
    const headers = { ...req.headers, host: `127.0.0.1:${PGRST_PORT}` };
    const upstream = http.request(
      { host: "127.0.0.1", port: PGRST_PORT, path: req.url.slice("/rest/v1".length) || "/", method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
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
  });
