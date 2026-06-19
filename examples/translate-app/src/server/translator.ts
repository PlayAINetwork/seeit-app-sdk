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
 * Small LRU-ish cache so repeated phrases (and retries) skip the API entirely.
 * Keyed by `${targetLang}::${text}`.
 */
const cache = new Map<string, string>();
const CACHE_MAX = 500;

function systemPrompt(targetLang: string): string {
  return (
    `You are a translation engine. Translate the user's text into ${targetLang}. ` +
    `Output ONLY the translation — no quotes, no notes, no original text. ` +
    `If it's already in ${targetLang}, return it unchanged.`
  );
}

/**
 * Translate a short transcript segment into `targetLang`, streaming partial
 * output via `onDelta` (called with the full text so far). Returns the final
 * translation. Source language is auto-detected by the model. Cached results are
 * delivered through `onDelta` once and returned immediately.
 */
export async function translateStream(
  text: string,
  targetLang: string,
  onDelta: (partial: string) => void,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const key = `${targetLang}::${trimmed}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    onDelta(cached);
    return cached;
  }

  const stream = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt(targetLang) },
      { role: "user", content: trimmed },
    ],
  });

  let acc = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      acc += delta;
      onDelta(acc);
    }
  }

  const result = acc.trim();
  if (result) {
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, result);
  }
  return result;
}
