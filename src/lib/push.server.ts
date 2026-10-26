// Server-only: web push sending (VAPID) and signed tokens for notification buttons.
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { p256 } from "@noble/curves/nist.js";

const enc = new TextEncoder();
const b64u = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function sha256(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

let cached: { publicKey: string; privateKey: string } | null = null;
/** VAPID key pair derived from the VAPID_SEED secret, so no key file is needed. */
export async function vapidKeys() {
  if (cached) return cached;
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("Reminders are not set up yet");
  let d = await sha256(`carebuddy-vapid:${seed}`);
  // Make sure the scalar is a valid P-256 private key.
  while (!p256.utils.isValidSecretKey(d)) d = await sha256(b64u(d));
  cached = { privateKey: b64u(d), publicKey: b64u(p256.getPublicKey(d, false)) };
  return cached;
}

export type Sub = { endpoint: string; p256dh: string; auth: string };

/** Returns "sent", "gone" (subscription expired) or "failed". */
export async function sendPush(sub: Sub, data: Record<string, unknown>): Promise<"sent" | "gone" | "failed"> {
  const keys = await vapidKeys();
  try {
    const payload = await buildPushPayload(
      { data: data as never, options: { ttl: 3600, urgency: "high" } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      { subject: "mailto:reminders@carebuddy.app", publicKey: keys.publicKey, privateKey: keys.privateKey },
    );
    const res = await fetch(sub.endpoint, payload);
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) {
      console.error("push failed", res.status, await res.text().catch(() => ""));
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("push error", e);
    return "failed";
  }
}

// ---- Signed action tokens (used by notification buttons, which have no sign-in) ----
export type ActionClaims = { k: "dose" | "test"; id: string; u: string; exp: number };

async function hmac(msg: string) {
  const secret = process.env["REMINDER_ACTION_SECRET"];
  if (!secret) throw new Error("Reminders are not set up yet");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

export async function signAction(c: Omit<ActionClaims, "exp">, ttlSec = 24 * 3600) {
  const body = b64u(enc.encode(JSON.stringify({ ...c, exp: Math.floor(Date.now() / 1000) + ttlSec })));
  return `${body}.${b64u(await hmac(body))}`;
}

export async function verifyAction(token: string): Promise<ActionClaims | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.length > 2000) return null;
  const expected = b64u(await hmac(body));
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const c = JSON.parse(new TextDecoder().decode(fromB64u(body))) as ActionClaims;
    if (c.exp < Date.now() / 1000) return null;
    return c;
  } catch {
    return null;
  }
}

/** Exact lock-screen wording. Never includes medicine names. */
export const REMINDER_TITLE = "Time for your medicine";
// Fixed lock-screen titles by type. Never include medicine names or health data.
export const PUSH_TITLES = { dose: REMINDER_TITLE, test: REMINDER_TITLE, refill: "Time to check your medicine supply", appointment: "You have an appointment" } as const;
