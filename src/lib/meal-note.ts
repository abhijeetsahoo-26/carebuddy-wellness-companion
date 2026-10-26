// Server-side safety check for the AI meal note. Pure, so it is unit-tested.
export const MEAL_NOTE_UNAVAILABLE = "Note unavailable";
export const AI_DAILY_CAP = 20;

const BANNED_WORDS = /\b(cur(e|es|ed|ing|ative)|treat(s|ed|ing|ment|ments)?|prevent(s|ed|ing|ion|ive)?|heal(s|ed|ing)?|remed(y|ies)|therap(y|ies|eutic)|prescri\w*|medicin\w*|medicat\w*|drugs?|pills?|tablets?|capsules?|supplements?|dos(e|es|age|ing))\b/i;
// Amounts that look like medicine doses.
const DOSE_PATTERN = /\b\d+(\.\d+)?\s*(mg|mcg|µg|ml|iu|units?)\b/i;
const DISEASES = /\b(diabet\w*|cancer\w*|tumou?r\w*|hypertension|blood pressure|cholesterol|heart (disease|attack|failure)|stroke|kidney (disease|failure)|anaemi\w*|anemi\w*|arthritis|asthma|thyroid\w*|obesity|infection\w*|covid\w*|flu|fever|ulcers?|gout|alzheimer\w*|dementia|depression|anxiety|insomnia|immun\w*|disease\w*|disorder\w*|syndrome\w*|illness\w*|deficien\w*|inflammat\w*|detox\w*)\b/i;
const COMMON_MEDICINES = ["paracetamol", "acetaminophen", "ibuprofen", "aspirin", "metformin", "insulin", "amlodipine", "atorvastatin", "omeprazole", "pantoprazole", "levothyroxine", "losartan", "telmisartan", "dolo", "crocin", "combiflam", "azithromycin", "amoxicillin", "cetirizine", "antibiotic", "statin", "antacid", "vitamin d3", "ors"];

export function checkMealNote(raw: string | null | undefined, extraNames: string[] = []): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 3 || text.length > 400) return null;
  if (BANNED_WORDS.test(text) || DOSE_PATTERN.test(text) || DISEASES.test(text)) return null;
  const lower = text.toLowerCase();
  const names = [...COMMON_MEDICINES, ...extraNames.map((n) => n.toLowerCase().replace(/\(sample\)/g, "").trim())].filter((n) => n.length >= 3);
  if (names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower))) return null;
  return lines.join("\n");
}
