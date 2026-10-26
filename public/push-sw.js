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
  // Fixed titles only: no medicine names or health data on the lock screen.
  const TITLES = {
    refill: "Time to check your medicine supply", appointment: "You have an appointment",
    sick_water: "Time for some water", sick_checkin: "How are you feeling now?",
    caregiver_missed: "A dose may have been missed",
  };
  const title = TITLES[data.type] || "Time for your medicine";
  const opts = {
    tag: data.tag || "carebuddy",
    renotify: true,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data,
  };
  if (data.type === "caregiver_missed" && data.first_name) opts.body = String(data.first_name).slice(0, 40);
  if (data.type === "sick_checkin") {
    opts.requireInteraction = true;
    opts.actions = [
      { action: "better", title: "Better" },
      { action: "same", title: "Same" },
      { action: "worse", title: "Worse" },
    ];
  }
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
  if (data.type === "sick_checkin" && ["better", "same", "worse"].includes(event.action)) {
    event.waitUntil(self.clients.openWindow("/sick-day?answer=" + event.action));
    return;
  }
  const PATHS = { appointment: "/appointments", refill: "/medicines", sick_water: "/sick-day", sick_checkin: "/sick-day", caregiver_missed: "/caregiving" };
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(PATHS[data.type] || "/");
    }),
  );
});
