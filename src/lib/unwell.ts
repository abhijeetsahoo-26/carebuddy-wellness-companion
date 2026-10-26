import { z } from "zod";

// Fixed, deterministic triage. No AI. Emergency always wins.
export const SYMPTOMS = [
  { value: "fever", label: "Fever or chills" },
  { value: "cough", label: "Cough" },
  { value: "cold", label: "Runny or blocked nose" },
  { value: "sore_throat", label: "Sore throat" },
  { value: "headache", label: "Headache" },
  { value: "body_ache", label: "Body ache" },
  { value: "tiredness", label: "Tiredness" },
  { value: "dizziness", label: "Dizziness" },
  { value: "stomach_pain", label: "Stomach pain" },
  { value: "nausea", label: "Feeling sick (nausea)" },
  { value: "rash", label: "Rash or itching" },
  { value: "severe_bleeding", label: "Severe bleeding", red: true },
  { value: "severe_dehydration", label: "Very dry mouth, no urine, or fainting from lack of water", red: true },
] as const;

export const DURATIONS = [
  { value: "under_1", label: "Less than 1 day" },
  { value: "1_3", label: "1 to 3 days" },
  { value: "over_3", label: "More than 3 days" },
] as const;

export const GI_FREQUENCY = [
  { value: "none", label: "No" },
  { value: "1_2", label: "Yes, 1 to 2 times today" },
  { value: "3_5", label: "Yes, 3 to 5 times today" },
  { value: "6_plus", label: "Yes, 6 or more times today" },
] as const;

/** 102 °F (38.9 °C) or higher counts as a high fever. */
export const HIGH_FEVER_F = 102;

const yn = z.boolean();
export const unwellAnswersSchema = z.object({
  symptoms: z.array(z.enum(SYMPTOMS.map((s) => s.value) as [string, ...string[]])).max(20),
  other: z.string().trim().max(300).optional().default(""),
  duration: z.enum(["under_1", "1_3", "over_3"]),
  fever: yn,
  temperature_f: z.number().min(90).max(110).nullable().optional().default(null),
  breathing: yn,
  chest_pain: yn,
  gi: z.enum(["none", "1_2", "3_5", "6_plus"]),
  fluids_ok: yn,
  pain: z.number().int().min(0).max(10),
  confusion: yn,
  worsening: yn,
  allergic: yn,
  self_harm: yn,
});
export type UnwellAnswers = z.output<typeof unwellAnswersSchema>;
export type UnwellResult = "emergency" | "doctor_soon" | "self_care";

export function decide(a: UnwellAnswers): { result: UnwellResult; reasons: string[] } {
  const red: string[] = [];
  if (a.breathing) red.push("Trouble breathing");
  if (a.chest_pain) red.push("Chest pain or pressure");
  if (a.confusion) red.push("Confusion, fainting or seizure");
  if (a.worsening) red.push("Getting worse quickly");
  if (a.allergic) red.push("Allergic reaction signs");
  if (a.self_harm) red.push("Thoughts of harming yourself");
  if (a.symptoms.includes("severe_bleeding")) red.push("Severe bleeding");
  if (a.symptoms.includes("severe_dehydration")) red.push("Severe dehydration signs");
  if (red.length) return { result: "emergency", reasons: red };

  const soon: string[] = [];
  if (a.fever && a.temperature_f != null && a.temperature_f >= HIGH_FEVER_F) soon.push("High fever");
  if (a.fever && a.duration === "over_3") soon.push("Fever for more than 3 days");
  if (!a.fluids_ok) soon.push("Cannot keep fluids down");
  if (a.duration === "over_3") soon.push("Symptoms for more than 3 days");
  if (a.pain >= 7) soon.push("Pain 7 or more");
  if (a.gi === "3_5" || a.gi === "6_plus") soon.push("Repeated vomiting or diarrhoea");
  if (soon.length) return { result: "doctor_soon", reasons: soon };
  return { result: "self_care", reasons: [] };
}

export const RESULT_LABEL: Record<UnwellResult, string> = {
  emergency: "Emergency",
  doctor_soon: "See a doctor soon",
  self_care: "Self-care",
};

export function symptomLabel(v: string) {
  return SYMPTOMS.find((s) => s.value === v)?.label ?? v;
}
