// SOLO PER TEST LOCALI: proxy che espone PostgREST sotto /rest/v1 come fa Supabase,
// un'imitazione minima di Auth (login email/password di un solo utente admin) e di
// Storage (file su disco), e stampa le chiavi JWT firmate con il segreto locale.
// Non è un sostituto di Supabase: serve solo a provare l'app senza Docker.
// Uso: JWT_SECRET=... POSTGREST_URL=http://127.0.0.1:3001 node scripts/local-db/dev-stack.mjs
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";

const secret = process.env.JWT_SECRET ?? "local-dev-secret-local-dev-secret-0000";
const target = new URL(process.env.POSTGREST_URL ?? "http://127.0.0.1:3001");
const port = Number(process.env.PORT ?? 54321);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iat: 1700000000, exp: 4100000000, ...payload });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

if (process.argv[2] === "keys") {
  console.log(`ANON_KEY=${sign({ role: "anon" })}`);
  console.log(`SERVICE_ROLE_KEY=${sign({ role: "service_role" })}`);
  if (process.argv[3]) console.log(`ADMIN_JWT=${sign({ role: "authenticated", sub: process.argv[3] })}`);
  process.exit(0);
}

const ADMIN = {
  id: process.env.LOCAL_ADMIN_ID ?? "00000000-0000-4000-8000-000000000001",
  email: process.env.LOCAL_ADMIN_EMAIL ?? "admin@sgreeners.local",
  password: process.env.LOCAL_ADMIN_PASSWORD ?? "sgreeners",
};
const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR ?? "/tmp/sgreeners-storage";
const user = { id: ADMIN.id, aud: "authenticated", role: "authenticated", email: ADMIN.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
const verify = (auth) => {
  const token = (auth ?? "").replace(/^Bearer /, "");
  const [h, b, sig] = token.split(".");
  if (!sig || createHmac("sha256", secret).update(`${h}.${b}`).digest("base64url") !== sig) return null;
  return JSON.parse(Buffer.from(b, "base64url").toString());
};

async function fakeAuth(req, res, url) {
  if (url.startsWith("/auth/v1/token")) {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    if (url.includes("grant_type=password") && (body.email !== ADMIN.email || body.password !== ADMIN.password)) {
      return json(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    }
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access_token = sign({ role: "authenticated", sub: ADMIN.id, email: ADMIN.email, aud: "authenticated", exp });
    return json(res, 200, { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "local-refresh", user });
  }
  if (url.startsWith("/auth/v1/user")) {
    const claims = verify(req.headers.authorization);
    return claims?.sub === ADMIN.id ? json(res, 200, user) : json(res, 401, { message: "invalid JWT" });
  }
  if (url.startsWith("/auth/v1/logout")) {
    res.writeHead(204);
    return res.end();
  }
  return json(res, 404, { message: "endpoint auth non simulato" });
}

async function fakeStorage(req, res, url) {
  const m = url.match(/^\/storage\/v1\/object\/(?:public\/|authenticated\/)?([^/?]+)\/([^?]+)/);
  if (!m) return json(res, 404, { message: "endpoint storage non simulato" });
  const file = join(STORAGE_DIR, m[1], decodeURIComponent(m[2]));
  if (req.method === "POST" || req.method === "PUT") {
    if (existsSync(file) && req.headers["x-upsert"] !== "true") return json(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await readBody(req));
    return json(res, 200, { Key: `${m[1]}/${m[2]}` });
  }
  if (!existsSync(file)) return json(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
  res.writeHead(200, { "content-type": "application/octet-stream" });
  res.end(readFileSync(file));
}

http
  .createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.startsWith("/auth/v1")) return void fakeAuth(req, res, url);
    if (url.startsWith("/storage/v1")) return void fakeStorage(req, res, url);
    if (!url.startsWith("/rest/v1")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Solo /rest/v1 è disponibile nello stack locale" }));
      return;
    }
    const headers = { ...req.headers, host: target.host };
    if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
    const upstream = http.request(
      { hostname: target.hostname, port: target.port, path: url.slice("/rest/v1".length) || "/", method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(upstream);
  })
  .listen(port, () => console.log(`Proxy Supabase locale su http://127.0.0.1:${port}/rest/v1 → ${target.href}`));
