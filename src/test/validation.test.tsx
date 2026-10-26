import { describe, expect, it } from "vitest";
import { emergencyContactSchema, profileFieldsSchema, saveProfileSchema } from "@/lib/validation";

describe("shared validation", () => {
  it("rejects an emergency contact without a name", () => {
    expect(emergencyContactSchema.safeParse({ name: " ", phone: "9876543210" }).success).toBe(false);
  });
  it("rejects letters in a phone number", () => {
    expect(emergencyContactSchema.safeParse({ name: "Asha", phone: "call me" }).success).toBe(false);
  });
  it("accepts an Indian phone number with +91", () => {
    expect(emergencyContactSchema.safeParse({ name: "Asha", phone: "+91 98765 43210" }).success).toBe(true);
  });
  it("lets every onboarding field be skipped", () => {
    expect(saveProfileSchema.safeParse({ fields: {}, step: 3 }).success).toBe(true);
  });
  it("rejects an unknown age group", () => {
    expect(profileFieldsSchema.safeParse({ age_group: "old" }).success).toBe(false);
  });
});
