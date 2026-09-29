// Test-only: a minimal stand-in for Supabase Storage (bucket "center-photos").
// Permission check mirrors the real storage policy in
// supabase/migrations/20260925000002_storage.sql: uploading/deleting under
// "<center_id>/…" needs public.is_admin() or public.is_center_owner(center_id),
// evaluated through PostgREST with the caller's own token.
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const ROOT = process.env.FAKE_STORAGE_DIR ?? "/var/tmp/kurstap-storage";
const BUCKET = "center-photos";
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function safePath(objectPath) {
  const p = normalize(decodeURIComponent(objectPath)).replace(/^\/+/, "");
  if (p.includes("..") || !/^[0-9a-f-]{36}\/[\w.-]+$/i.test(p)) return null;
  return p;
}

async function allowed(restUrl, headers, objectPath) {
  const centerId = objectPath.split("/")[0];
  const call = async (fn, body) => {
    const res = await fetch(`${restUrl}/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: headers.apikey ?? "", authorization: headers.authorization ?? "", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok && (await res.json()) === true;
  };
  return (await call("is_admin", {})) || (await call("is_center_owner", { p_center_id: centerId }));
}

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

export async function handleStorage(req, res, restUrl) {
  const url = new URL(req.url, "http://x");
  const send = (status, body) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

  const pub = url.pathname.match(new RegExp(`^/object/public/${BUCKET}/(.+)$`));
  if (pub && req.method === "GET") {
    const p = safePath(pub[1]);
    const file = p && join(ROOT, p);
    if (!file || !existsSync(file)) return send(404, { error: "not_found" });
    const ext = file.split(".").pop().toLowerCase();
    return res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream" }).end(readFileSync(file));
  }

  const obj = url.pathname.match(new RegExp(`^/object/${BUCKET}/(.+)$`));
  if (obj && (req.method === "POST" || req.method === "PUT")) {
    const p = safePath(obj[1]);
    if (!p) return send(400, { error: "invalid_path" });
    if (!(await allowed(restUrl, req.headers, p))) return send(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    let body = await readBody(req);
    // supabase-js sends a File as multipart/form-data; keep only the file part.
    const ct = req.headers["content-type"] ?? "";
    const boundary = ct.match(/boundary=(.+)$/)?.[1];
    if (boundary) {
      const text = body.toString("latin1");
      const start = text.indexOf("\r\n\r\n", text.indexOf(`name=""`) >= 0 ? text.indexOf(`name=""`) : 0) + 4;
      const end = text.indexOf(`\r\n--${boundary}`, start);
      body = Buffer.from(text.slice(start, end), "latin1");
    }
    mkdirSync(dirname(join(ROOT, p)), { recursive: true });
    writeFileSync(join(ROOT, p), body);
    return send(200, { Key: `${BUCKET}/${p}`, Id: p });
  }

  if (url.pathname === `/object/${BUCKET}` && req.method === "DELETE") {
    const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    const removed = [];
    for (const raw of prefixes) {
      const p = safePath(raw);
      if (p && (await allowed(restUrl, req.headers, p))) {
        rmSync(join(ROOT, p), { force: true });
        removed.push({ name: p });
      }
    }
    return send(200, removed);
  }
  send(404, { error: "not_found" });
}
