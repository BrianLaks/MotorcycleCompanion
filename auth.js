/* =========================================================================
   auth.js — login gate for the server. Two ways in, both optional:

     • Google Sign-In  (set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
     • Shared password (the existing BASIC_AUTH_USER / BASIC_AUTH_PASS)

   A successful login sets a signed, HttpOnly session cookie (HMAC-SHA256).
   The old `Authorization: Basic` header is still accepted too, so curl and
   bookmarked-with-creds URLs keep working.

   Access control: ALLOWED_EMAILS (comma-separated, lower-case). Empty = any
   Google account may sign in. Add emails later to lock it down — no code change.

   Zero dependencies — Node stdlib only. The Google ID token is trusted because
   it comes straight from Google's token endpoint over TLS in response to our
   client-secret-authenticated request (standard server-side code flow), so we
   read its claims without re-verifying the JWT signature, but we DO check the
   audience, issuer and email_verified.
   ========================================================================= */
const https = require("https");
const crypto = require("crypto");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const ALLOWED = (process.env.ALLOWED_EMAILS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const SESSION_TTL = 30 * 24 * 3600; // 30 days
const SESSION_SECRET = process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update("mc|" + CLIENT_SECRET + "|" + BASIC_PASS).digest("hex");

const googleOn = !!(CLIENT_ID && CLIENT_SECRET);
const passwordOn = !!BASIC_PASS;
const enabled = googleOn || passwordOn;

/* ---------- small helpers ---------- */
const b64url = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function b64urlBuf(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Buffer.from(s, "base64"); }
const hmac = data => b64url(crypto.createHmac("sha256", SESSION_SECRET).update(data).digest());
function safeEq(a, b) { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && crypto.timingSafeEqual(A, B); }
const isHttps = req => req.headers["x-forwarded-proto"] === "https" || !!(req.socket && req.socket.encrypted);
const redirectUri = req => `${isHttps(req) ? "https" : "http"}://${req.headers.host}/auth/callback`;

function parseCookies(req) {
  const out = {}; const h = req.headers.cookie; if (!h) return out;
  h.split(";").forEach(c => { const i = c.indexOf("="); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
function setCookie(res, name, val, { secure = false, maxAge = null } = {}) {
  let c = `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax`;
  if (secure) c += "; Secure";
  if (maxAge != null) c += `; Max-Age=${maxAge}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, c) : c);
}

/* ---------- session ---------- */
function makeSession(sub) {
  const payload = b64url(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }));
  return payload + "." + hmac(payload);
}
function readSession(token) {
  if (!token) return null;
  const i = token.lastIndexOf("."); if (i < 0) return null;
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  if (!safeEq(sig, hmac(payload))) return null;
  try { const p = JSON.parse(b64urlBuf(payload).toString("utf8")); return p.exp > Date.now() / 1000 ? p : null; }
  catch { return null; }
}

function basicOk(req) {
  if (!passwordOn) return false;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [u, p] = Buffer.from(h.slice(6), "base64").toString().split(":");
  return u === BASIC_USER && p === BASIC_PASS;
}

function isAuthed(req) {
  if (!enabled) return true;
  return !!readSession(parseCookies(req).mc_session) || basicOk(req);
}

/* Who is this request? { sub } where sub is a Google email, or the literal
   "password" for the built-in shared-password login. null when not signed in. */
function sessionOf(req) {
  const s = readSession(parseCookies(req).mc_session);
  if (s) return s;
  if (basicOk(req)) return { sub: "password" };
  return null;
}

/* ADMIN = signed in with the built-in shared password (or the Basic Auth
   header), NOT with Google. Used to gate owner-only data like the motorcycle
   request queue. With no auth configured at all (local dev) everyone is admin. */
function isAdmin(req) {
  if (!enabled) return true;
  const s = sessionOf(req);
  return !!s && s.sub === "password";
}

/* ---------- Google OAuth ---------- */
function exchangeCode(code, redirect, cb) {
  const body = new URLSearchParams({
    code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    redirect_uri: redirect, grant_type: "authorization_code",
  }).toString();
  const r = https.request("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
  }, resp => {
    let d = ""; resp.on("data", c => d += c);
    resp.on("end", () => { try { cb(null, JSON.parse(d)); } catch (e) { cb(e); } });
  });
  r.on("error", cb); r.write(body); r.end();
}
function decodeIdToken(idToken) {
  try { return JSON.parse(b64urlBuf(String(idToken).split(".")[1]).toString("utf8")); }
  catch { return null; }
}

/* ---------- login page ---------- */
function loginPage(req, msg) {
  const err = msg ? `<p style="color:#F0656E;font-size:13px">${msg}</p>` : "";
  const google = googleOn ? `<a class="g" href="/auth/google">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.6 35.4 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
      Sign in with Google</a>` : "";
  const divider = (googleOn && passwordOn) ? `<div class="or"><span>or</span></div>` : "";
  const pass = passwordOn ? `<form method="POST" action="/auth/password">
      <input type="password" name="password" placeholder="Shared password" autocomplete="current-password" autofocus>
      <button type="submit">Enter with password</button></form>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Motorcycle Companion</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121317;color:#ECEDEF;
    font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .card{width:min(360px,92vw);background:#1C1E23;border:1px solid #2E323A;border-radius:16px;
    padding:28px 26px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  .brand{font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:13px;margin:0 0 2px}
  .brand b{color:#E23440}
  .sub{color:#9A9EA8;font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 20px}
  a.g{display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;
    background:#fff;color:#1a1a1a;font-weight:600;padding:11px;border-radius:9px;border:1px solid #dadce0}
  a.g:hover{background:#f7f8f8}
  .or{display:flex;align-items:center;gap:10px;color:#62656D;font-size:12px;margin:16px 0}
  .or::before,.or::after{content:"";flex:1;height:1px;background:#2E323A}
  input{width:100%;padding:10px;border-radius:9px;border:1px solid #2E323A;background:#23262C;color:#ECEDEF;font-size:14px;margin-bottom:10px}
  button{width:100%;padding:11px;border-radius:9px;border:0;background:#E23440;color:#fff;font-weight:650;font-size:14px;cursor:pointer}
  button:hover{filter:brightness(1.06)}
</style></head><body>
  <div class="card">
    <p class="brand">Motorcycle<b>·</b>Companion</p>
    <p class="sub">Garage &amp; Service Log</p>
    ${err}${google}${divider}${pass}
  </div>
</body></html>`;
}

/* ---------- route handler (returns true if it handled the request) ---------- */
function handleAuthRoute(req, res, pathname, url) {
  if (!pathname.startsWith("/auth/")) return false;

  if (pathname === "/auth/login") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(loginPage(req, url.searchParams.get("e") ? "That password didn't match." : ""));
    return true;
  }

  if (pathname === "/auth/logout") {
    setCookie(res, "mc_session", "", { secure: isHttps(req), maxAge: 0 });
    res.writeHead(302, { Location: "/auth/login" }); res.end();
    return true;
  }

  if (pathname === "/auth/password" && req.method === "POST") {
    let body = ""; req.on("data", c => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      const pw = new URLSearchParams(body).get("password") || "";
      if (passwordOn && safeEq(pw, BASIC_PASS)) {
        setCookie(res, "mc_session", makeSession("password"), { secure: isHttps(req), maxAge: SESSION_TTL });
        res.writeHead(302, { Location: "/" }); res.end();
      } else {
        res.writeHead(302, { Location: "/auth/login?e=1" }); res.end();
      }
    });
    return true;
  }

  if (pathname === "/auth/google") {
    if (!googleOn) { res.writeHead(302, { Location: "/auth/login" }); res.end(); return true; }
    const state = b64url(crypto.randomBytes(16));
    setCookie(res, "mc_oauth_state", state, { secure: isHttps(req), maxAge: 600 });
    const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirectUri(req), response_type: "code",
      scope: "openid email", state, access_type: "online", prompt: "select_account",
    }).toString();
    res.writeHead(302, { Location: auth }); res.end();
    return true;
  }

  if (pathname === "/auth/callback") {
    const code = url.searchParams.get("code"), state = url.searchParams.get("state");
    const cookieState = parseCookies(req).mc_oauth_state;
    setCookie(res, "mc_oauth_state", "", { secure: isHttps(req), maxAge: 0 });
    if (!googleOn || !code || !state || !cookieState || !safeEq(state, cookieState)) {
      res.writeHead(400, { "Content-Type": "text/plain" }); res.end("login failed (bad state)"); return true;
    }
    exchangeCode(code, redirectUri(req), (err, tok) => {
      const claims = (!err && tok && tok.id_token) ? decodeIdToken(tok.id_token) : null;
      const issOk = claims && /(^|\/\/)accounts\.google\.com$/.test(claims.iss || "");
      const verified = claims && (claims.email_verified === true || claims.email_verified === "true");
      if (!claims || claims.aud !== CLIENT_ID || !issOk || !claims.email || !verified) {
        res.writeHead(403, { "Content-Type": "text/html" });
        res.end(loginPage(req, "Google sign-in failed. Try again.")); return;
      }
      const email = claims.email.toLowerCase();
      if (ALLOWED.length && !ALLOWED.includes(email)) {
        res.writeHead(403, { "Content-Type": "text/html" });
        res.end(loginPage(req, `${email} isn't on the guest list.`)); return;
      }
      setCookie(res, "mc_session", makeSession(email), { secure: isHttps(req), maxAge: SESSION_TTL });
      res.writeHead(302, { Location: "/" }); res.end();
    });
    return true;
  }

  return false;
}

module.exports = { enabled, isAuthed, isAdmin, sessionOf, handleAuthRoute, loginPage };
