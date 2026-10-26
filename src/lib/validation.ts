import { z } from "zod";

// Shared by the browser forms and the server functions, so both check the same rules.
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{3,20}$/, "Please enter a phone number using digits only");

const optPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || phoneSchema.safeParse(v).success, "Please enter a valid phone number");

export const AGE_GROUPS = [
  { value: "under_18", label: "Under 18" },
  { value: "18_39", label: "18 to 39" },
  { value: "40_59", label: "40 to 59" },
  { value: "60_74", label: "60 to 74" },
  { value: "75_plus", label: "75 or older" },
] as const;

export const DIETS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "non_vegetarian", label: "Non-vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
  { value: "other", label: "Other" },
] as const;

export const profileFieldsSchema = z
  .object({
    full_name: optText(100),
    age_group: z.enum(["under_18", "18_39", "40_59", "60_74", "75_plus"]).optional(),
    allergies: optText(1000),
    conditions: optText(1000),
    doctor_name: optText(100),
    doctor_phone: optPhone,
    pharmacist_name: optText(100),
    pharmacist_phone: optPhone,
    diet: z.enum(["vegetarian", "non_vegetarian", "eggetarian", "vegan", "jain", "other"]).optional(),
  })
  .partial();

export const saveProfileSchema = z.object({
  fields: profileFieldsSchema,
  step: z.number().int().min(0).max(20),
  done: z.boolean().optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name").max(100),
  phone: phoneSchema,
  relationship: optText(50),
});

export const idSchema = z.object({ id: z.string().uuid() });

export function firstIssue(r: { success: false; error: z.ZodError }) {
  return r.error.issues[0]?.message ?? "Please check what you entered";
}

// ---- Medicines and reminders ----
export const FOOD_OPTIONS = [
  { value: "with", label: "With food" },
  { value: "without", label: "Without food" },
  { value: "any", label: "Any time" },
] as const;
export const FORMS = ["Tablet", "Capsule", "Syrup", "Drops", "Inhaler", "Injection", "Cream", "Other"] as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please pick a time");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date");

export const medicineSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter the medicine name").max(100),
    generic_name: optText(100),
    strength: optText(50),
    form: optText(30),
    dose_amount: optText(50),
    times: z.array(hhmm).min(1, "Add at least one time").max(8, "Up to 8 times a day")
      .refine((t) => new Set(t).size === t.length, "Each time can only be added once"),
    food: z.enum(["with", "without", "any"]),
    start_date: isoDate,
    end_date: isoDate.optional().nullable().transform((v) => v || null),
    prescribed_by: optText(100),
    notes: optText(1000),
    tablets_remaining: z.union([z.number(), z.string()]).optional().nullable()
      .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
      .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10000), "Please enter how many are left, or leave it empty"),
    tablets_per_dose: z.union([z.number(), z.string()]).optional()
      .transform((v) => (v === "" || v === undefined ? 1 : Number(v)))
      .refine((v) => Number.isFinite(v) && v > 0 && v <= 100, "Please enter how many you take each time"),
    missed_dose_instruction: optText(500),
  })
  .refine((m) => !m.end_date || m.end_date >= m.start_date, { message: "End date must be on or after the start date", path: ["end_date"] });

export const saveMedicineSchema = z.object({ id: z.string().uuid().optional(), medicine: medicineSchema });
export const markDoseSchema = z.object({ id: z.string().uuid(), status: z.enum(["taken", "skipped", "late"]) });
export const snoozeSchema = z.object({ id: z.string().uuid(), minutes: z.union([z.literal(10), z.literal(30)]) });
export const reminderSettingsSchema = z
  .object({
    enabled: z.boolean(),
    quiet_start: hhmm.nullable(),
    quiet_end: hhmm.nullable(),
  })
  .refine((s) => (s.quiet_start === null) === (s.quiet_end === null), "Please set both quiet-hours times, or neither");
export const pushSubSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(4).max(100),
});

// ---- Doctor's Plan ----
const optDate = z.string().optional().nullable().transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Please pick a date");
const optNum = (min: number, max: number, msg: string) =>
  z.union([z.number(), z.string()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), msg);

export const planMedicineSchema = z.object({
  name: z.string().trim().min(1, "Please enter the medicine name").max(100),
  dose: optText(100),
  interval_text: optText(100),
  max_per_day: optText(100),
  doctor_name: optText(100),
  date_advised: optDate,
  confirmed: z.boolean().default(false),
  confirmed_on: optDate,
}).refine((m) => !m.confirmed || !!m.confirmed_on, { message: "Please add the date you confirmed with your doctor", path: ["confirmed_on"] });

export const LIMIT_METRICS = [
  { value: "heart_rate", label: "Heart rate", unit: "beats per minute", min: 20, max: 250 },
  { value: "temperature", label: "Temperature", unit: "°F", min: 90, max: 110 },
  { value: "oxygen", label: "Oxygen", unit: "%", min: 50, max: 100 },
] as const;

export const planLimitSchema = z.object({
  metric: z.enum(["heart_rate", "temperature", "oxygen"]),
  min_value: optNum(0, 250, "Please enter a sensible number"),
  max_value: optNum(0, 250, "Please enter a sensible number"),
  set_by: optText(100),
  set_on: optDate,
}).refine((l) => l.min_value === null || l.max_value === null || l.min_value <= l.max_value, { message: "Lowest must be below highest", path: ["max_value"] })
  .refine((l) => l.min_value !== null || l.max_value !== null, { message: "Enter at least a lowest or highest value", path: ["min_value"] })
  .refine((l) => !!l.set_by, { message: "Please say who set this limit", path: ["set_by"] });

export const planSchema = z.object({
  medicines: z.array(planMedicineSchema).max(30),
  diet: z.object({ diet_rules: optText(2000), foods_to_avoid: optText(2000), special_instructions: optText(2000) }),
  limits: z.array(planLimitSchema).max(3).refine((ls) => new Set(ls.map((l) => l.metric)).size === ls.length, "Each limit can only be added once"),
  attachment_path: z.string().max(300).nullable().optional().transform((v) => v || null),
  attachment_name: z.string().max(200).nullable().optional().transform((v) => v || null),
  attachment_type: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).nullable().optional().transform((v) => v || null),
});
export type PlanInput = z.input<typeof planSchema>;

export const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

// ---- Meals ----
export const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
] as const;
export const mealSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  description: z.string().trim().min(2, "Please describe what you ate").max(500, "Please keep this under 500 characters"),
  eaten_at: z.string().datetime({ offset: true, message: "Please pick a time" })
    .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60e3, "The time can't be in the future"),
});
export const saveMealSchema = z.object({ id: z.string().uuid().optional(), meal: mealSchema });

// ---- Symptom diary and emergency directory ----
export const diaryEntrySchema = z.object({
  occurred_at: z.string().datetime({ offset: true, message: "Please pick a time" })
    .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60e3, "The time can't be in the future"),
  symptoms: z.array(z.string().trim().min(1).max(100)).min(1, "Please add at least one symptom").max(20),
  severity: z.number().int().min(0).max(10).nullable(),
  notes: optText(1000),
});
export const diaryNotesSchema = z.object({ id: z.string().uuid(), notes: optText(1000) });
export const directoryNumberSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,50}$/),
  label: z.string().trim().min(1).max(60),
  number: z.string().trim().regex(/^[0-9+]{2,15}$/, "Please enter digits only"),
});

// ---- Appointments, vitals, water goal, sleep, emergency card ----
const pastOrNow = (msg = "The time can't be in the future") =>
  z.string().datetime({ offset: true, message: "Please pick a date and time" }).refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60e3, msg);

export const appointmentSchema = z.object({
  doctor: z.string().trim().min(1, "Please enter the doctor's name").max(100),
  starts_at: z.string().datetime({ offset: true, message: "Please pick a date and time" }),
  location: optText(200),
  purpose: optText(200),
  notes: optText(1000),
  questions: z.array(z.string().trim().min(1).max(300)).max(30),
});
export const saveAppointmentSchema = z.object({ id: z.string().uuid().optional(), appointment: appointmentSchema });

export const VITAL_KINDS = [
  { value: "weight", label: "Weight", units: ["kg"] },
  { value: "blood_pressure", label: "Blood pressure", units: ["mmHg"] },
  { value: "sugar_fasting", label: "Blood sugar (fasting)", units: ["mg/dL"] },
  { value: "sugar_after_meal", label: "Blood sugar (after meal)", units: ["mg/dL"] },
  { value: "temperature", label: "Temperature", units: ["°C", "°F"] },
] as const;
const RANGES: Record<string, [number, number]> = { kg: [1, 400], mmHg: [20, 300], "mg/dL": [10, 1000], "°C": [30, 45], "°F": [86, 113] };
export const vitalSchema = z.object({
  kind: z.enum(["weight", "blood_pressure", "sugar_fasting", "sugar_after_meal", "temperature"]),
  value: z.number({ message: "Please enter a number" }),
  value2: z.number().nullable(),
  unit: z.enum(["kg", "mmHg", "mg/dL", "°C", "°F"]),
  measured_at: pastOrNow(),
}).refine((v) => (VITAL_KINDS.find((k) => k.value === v.kind)!.units as readonly string[]).includes(v.unit), { message: "Please pick the unit", path: ["unit"] })
  .refine((v) => { const [lo, hi] = RANGES[v.unit]!; return v.value >= lo && v.value <= hi && (v.value2 === null || (v.value2 >= lo && v.value2 <= hi)); }, { message: "That number looks like a typing mistake. Please check it.", path: ["value"] })
  .refine((v) => v.kind !== "blood_pressure" || v.value2 !== null, { message: "Please enter both blood pressure numbers", path: ["value2"] });

export const waterGoalSchema = z.object({ goal_glasses: z.number().int().min(1, "At least 1 glass").max(30, "Up to 30 glasses").nullable() });
export const sleepSchema = z.object({
  night: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  hours: z.number({ message: "Please enter hours" }).min(0).max(24, "Up to 24 hours"),
});
export const CARD_FIELDS = [
  { key: "name", label: "Name" },
  { key: "allergies", label: "Allergies" },
  { key: "conditions", label: "Conditions" },
  { key: "medicines", label: "Current medicines" },
  { key: "doctor", label: "Doctor contact" },
  { key: "contacts", label: "Emergency contacts" },
] as const;
export const cardPrefsSchema = z.object({
  name: z.boolean(), allergies: z.boolean(), conditions: z.boolean(), medicines: z.boolean(), doctor: z.boolean(), contacts: z.boolean(),
});
