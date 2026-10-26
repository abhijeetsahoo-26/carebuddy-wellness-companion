// Sample data used by "Try with sample data" and scripts/seed-demo.sql.
// Every row is saved with is_demo = true and shown with a "Sample" label.
export const DEMO_EMERGENCY_CONTACTS = [
  { name: "Asha Sharma (sample)", phone: "+91 90000 00001", relationship: "Daughter" },
  { name: "Ravi Kumar (sample)", phone: "+91 90000 00002", relationship: "Neighbour" },
];

export const CONSENT_VERSION = "2026-10-v1";

// Clearly fake medicine names: CareBuddy never suggests real medicines.
export const DEMO_MEDICINES = [
  { name: "Sample Tablet A (sample)", strength: "1 unit", form: "Tablet", dose_amount: "1 tablet", times: ["08:00", "20:00"], food: "with" as const, prescribed_by: "Dr. Sample (sample)", notes: "Made-up example." },
  { name: "Sample Syrup B (sample)", strength: "—", form: "Syrup", dose_amount: "5 ml", times: ["13:00"], food: "any" as const, prescribed_by: "Dr. Sample (sample)", notes: "Made-up example." },
];

// Sample Doctor's Plan: made-up names, clearly labelled.
export const DEMO_PLAN = {
  medicines: [
    { name: "Sample Relief Tablet (sample)", dose: "1 tablet", interval_text: "Every 6 hours if needed", max_per_day: "3 tablets", doctor_name: "Dr. Sample (sample)", date_advised: "2026-10-01", confirmed: true, confirmed_on: "2026-10-02" },
  ],
  diet: {
    diet_rules: "Sample: eat small meals, drink water through the day.",
    foods_to_avoid: "Sample: very salty snacks.",
    special_instructions: "Sample: this whole plan is made up for trying the app.",
  },
  limits: [
    { metric: "temperature", min_value: null, max_value: 100.4, set_by: "Dr. Sample (sample)", set_on: "2026-10-01" },
  ],
  attachment_path: null, attachment_name: null, attachment_type: null,
};

export const DEMO_MEALS = [
  { meal_type: "breakfast", description: "Idli with sambar (sample)", minutes: 8 * 60 + 30, daysAgo: 0, ai_note: "Idli gives you carbohydrates for energy.\nSambar adds protein and fibre from lentils and vegetables." },
  { meal_type: "lunch", description: "Rice, dal and cabbage sabzi (sample)", minutes: 13 * 60, daysAgo: 1, ai_note: "Rice gives carbohydrates.\nDal adds protein, and cabbage adds fibre and vitamin C." },
  { meal_type: "dinner", description: "Two chapatis with paneer curry (sample)", minutes: 20 * 60, daysAgo: 1, ai_note: "Chapatis give carbohydrates and some fibre.\nPaneer adds protein and calcium." },
] as const;
