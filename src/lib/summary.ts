// Pure doctor-summary builder (no AI). Lists and counts only: no interpretation, scoring or advice.
// Used for the PDF, the in-app preview and the shared link, so all three show the same thing.
import { z } from "zod";
import { istDate, istDayStartUTC, formatTimeIST } from "./time";

export const SUMMARY_FOOTER = "Not a medical record. Prepared by the patient using CareBuddy. CareBuddy is not a doctor.";
export const SRC_YOU = "entered by you";
export const SRC_CALC = "calculated";
export const NOT_AVAILABLE = "This link is not available.";
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
export const EXPIRY_CHOICES = [1, 7, 30] as const;
export const DEFAULT_EXPIRY_DAYS = 7;

export const SECTIONS = [
  { key: "doses", label: "Dose log" },
  { key: "timeline", label: "Unwell checks and diary" },
  { key: "meals", label: "Meals" },
  { key: "numbers", label: "My numbers" },
  { key: "water_sleep", label: "Water and sleep" },
  { key: "appointments", label: "Appointments" },
  { key: "questions", label: "Questions for my doctor" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];
export const ALL_SECTIONS = SECTIONS.map((s) => s.key) as SectionKey[];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const summaryRequestSchema = z.object({
  from: isoDate,
  to: isoDate,
  sections: z.array(z.enum(ALL_SECTIONS as [SectionKey, ...SectionKey[]])).max(SECTIONS.length),
  questions: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
}).refine((r) => r.from <= r.to, { message: "The start date must be before the end date." })
  .refine((r) => daysBetween(r.from, r.to) < MAX_RANGE_DAYS, { message: "Choose a range of up to one year." });
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

export const shareRequestSchema = z.object({
  request: summaryRequestSchema,
  expiryDays: z.union([z.literal(1), z.literal(7), z.literal(30)]),
});

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3);
}
export function defaultRange(now: Date = new Date()) {
  const to = istDate(now);
  const from = istDate(new Date(now.getTime() - (DEFAULT_RANGE_DAYS - 1) * 86400e3));
  return { from, to };
}
/** UTC bounds [start, end) for an India-time date range. */
export function rangeBounds(from: string, to: string) {
  const start = istDayStartUTC(from);
  const end = new Date(istDayStartUTC(to).getTime() + 86400e3);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ---- Raw input (rows straight from the database) ----
export type SummaryRaw = {
  profile: { full_name: string | null; age_group: string | null; allergies: string | null } | null;
  planVersions: { version_no: number; created_at: string }[];
  medicines: { id: string; name: string; strength: string | null; dose_amount: string | null; archived_at: string | null }[];
  doses: { medicine_id: string; scheduled_at: string; status: string }[];
  unwell: { created_at: string; result: string; reasons: string[] }[];
  diary: { occurred_at: string; symptoms: string[]; severity: number | null; result: string | null; notes: string | null; source: string; deleted_at: string | null }[];
  meals: { eaten_at: string; meal_type: string; description: string; deleted_at: string | null }[];
  vitals: { kind: string; measured_at: string; value: number; value2: number | null; unit: string }[];
  water: { logged_at: string }[];
  goals: { day: string; goal_glasses: number | null }[];
  sleep: { night: string; hours: number }[];
  appointments: { starts_at: string; doctor: string; location: string | null; purpose: string | null; questions: string[] }[];
};

const RESULT_LABEL: Record<string, string> = {
  emergency: "Emergency signs", doctor_soon: "See a doctor soon", self_care: "Self-care", none: "No check",
};
const STATUS_LABEL: Record<string, string> = { taken: "Taken", late: "Taken late", skipped: "Skipped", pending: "Not marked" };
const VITAL_LABEL: Record<string, string> = {
  weight: "Weight", blood_pressure: "Blood pressure", sugar_fasting: "Blood sugar (fasting)",
  sugar_after_meal: "Blood sugar (after meal)", temperature: "Temperature",
};
/** One unit per kind so tables and charts are comparable. */
const VITAL_UNIT: Record<string, string> = { weight: "kg", blood_pressure: "mmHg", sugar_fasting: "mg/dL", sugar_after_meal: "mg/dL", temperature: "°F" };

// Kept verbatim so sample data stays visibly labelled "(sample)".
const clean = (s: string) => s.trim();
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtTime = (iso: string) => formatTimeIST(iso);

export type MedicineRow = { name: string; detail: string; due: number; taken: number; late: number; skipped: number; notMarked: number; adherencePct: number | null };
export type SummaryDoc = ReturnType<typeof buildSummary>;

export function buildSummary(raw: SummaryRaw, req: SummaryRequest, now: Date = new Date()) {
  const { start, end } = rangeBounds(req.from, req.to);
  const inRange = (iso: string) => iso >= start && iso < end;
  const inDays = (d: string) => d >= req.from && d <= req.to;
  const nowIso = now.toISOString();
  const has = (k: SectionKey) => req.sections.includes(k);

  // Doses due so far in the range (future doses are not counted).
  const doses = raw.doses.filter((d) => inRange(new Date(d.scheduled_at).toISOString()) && new Date(d.scheduled_at).toISOString() <= nowIso)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const medName = new Map(raw.medicines.map((m) => [m.id, m]));

  const medicines: MedicineRow[] = raw.medicines.filter((m) => !m.archived_at).map((m) => {
    const list = doses.filter((d) => d.medicine_id === m.id);
    const c = (s: string) => list.filter((d) => d.status === s).length;
    const taken = c("taken"), late = c("late");
    return {
      name: clean(m.name), detail: [m.strength, m.dose_amount].filter(Boolean).join(", "),
      due: list.length, taken, late, skipped: c("skipped"), notMarked: c("pending"),
      adherencePct: list.length ? Math.round(((taken + late) / list.length) * 100) : null,
    };
  });
  const counts = {
    notMarked: doses.filter((d) => d.status === "pending").length,
    skipped: doses.filter((d) => d.status === "skipped").length,
    late: doses.filter((d) => d.status === "late").length,
  };

  const diary = raw.diary.filter((e) => !e.deleted_at && inRange(new Date(e.occurred_at).toISOString()));
  const symptomCount = new Map<string, number>();
  for (const e of diary) for (const s of e.symptoms) { const k = clean(s); if (k) symptomCount.set(k, (symptomCount.get(k) ?? 0) + 1); }
  const topSymptoms = [...symptomCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Plan version in force at the end of the range (the latest one created by then), else none.
  const endIso = end;
  const plan = [...raw.planVersions].filter((v) => v.created_at < endIso).sort((a, b) => b.version_no - a.version_no)[0] ?? null;

  const glance = {
    name: raw.profile?.full_name ? clean(raw.profile.full_name) : null,
    ageGroup: raw.profile?.age_group ?? null,
    allergies: raw.profile?.allergies?.trim() || null,
    plan: plan ? { version: plan.version_no, date: istDate(new Date(plan.created_at)) } : null,
    medicines, counts, topSymptoms,
  };

  const doseRows = has("doses") ? doses.map((d) => {
    const at = new Date(d.scheduled_at);
    return { date: istDate(at), time: fmtTime(d.scheduled_at), medicine: clean(medName.get(d.medicine_id)?.name ?? "Removed medicine"), status: STATUS_LABEL[d.status] ?? d.status };
  }) : null;

  const timeline = has("timeline") ? [
    ...raw.unwell.filter((u) => inRange(new Date(u.created_at).toISOString())).map((u) => ({
      at: u.created_at, kind: "Unwell check", text: u.reasons.map(clean).join("; ") || "-", result: RESULT_LABEL[u.result] ?? u.result, severity: null as number | null,
    })),
    ...diary.filter((e) => e.source !== "check").map((e) => ({
      at: e.occurred_at, kind: "Diary", text: [e.symptoms.map(clean).join(", "), e.notes?.trim()].filter(Boolean).join(" - ") || "-",
      result: e.result ? RESULT_LABEL[e.result] ?? e.result : "-", severity: e.severity,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map((r) => ({ date: istDate(new Date(r.at)), time: fmtTime(r.at), kind: r.kind, text: r.text, result: r.result, severity: r.severity })) : null;

  let meals: { byType: { type: string; count: number }[]; total: number; rows: { date: string; time: string; type: string; description: string }[] } | null = null;
  if (has("meals")) {
    const list = raw.meals.filter((m) => !m.deleted_at && inRange(new Date(m.eaten_at).toISOString())).sort((a, b) => a.eaten_at.localeCompare(b.eaten_at));
    const by = new Map<string, number>();
    for (const m of list) by.set(m.meal_type, (by.get(m.meal_type) ?? 0) + 1);
    meals = {
      total: list.length,
      byType: [...by.entries()].map(([type, count]) => ({ type: cap(type), count })),
      rows: list.map((m) => ({ date: istDate(new Date(m.eaten_at)), time: fmtTime(m.eaten_at), type: cap(m.meal_type), description: clean(m.description) })),
    };
  }

  const numbers = has("numbers") ? Object.keys(VITAL_LABEL).map((kind) => {
    const rows = raw.vitals.filter((v) => v.kind === kind && inRange(new Date(v.measured_at).toISOString()))
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      .map((v) => {
        const conv = toStandardUnit(kind, v.value, v.unit);
        return {
          date: istDate(new Date(v.measured_at)), time: fmtTime(v.measured_at),
          value: conv.value, value2: v.value2,
          display: kind === "blood_pressure" && v.value2 != null ? `${v.value}/${v.value2}` : String(conv.value),
          source: conv.converted ? `${SRC_YOU}, converted from ${v.unit} (${SRC_CALC})` : SRC_YOU,
        };
      });
    return { kind, label: VITAL_LABEL[kind]!, unit: VITAL_UNIT[kind]!, rows };
  }).filter((g) => g.rows.length) : null;

  let waterSleep: { days: { date: string; glasses: number; goal: number | null; sleep: number | null }[]; avgWater: number | null; avgSleep: number | null } | null = null;
  if (has("water_sleep")) {
    const glasses = new Map<string, number>();
    for (const w of raw.water) { if (!inRange(new Date(w.logged_at).toISOString())) continue; const d = istDate(new Date(w.logged_at)); glasses.set(d, (glasses.get(d) ?? 0) + 1); }
    const goalsSorted = [...raw.goals].filter((g) => g.goal_glasses != null).sort((a, b) => a.day.localeCompare(b.day));
    const goalOn = (d: string) => { let g: number | null = null; for (const x of goalsSorted) if (x.day <= d) g = x.goal_glasses; return g; };
    const sleep = new Map(raw.sleep.filter((s) => inDays(s.night)).map((s) => [s.night, Number(s.hours)]));
    const daySet = [...new Set([...glasses.keys(), ...sleep.keys()])].sort();
    const days = daySet.map((date) => ({ date, glasses: glasses.get(date) ?? 0, goal: goalOn(date), sleep: sleep.get(date) ?? null }));
    const wd = days.filter((d) => d.glasses > 0);
    const sd = days.filter((d) => d.sleep != null);
    waterSleep = {
      days,
      avgWater: wd.length ? round1(wd.reduce((s, d) => s + d.glasses, 0) / wd.length) : null,
      avgSleep: sd.length ? round1(sd.reduce((s, d) => s + (d.sleep ?? 0), 0) / sd.length) : null,
    };
  }

  const appointments = has("appointments") ? raw.appointments.filter((a) => inRange(new Date(a.starts_at).toISOString()))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((a) => ({ date: istDate(new Date(a.starts_at)), time: fmtTime(a.starts_at), doctor: clean(a.doctor), purpose: a.purpose ?? "-", location: a.location ?? "-" })) : null;

  return {
    generatedAt: nowIso,
    generatedAtLabel: `${istDate(now)} ${fmtTime(nowIso)} (India time)`,
    range: { from: req.from, to: req.to },
    sections: req.sections,
    glance,
    doses: doseRows,
    timeline,
    meals,
    numbers,
    waterSleep,
    appointments,
    questions: has("questions") ? req.questions : null,
  };
}

/** Questions from the next upcoming appointment, used to prefill the editable list. */
export function prefillQuestions(appts: { starts_at: string; questions: string[] }[], now: Date = new Date()) {
  const next = appts.filter((a) => a.starts_at >= now.toISOString()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  return next ? next.questions.map(clean).filter(Boolean) : [];
}

export function toStandardUnit(kind: string, value: number, unit: string) {
  if (kind === "temperature" && unit === "°C") return { value: round1(value * 9 / 5 + 32), converted: true };
  return { value: Number(value), converted: false };
}

function cap(s: string) { return s ? s[0]!.toUpperCase() + s.slice(1) : s; }
