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
