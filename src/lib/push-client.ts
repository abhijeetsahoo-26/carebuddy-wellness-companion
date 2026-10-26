// Browser-side helpers for reminders (notifications + Home Screen status).
export type PushEnableResult = "ok" | "unsupported" | "open-in-new-tab" | "denied" | "needs-install";

export function isIOS() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}
export function inIframe() {
  try { return window.top !== window.self; } catch { return true; }
}
export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function permission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function keyToBytes(b64: string) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Must be called from a button tap. */
export async function enablePush(
  publicKey: () => Promise<string>,
  save: (s: { endpoint: string; p256dh: string; auth: string }) => Promise<unknown>,
): Promise<PushEnableResult> {
  if (inIframe()) return "open-in-new-tab";
  if (!pushSupported()) return isIOS() && !isInstalled() ? "needs-install" : "unsupported";
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(await publicKey()) }));
  const j = sub.toJSON();
  await save({ endpoint: sub.endpoint, p256dh: j.keys?.["p256dh"] ?? "", auth: j.keys?.["auth"] ?? "" });
  return "ok";
}

export const ENABLE_MESSAGES: Record<Exclude<PushEnableResult, "ok">, string> = {
  "open-in-new-tab": "Reminders can't be turned on inside this preview. Open CareBuddy in its own browser tab or on your phone.",
  unsupported: "This browser can't show reminders. Please try Chrome on Android, or Safari on iPhone after adding CareBuddy to your Home Screen.",
  denied: "Notifications are blocked. Please allow them in your browser or phone settings, then try again.",
  "needs-install": "On iPhone, first tap Share → Add to Home Screen, open CareBuddy from your Home Screen, then turn on reminders.",
};
