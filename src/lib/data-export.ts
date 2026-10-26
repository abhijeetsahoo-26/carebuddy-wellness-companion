// Turns the JSON export into one CSV per kind of data plus a readme. Pure (testable); zipping is done by the caller.
export const EXPORT_README_INTRO = `CareBuddy data export
=====================
This download contains everything CareBuddy stores about you.
- carebuddy-data.json: all your data in one file (best for moving to another app).
- One .csv file per kind of data (opens in Excel or Google Sheets).
Times are in UTC (ISO 8601). CareBuddy shows them in India time.
CareBuddy is not a doctor. This is not a medical record.

Files:
`;

const DESCRIPTIONS: Record<string, string> = {
  profile: "Your profile: name, age group, allergies, conditions, doctor, pharmacist, diet.",
  consents: "When you agreed to the privacy terms, and which version.",
  emergency_contacts: "People to call in an emergency.",
  activity: "History of changes to medicines, the Doctor's Plan and contacts.",
  medicines: "Medicines you entered from your doctor's prescription.",
  doses: "Each scheduled dose and whether you marked it Taken, Late or Skipped.",
  water: "Each glass of water you logged.",
  reminder_settings: "Your reminder settings.",
  reminders_sent: "Reminders that were sent to your device.",
  doctor_plan: "Each saved version of your Doctor's Plan (nested details are in a JSON column).",
  prescription_uploads: "Links (valid for 1 hour) to download prescription files you uploaded.",
  meals: "Meals you logged.",
  ai_note_usage: "How many meal notes were requested per day.",
  unwell_checks: "Answers and results of each 'I feel unwell' check.",
  symptom_diary: "Your symptom diary entries.",
  emergency_directory_edits: "Emergency numbers you changed for yourself.",
  appointments: "Your doctor appointments and questions.",
  vitals: "Weight, blood pressure, sugar and temperature readings you entered.",
  water_goals: "Your daily water goals.",
  sleep: "Hours of sleep you logged.",
  emergency_card: "Which items show on your emergency card, and its share links (dates only).",
  doctor_summaries: "When you prepared a doctor summary, the dates and sections chosen.",
  doctor_share_links: "Doctor share links: dates, sections, expiry, when opened and how many times.",
  doctor_share_link_views: "Each time a doctor share link was opened.",
  sick_day_sessions: "Each sick-day mode session and its check-in answers.",
  caregivers: "People you invited as caregivers and what they can see.",
  caregiver_views: "Each time a caregiver looked at your shared updates.",
  people_i_look_after: "People who shared their updates with you as a caregiver (first names only).",
};

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

/** Returns { filename: content } for every top-level kind of data, plus README.txt. */
export function exportFiles(json: string): Record<string, string> {
  const data = JSON.parse(json) as Record<string, unknown>;
  const files: Record<string, string> = { "carebuddy-data.json": json };
  let readme = EXPORT_README_INTRO;
  for (const [k, v] of Object.entries(data)) {
    if (k === "exported_at" || k === "user_id") continue;
    const rows = Array.isArray(v) ? v as Record<string, unknown>[] : v && typeof v === "object" ? [v as Record<string, unknown>] : [];
    files[`${k}.csv`] = rows.length ? toCsv(rows) : "\r\n";
    readme += `- ${k}.csv: ${DESCRIPTIONS[k] ?? "Your data."} (${rows.length} row${rows.length === 1 ? "" : "s"})\n`;
  }
  files["README.txt"] = readme;
  return files;
}
