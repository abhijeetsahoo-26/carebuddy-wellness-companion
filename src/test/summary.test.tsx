import { describe, it, expect } from "vitest";
import { buildSummary, defaultRange, prefillQuestions, summaryRequestSchema, shareRequestSchema, ALL_SECTIONS, SUMMARY_FOOTER, type SummaryRaw } from "@/lib/summary";
import { exportFiles, toCsv } from "@/lib/data-export";

const NOW = new Date("2026-10-20T06:30:00Z"); // 12:00 India time
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const empty: SummaryRaw = { profile: null, planVersions: [], medicines: [], doses: [], unwell: [], diary: [], meals: [], vitals: [], water: [], goals: [], sleep: [], appointments: [] };
const req = (over = {}) => summaryRequestSchema.parse({ from: "2026-10-01", to: "2026-10-20", sections: ALL_SECTIONS, questions: [], ...over });

describe("doctor summary", () => {
  it("defaults to the last 30 days, India time", () => expect(defaultRange(NOW)).toEqual({ from: "2026-09-21", to: "2026-10-20" }));
  it("footer text is exact", () => expect(SUMMARY_FOOTER).toBe("Not a medical record. Prepared by the patient using CareBuddy. CareBuddy is not a doctor."));

  it("counts adherence, Not marked, Skipped and Late from past doses in range only", () => {
    const raw: SummaryRaw = { ...empty,
      medicines: [{ id: "m", name: "Med A", strength: "500 mg", dose_amount: "1", archived_at: null }],
      doses: [
        { medicine_id: "m", scheduled_at: at("2026-10-10", "08:00"), status: "taken" },
        { medicine_id: "m", scheduled_at: at("2026-10-11", "08:00"), status: "late" },
        { medicine_id: "m", scheduled_at: at("2026-10-12", "08:00"), status: "skipped" },
        { medicine_id: "m", scheduled_at: at("2026-10-13", "08:00"), status: "pending" },
        { medicine_id: "m", scheduled_at: at("2026-10-20", "20:00"), status: "pending" }, // future: not counted
        { medicine_id: "m", scheduled_at: at("2026-09-30", "08:00"), status: "skipped" }, // before range
      ] };
    const s = buildSummary(raw, req(), NOW);
    expect(s.glance.medicines[0]).toMatchObject({ due: 4, taken: 1, late: 1, skipped: 1, notMarked: 1, adherencePct: 50 });
    expect(s.glance.counts).toEqual({ notMarked: 1, skipped: 1, late: 1 });
    expect(s.doses).toHaveLength(4);
  });

  it("only includes chosen sections", () => {
    const s = buildSummary(empty, req({ sections: ["meals"] }), NOW);
    expect(s.meals).not.toBeNull();
    expect(s.doses).toBeNull(); expect(s.timeline).toBeNull(); expect(s.numbers).toBeNull(); expect(s.questions).toBeNull();
  });

  it("uses the Doctor's Plan version in force at the end of the range", () => {
    const raw = { ...empty, planVersions: [{ version_no: 1, created_at: at("2026-09-01", "10:00") }, { version_no: 2, created_at: at("2026-10-05", "10:00") }, { version_no: 3, created_at: at("2026-10-25", "10:00") }] };
    expect(buildSummary(raw, req(), NOW).glance.plan).toEqual({ version: 2, date: "2026-10-05" });
  });

  it("shows temperatures in one unit (°F) and labels conversions", () => {
    const raw = { ...empty, vitals: [{ kind: "temperature", measured_at: at("2026-10-10", "09:00"), value: 38, value2: null, unit: "°C" }] };
    const row = buildSummary(raw, req(), NOW).numbers![0]!.rows[0]!;
    expect(row.value).toBe(100.4);
    expect(row.source).toContain("calculated");
  });

  it("most-logged symptoms count diary entries, ignoring deleted ones", () => {
    const d = (day: string, symptoms: string[], deleted = false) => ({ occurred_at: at(day, "10:00"), symptoms, severity: null, result: null, notes: null, source: "manual", deleted_at: deleted ? NOW.toISOString() : null });
    const raw = { ...empty, diary: [d("2026-10-02", ["Headache"]), d("2026-10-03", ["Headache", "Cough"]), d("2026-10-04", ["Cough"], true)] };
    expect(buildSummary(raw, req(), NOW).glance.topSymptoms).toEqual([{ name: "Headache", count: 2 }, { name: "Cough", count: 1 }]);
  });

  it("prefills questions from the next appointment only", () => {
    const appts = [
      { starts_at: at("2026-10-30", "10:00"), questions: ["Later"] },
      { starts_at: at("2026-10-22", "10:00"), questions: ["Next one"] },
      { starts_at: at("2026-10-01", "10:00"), questions: ["Past"] },
    ];
    expect(prefillQuestions(appts, NOW)).toEqual(["Next one"]);
  });

  it("rejects a start date after the end date", () => expect(summaryRequestSchema.safeParse({ from: "2026-10-20", to: "2026-10-01", sections: [] }).success).toBe(false));
  it("share link expiry is only 1, 7 or 30 days", () => {
    const r = { from: "2026-10-01", to: "2026-10-20", sections: [] };
    expect(shareRequestSchema.safeParse({ request: r, expiryDays: 7 }).success).toBe(true);
    expect(shareRequestSchema.safeParse({ request: r, expiryDays: 14 }).success).toBe(false);
  });
});

describe("data export", () => {
  it("escapes commas, quotes and new lines in CSV", () => expect(toCsv([{ a: 'x,"y"', b: "1\n2" }])).toBe('a,b\r\n"x,""y""","1\n2"\r\n'));
  it("makes one CSV per kind, the JSON and a readme", () => {
    const f = exportFiles(JSON.stringify({ exported_at: "x", user_id: "u", meals: [{ id: 1 }], profile: { full_name: "A" } }));
    expect(Object.keys(f).sort()).toEqual(["README.txt", "carebuddy-data.json", "meals.csv", "profile.csv"]);
    expect(f["README.txt"]).toContain("meals.csv");
  });
});
