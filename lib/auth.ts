import crypto from "crypto";
import type { Role, SessionPayload } from "./types";
import { ApiError } from "./errors";

// A minimal, dependency-free signed session token (HMAC-SHA256, JWT-shaped:
// header.payload.signature, all base64url). We intentionally avoid pulling
// in a JWT library here — this repo's dependencies were installed on the
// laptop already, and adding a new package would mean everyone re-running
// `npm install` before the next `npm run dev`. This gets the same practical
// result (a tamper-proof, expiring bearer token) with zero new deps.

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error(
    "SESSION_SECRET is not set — add a random string to .env.local (see SETUP.md)."
  );
}

const ONE_DAY_SECONDS = 60 * 60 * 24;

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

export function signToken(payload: SessionPayload, expiresInSeconds = ONE_DAY_SECONDS): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const headerPart = base64url(JSON.stringify(header));
  const bodyPart = base64url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", SECRET as string)
    .update(`${headerPart}.${bodyPart}`)
    .digest("base64url");

  return `${headerPart}.${bodyPart}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, bodyPart, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", SECRET as string)
    .update(`${headerPart}.${bodyPart}`)
    .digest("base64url");

  // Lengths can differ if the token was tampered with — guard before
  // timingSafeEqual, which throws on mismatched buffer lengths.
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const body = JSON.parse(Buffer.from(bodyPart, "base64url").toString("utf8"));
    if (typeof body.exp === "number" && Math.floor(Date.now() / 1000) > body.exp) return null;
    if (!body.sub || !body.role || !body.name) return null;
    return { sub: body.sub, role: body.role, name: body.name };
  } catch {
    return null;
  }
}

/** Pulls the session out of an `Authorization: Bearer <token>` header. */
export function getSession(req: Request): SessionPayload | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice("Bearer ".length));
}

/**
 * Throws a 401 if there's no valid session, or a 403 if `role` is given and
 * doesn't match. Use at the top of every route handler.
 */
export function requireSession(req: Request, role?: Role): SessionPayload {
  const session = getSession(req);
  if (!session) throw new ApiError(401, "Missing or invalid session token");
  if (role && session.role !== role) {
    throw new ApiError(403, `This endpoint is ${role}-only`);
  }
  return session;
}
