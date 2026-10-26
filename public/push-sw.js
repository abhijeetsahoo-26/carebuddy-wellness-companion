// CareBuddy reminder worker: shows reminder notifications and handles their buttons.
// It does not cache pages (no offline mode).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function post(token, action) {
  return fetch("/api/public/push-action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, action }),
  }).catch(() => {});
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = "Time for your medicine";
  const opts = {
    tag: data.tag || "carebuddy",
    renotify: true,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data,
  };
  if (data.type === "dose") {
    opts.requireInteraction = true;
    opts.actions = [
      { action: "taken", title: "Taken" },
      { action: "skip", title: "Skip" },
      { action: "snooze10", title: "Snooze 10 min" },
      { action: "snooze30", title: "Snooze 30 min" },
    ];
  }
  const work = [self.registration.showNotification(title, opts)];
  if (data.type === "test" && data.token) work.push(post(data.token, "received"));
  event.waitUntil(Promise.all(work));
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  if (data.type === "dose" && data.token && event.action) {
    event.waitUntil(post(data.token, event.action));
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("/");
    }),
  );
});
