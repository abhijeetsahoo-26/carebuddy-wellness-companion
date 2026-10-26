// Pure tracking logic (no AI). Unit-tested in src/test/tracking.test.tsx.
import { istDate, istMinutesOfDay } from "./time";

// ---- Refills ----
export const LOW_SUPPLY_DAYS = 5;
export const LOW_SUPPLY_TEXT = "Time to check your medicine supply";
export const OUT_OF_SUPPLY_TEXT = "Out of supply: contact your doctor or pharmacist.";
export const MISSED_DOSE_TEXT = "Check your prescription or ask your pharmacist what to do about a missed dose. Do not double up.";

/** Same rule as the database trigger: Taken/Late uses tablets, going back restores exactly what was used. */
export function applyDoseToStock(remaining: number | null, perDose: number, from: string, to: string, deducted = 0) {
  const was = from === "taken" || from === "late";
  const now = to === "taken" || to === "late";
  if (remaining === null) return { remaining, deducted: 0 };
  if (now && !was) { const d = Math.min(perDose, remaining); return { remaining: remaining - d, deducted: d }; }
  if (was && !now) return { remaining: remaining + deducted, deducted: 0 };
  return { remaining, deducted };
}

/** Whole days of supply left, or null when the count isn't tracked or there are no daily doses. */
export function daysOfSupply(remaining: number | null, perDose: number, dosesPerDay: number) {
  if (remaining === null || dosesPerDay <= 0 || perDose <= 0) return null;
  return Math.floor(remaining / (perDose * dosesPerDay));
}

export function supplyStatus(remaining: number | null, perDose: number, dosesPerDay: number): "untracked" | "ok" | "low" | "out" {
  if (remaining === null) return "untracked";
  if (remaining <= 0 || remaining < perDose) return "out";
  const d = daysOfSupply(remaining, perDose, dosesPerDay);
  return d !== null && d <= LOW_SUPPLY_DAYS ? "low" : "ok";
}

// ---- Streak ----
export type DoseLite = { scheduled_at: string; status: string };

/**
 * Consecutive India-time days, ending today (or yesterday if today isn't finished), where every
 * scheduled dose was marked Taken (or Taken late). Days with no doses are skipped, not counted.
 */
export function streak(doses: DoseLite[], now: Date = new Date()) {
  const byDay = new Map<string, DoseLite[]>();
  for (const d of doses) {
    const k = istDate(new Date(d.scheduled_at));
    byDay.set(k, [...(byDay.get(k) ?? []), d]);
  }
  const today = istDate(now);
  const days = [...byDay.keys()].filter((k) => k <= today).sort().reverse();
  let n = 0;
  for (const day of days) {
    const list = byDay.get(day)!;
    const allTaken = list.every((d) => d.status === "taken" || d.status === "late");
    if (day === today && !allTaken) {
      // Today still in progress: only a skipped dose, or a past unmarked one, breaks it.
      const broken = list.some((d) => d.status === "skipped");
      if (broken) return 0;
      continue;
    }
    if (!allTaken) break;
    n++;
  }
  return n;
}

export function streakMessage(n: number, justLogged: boolean) {
  if (n === 0) return "A new streak starts with your next dose.";
  if (justLogged) return n === 1 ? "Nice — 1 day with every dose marked taken." : `Nice — ${n} days in a row with every dose marked taken.`;
  return n === 1 ? "1 day with every dose marked taken." : `${n} days in a row with every dose marked taken.`;
}

// ---- Weekly insights ----
export type InsightInput = {
  now?: Date;
  doses: DoseLite[];
  waterDays: Record<string, number>; // day -> glasses
  sleep: { night: string; hours: number }[];
  symptoms: { occurred_at: string; symptoms: string[] }[];
};

export const TIME_SLOTS = [
  { key: "morning", label: "Morning (5am–12pm)", from: 300, to: 720 },
  { key: "afternoon", label: "Afternoon (12pm–5pm)", from: 720, to: 1020 },
  { key: "evening", label: "Evening (5pm–9pm)", from: 1020, to: 1260 },
  { key: "night", label: "Night (9pm–5am)", from: 1260, to: 300 },
] as const;

function slotOf(iso: string) {
  const m = istMinutesOfDay(new Date(iso));
  return TIME_SLOTS.find((s) => (s.from < s.to ? m >= s.from && m < s.to : m >= s.from || m < s.to))!.key;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export const MIN_DAYS = 7;

export function weeklyInsights(input: InsightInput) {
  const now = input.now ?? new Date();
  const days = Array.from({ length: 7 }, (_, i) => istDate(new Date(now.getTime() - (6 - i) * 86400e3)));
  const inWeek = (iso: string) => days.includes(istDate(new Date(iso)));

  // Days with any data at all, across the whole history given.
  const dataDays = new Set<string>([
    ...input.doses.filter((d) => d.status !== "pending").map((d) => istDate(new Date(d.scheduled_at))),
    ...Object.entries(input.waterDays).filter(([, n]) => n > 0).map(([d]) => d),
    ...input.sleep.map((s) => s.night),
    ...input.symptoms.map((s) => istDate(new Date(s.occurred_at))),
  ]);
  if (dataDays.size < MIN_DAYS) return { enough: false as const, dataDays: dataDays.size };

  const past = input.doses.filter((d) => inWeek(d.scheduled_at) && new Date(d.scheduled_at) <= now);
  const taken = past.filter((d) => d.status === "taken" || d.status === "late").length;
  const adherencePct = past.length ? Math.round((taken / past.length) * 100) : null;

  const notMarked = Object.fromEntries(TIME_SLOTS.map((s) => [s.key, 0])) as Record<string, number>;
  for (const d of past) if (d.status === "pending") notMarked[slotOf(d.scheduled_at)]!++;

  const avgWater = avg(days.map((d) => input.waterDays[d] ?? 0));
  const weekSleep = input.sleep.filter((s) => days.includes(s.night));
  const avgSleep = avg(weekSleep.map((s) => s.hours));

  const counts = new Map<string, Set<string>>();
  for (const e of input.symptoms.filter((s) => inWeek(s.occurred_at))) {
    const day = istDate(new Date(e.occurred_at));
    for (const s of e.symptoms) {
      const k = s.replace(/\s*\(sample\)/i, "").trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? new Set()).add(day));
    }
  }
  const topSymptoms = [...counts].map(([name, ds]) => ({ name, days: ds.size })).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)).slice(0, 3);

  // Pattern statements: plain counts from the data. No causes, no advice.
  const patterns: string[] = [];
  const shortNights = weekSleep.filter((s) => s.hours < 6);
  // A night's sleep is linked to the next day's symptoms (sleep is logged against the night it started).
  const nextDay = (night: string) => istDate(new Date(new Date(`${night}T12:00:00+05:30`).getTime() + 86400e3));
  for (const { name } of topSymptoms) {
    if (shortNights.length >= 2) {
      const hit = shortNights.filter((s) => counts.get(name)!.has(nextDay(s.night)) || counts.get(name)!.has(s.night)).length;
      if (hit >= 2) patterns.push(`${name} was logged on ${hit} of the ${shortNights.length} days you slept under 6 hours.`);
    }
  }
  const lowWaterDays = days.filter((d) => (input.waterDays[d] ?? 0) < 4);
  for (const { name } of topSymptoms) {
    if (lowWaterDays.length >= 2) {
      const hit = lowWaterDays.filter((d) => counts.get(name)!.has(d)).length;
      if (hit >= 2) patterns.push(`${name} was logged on ${hit} of the ${lowWaterDays.length} days with fewer than 4 glasses of water.`);
    }
  }
  const busiest = Object.entries(notMarked).sort((a, b) => b[1] - a[1])[0];
  if (busiest && busiest[1] >= 2) {
    const label = TIME_SLOTS.find((s) => s.key === busiest[0])!.label.split(" (")[0]!.toLowerCase();
    patterns.push(`Most doses left not marked this week were in the ${label}.`);
  }

  return { enough: true as const, days, adherencePct, notMarked, avgWater, avgSleep, topSymptoms, patterns: patterns.slice(0, 4) };
}

// ---- Appointment questions from the diary ----
export function questionsFromDiary(entries: { occurred_at: string; symptoms: string[] }[], now: Date = new Date()) {
  const since = now.getTime() - 14 * 86400e3;
  const by = new Map<string, Set<string>>();
  for (const e of entries) {
    if (new Date(e.occurred_at).getTime() < since) continue;
    const date = new Date(e.occurred_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
    for (const s of e.symptoms) {
      const k = s.replace(/\s*\(sample\)/i, "").trim();
      if (k) by.set(k, (by.get(k) ?? new Set()).add(date));
    }
  }
  return [...by].map(([name, ds]) => `${name}: ${[...ds].join(", ")}`);
}
