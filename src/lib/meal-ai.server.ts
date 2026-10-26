import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

// Lightest suitable model: a short nutrient note needs no large model.
const MODEL = "openai/gpt-6-luna";
const INSTRUCTIONS =
  "You describe the main nutrients in a meal in simple, friendly words for an older adult. " +
  "Reply with at most 3 short lines. Mention only food nutrients (for example carbohydrates, protein, fibre, fat, vitamins). " +
  "Never mention medicines, supplements, doses, diseases, conditions, or health claims. Never say cure, treat, prevent or heal. No advice.";

// Sends ONLY the meal text. Returns raw text or null on any failure.
export async function askMealNote(mealText: string): Promise<string | null> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) { console.error("LOVABLE_API_KEY missing"); return null; }
  try {
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses(MODEL),
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: `Meal: ${mealText}` }],
      maxRetries: 0,
      maxOutputTokens: 600,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
    });
    return await result.text;
  } catch (e) {
    console.error("Meal note AI call failed", e);
    return null;
  }
}

// Meal ideas: receives ONLY the Doctor's Plan diet rules, foods to avoid and the allergy list.
const IDEAS_MODEL = "openai/gpt-6-astra";
const IDEAS_INSTRUCTIONS =
  "Suggest exactly 3 simple, home-style Indian meal ideas, one per line, each under 25 words, no numbering. " +
  "Follow the diet rules given. Never include any food that is listed to avoid or as an allergy. " +
  "Describe only the food. Never mention medicines, supplements, doses, diseases, conditions or health claims. " +
  "Never say cure, treat, prevent or heal. No advice.";

export async function askMealIdeas(input: { dietRules: string; avoid: string; allergies: string }): Promise<string | null> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) { console.error("LOVABLE_API_KEY missing"); return null; }
  try {
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses(IDEAS_MODEL),
      system: IDEAS_INSTRUCTIONS,
      messages: [{ role: "user", content: `Diet rules: ${input.dietRules}\nFoods to avoid: ${input.avoid || "none"}\nAllergies: ${input.allergies || "none"}` }],
      maxRetries: 0,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
    });
    return await result.text;
  } catch (e) {
    console.error("Meal ideas AI call failed", e);
    return null;
  }
}
