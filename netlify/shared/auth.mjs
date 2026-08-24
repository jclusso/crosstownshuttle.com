import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "cts_session";
const TTL_SECONDS = 60 * 60 * 24 * 30;

function hmac(data, secret) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

function equal(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function config() {
  const password = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.SESSION_SECRET || "";
  return { password, secret, ready: password.length > 0 && secret.length > 0 };
}

export function passwordMatches(given, expected) {
  return timingSafeEqual(sha256(given), sha256(expected));
}

export function issueToken(secret, ttl = TTL_SECONDS) {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const payload = `v1.${expires}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function tokenIsValid(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expires, signature] = parts;
  if (version !== "v1") return false;
  if (!equal(signature, hmac(`${version}.${expires}`, secret))) return false;
  return Number(expires) > Math.floor(Date.now() / 1000);
}

function isHttps(request) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return true;
  }
}

// Safari refuses Secure cookies over plain http, which breaks `netlify dev`.
function cookie(value, request, maxAge) {
  const parts = [`${COOKIE_NAME}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (isHttps(request)) parts.push("Secure");
  return parts.join("; ");
}

export function sessionCookie(token, request) {
  return cookie(token, request, TTL_SECONDS);
}

export function expiredCookie(request) {
  return cookie("", request, 0);
}

export function readToken(request) {
  const header = request.headers.get("cookie") || "";
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === COOKIE_NAME) return pair.slice(index + 1).trim();
  }
  return "";
}

export function isSignedIn(request) {
  const { secret, ready } = config();
  return ready && tokenIsValid(readToken(request), secret);
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
