/* =========================================================================
   Motorcycle Companion — zero-dependency host.
   Serves the static app AND persists user data to <DATA_DIR>/db.json via a
   tiny JSON API. Run with:  node server.js  [port]   (default 8710)

   API:
     GET  /api/userdata -> the whole user database (JSON)
     PUT  /api/userdata -> replace it (the app sends the full document)
     GET  /healthz      -> "ok" (health check)

   Environment (used for container / cloud deploys):
     PORT             listen port (Cloud Run injects this, default 8080-ish)
     DATA_DIR         directory for db.json — point at a mounted volume so the
                      data survives container restarts (default ./userdata)
     Login (all optional — see auth.js):
       GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   enable "Sign in with Google"
       BASIC_AUTH_USER  / BASIC_AUTH_PASS         enable a shared password login
       ALLOWED_EMAILS   comma-separated allowlist (empty = any Google account)
       SESSION_SECRET   cookie-signing key (auto-derived if unset)

   NOTE: with none of those set there is NO authentication — anyone who can
   reach the port can read/write the garage. Set a login method before exposing
   it publicly.
   ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const auth = require("./auth");

const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 8710;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "userdata");
const DB_FILE = path.join(DATA_DIR, "db.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readDb() {
  try { return fs.readFileSync(DB_FILE, "utf8"); }
  catch { return "{}"; }
}

function writeDb(text, cb) {
  // Atomic-ish write: temp file then rename, plus a rolling .bak of the
  // previous version so a bad write never destroys the only copy.
  const tmp = DB_FILE + ".tmp";
  fs.writeFile(tmp, text, err => {
    if (err) return cb(err);
    try { if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_FILE + ".bak"); } catch {}
    fs.rename(tmp, DB_FILE, cb);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const pathname = decodeURIComponent(url.pathname);

  /* ---- health check (unauthenticated, for Cloud Run / load balancers) ---- */
  if (pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }

  /* ---- login routes (/auth/*): Google + shared password ---- */
  if (auth.handleAuthRoute(req, res, pathname, url)) return;

  /* ---- gate everything else ---- */
  if (!auth.isAuthed(req)) {
    if (pathname.startsWith("/api/")) {          // API → 401 (the app can react)
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":"authentication required"}');
    } else {                                     // page → show the login screen
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(auth.loginPage(req));
    }
    return;
  }

  /* ---- API ---- */
  if (pathname === "/api/userdata") {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(readDb());
      return;
    }
    if (req.method === "PUT") {
      let body = "", size = 0;
      req.on("data", chunk => {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) { req.destroy(); return; } // 10 MB cap
        body += chunk;
      });
      req.on("end", () => {
        try { JSON.parse(body); } // validate before persisting
        catch { res.writeHead(400); res.end("invalid JSON"); return; }
        writeDb(body, err => {
          if (err) { res.writeHead(500); res.end("write failed"); }
          else { res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}'); }
        });
      });
      return;
    }
    res.writeHead(405); res.end();
    return;
  }

  /* ---- static files ---- */
  if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
  let rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || file.startsWith(DATA_DIR)) { // no traversal, no serving userdata
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Motorcycle Companion listening on 0.0.0.0:${PORT}`);
  console.log(`User data file: ${DB_FILE}`);
  console.log(`Auth: ${auth.enabled ? "enabled (Google / password)" : "NONE — do not expose publicly without a proxy"}`);
});
