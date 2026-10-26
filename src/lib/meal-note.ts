// Server-side safety check for the AI meal note. Pure, so it is unit-tested.
export const MEAL_NOTE_UNAVAILABLE = "Note unavailable";
export const AI_DAILY_CAP = 20;

const BANNED_WORDS = /\b(cur(e|es|ed|ing|ative)|treat(s|ed|ing|ment|ments)?|prevent(s|ed|ing|ion|ive)?|heal(s|ed|ing)?|remed(y|ies)|therap(y|ies|eutic)|prescri\w*|medicin\w*|medicat\w*|drugs?|pills?|tablets?|capsules?|supplements?|dos(e|es|age|ing))\b/i;
// Amounts that look like medicine doses.
const DOSE_PATTERN = /\b\d+(\.\d+)?\s*(mg|mcg|µg|ml|iu|units?)\b/i;
const DISEASES = /\b(diabet\w*|cancer\w*|tumou?r\w*|hypertension|blood pressure|cholesterol|heart (disease|attack|failure)|stroke|kidney (disease|failure)|anaemi\w*|anemi\w*|arthritis|asthma|thyroid\w*|obesity|infection\w*|covid\w*|flu|fever|ulcers?|gout|alzheimer\w*|dementia|depression|anxiety|insomnia|immun\w*|disease\w*|disorder\w*|syndrome\w*|illness\w*|deficien\w*|inflammat\w*|detox\w*)\b/i;
const COMMON_MEDICINES = ["paracetamol", "acetaminophen", "ibuprofen", "aspirin", "metformin", "insulin", "amlodipine", "atorvastatin", "omeprazole", "pantoprazole", "levothyroxine", "losartan", "telmisartan", "dolo", "crocin", "combiflam", "azithromycin", "amoxicillin", "cetirizine", "antibiotic", "statin", "antacid", "vitamin d3", "ors"];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** True if the text names a medicine, a dose, a disease, or claims to cure/treat/prevent. */
export function hasUnsafeContent(text: string, extraNames: string[] = []) {
  if (BANNED_WORDS.test(text) || DOSE_PATTERN.test(text) || DISEASES.test(text)) return true;
  const lower = text.toLowerCase();
  const names = [...COMMON_MEDICINES, ...extraNames.map((n) => n.toLowerCase().replace(/\(sample\)/g, "").trim())].filter((n) => n.length >= 3);
  return names.some((n) => new RegExp(`\\b${esc(n)}\\b`, "i").test(lower));
}

export function checkMealNote(raw: string | null | undefined, extraNames: string[] = []): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 3 || text.length > 400) return null;
  if (hasUnsafeContent(text, extraNames)) return null;
  return lines.join("\n");
}

// ---- Meal ideas (same reply check, plus allergies and foods to avoid) ----
export const MEAL_IDEAS_CAP = 10;
export const IDEAS_UNAVAILABLE = "Ideas unavailable";
export const DIET_FIRST = "Follow your doctor's diet plan first.";
export const GENERAL_TIPS = [
  "Fill half your plate with vegetables or salad.",
  "Choose whole grains such as brown rice, millets or whole-wheat roti.",
  "Drink water through the day and keep fried and very sweet foods occasional.",
];

/** Words from allergies / foods to avoid, split on commas, semicolons and new lines. */
export function avoidTerms(...lists: (string | null | undefined)[]) {
  return lists.flatMap((l) => (l ?? "").split(/[,;\n]|\band\b/i)).map((t) => t.trim().toLowerCase().replace(/^no\s+/, ""))
    .filter((t) => t.length >= 3 && !/^(none|nil|nothing|n\/a)$/.test(t));
}

/** Exactly 1-3 short idea lines; discards the whole reply if anything is unsafe or mentions something to avoid. */
export function checkMealIdeas(raw: string | null | undefined, extraNames: string[] = [], avoid: string[] = []): string[] | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean);
  if (!lines.length || lines.length > 3 || text.length > 700 || lines.some((l) => l.length > 220)) return null;
  if (hasUnsafeContent(text, extraNames)) return null;
  const lower = text.toLowerCase();
  if (avoid.some((t) => new RegExp(`\\b${esc(t)}`, "i").test(lower))) return null;
  return lines;
}
