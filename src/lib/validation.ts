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
