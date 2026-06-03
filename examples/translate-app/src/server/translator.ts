import OpenAI from "openai";

let client: OpenAI | null = null;
function openai(): OpenAI {
  // Lazy so the server still boots without the key (only translation fails).
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Translate a short transcript segment into `targetLang`.
 * Source language is auto-detected by the model.
 */
export async function translate(text: string, targetLang: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          `You are a translation engine. Translate the user's text into ${targetLang}. ` +
          `Output ONLY the translation — no quotes, no notes, no original text. ` +
          `If it's already in ${targetLang}, return it unchanged.`,
      },
      { role: "user", content: trimmed },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? "";
}
