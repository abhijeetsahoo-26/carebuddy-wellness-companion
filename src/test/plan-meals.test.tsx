import { describe, it, expect } from "vitest";
import { checkMealNote } from "@/lib/meal-note";
import { planSchema, mealSchema } from "@/lib/validation";

describe("meal note safety check", () => {
  it("keeps a simple nutrient note", () => expect(checkMealNote("Dal gives protein.\nRice gives carbohydrates.")).toBe("Dal gives protein.\nRice gives carbohydrates."));
  it("discards more than 3 lines", () => expect(checkMealNote("a\nb\nc\nd")).toBeNull());
  it("discards cure / treat / prevent", () => {
    expect(checkMealNote("Turmeric may cure colds.")).toBeNull();
    expect(checkMealNote("This helps treat tiredness.")).toBeNull();
    expect(checkMealNote("Fibre can prevent problems.")).toBeNull();
  });
  it("discards a dose", () => expect(checkMealNote("Has about 500 mg of calcium.")).toBeNull());
  it("discards a disease claim", () => expect(checkMealNote("Good for diabetes.")).toBeNull());
  it("discards a medicine name, including the user's own", () => {
    expect(checkMealNote("Take with paracetamol.")).toBeNull();
    expect(checkMealNote("Pairs well with Zentora.", ["Zentora"])).toBeNull();
  });
  it("treats empty reply as unavailable", () => expect(checkMealNote("")).toBeNull());
});

describe("doctor's plan rules", () => {
  const base = { medicines: [], diet: {}, limits: [] };
  it("confirmed medicine needs a date", () => {
    expect(planSchema.safeParse({ ...base, medicines: [{ name: "X", confirmed: true }] }).success).toBe(false);
    expect(planSchema.safeParse({ ...base, medicines: [{ name: "X", confirmed: true, confirmed_on: "2026-10-01" }] }).success).toBe(true);
  });
  it("a limit needs who set it", () => {
    expect(planSchema.safeParse({ ...base, limits: [{ metric: "oxygen", min_value: 92 }] }).success).toBe(false);
    expect(planSchema.safeParse({ ...base, limits: [{ metric: "oxygen", min_value: 92, set_by: "Dr A" }] }).success).toBe(true);
  });
});

describe("meal rules", () => {
  it("rejects a future time", () => expect(mealSchema.safeParse({ meal_type: "lunch", description: "Rice", eaten_at: new Date(Date.now() + 3600e3).toISOString() }).success).toBe(false));
});
