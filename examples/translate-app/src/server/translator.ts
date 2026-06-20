import OpenAI from "openai";

let client: OpenAI | null = null;
let injected: OpenAI | null = null;

/** Override the OpenAI client (used by tests to avoid network calls). */
export function __setOpenAIForTests(c: OpenAI | null): void {
  injected = c;
}

function openai(): OpenAI {
  if (injected) return injected;
  // Lazy so the server still boots without the key (only translation fails).
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 2,
      timeout: 20_000,
    });
  }
  return client;
}

/** Longest utterance we'll send to the model (transcription segments are short). */
export const MAX_INPUT = 2000;

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "toolong" };

/** Validate/normalize input before spending an API call. Pure + testable. */
export function guardInput(text: string): GuardResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > MAX_INPUT) return { ok: false, reason: "toolong" };
  return { ok: true, text: t };
}

/**
 * Small cache so repeated phrases (and retries) skip the API entirely.
 * Keyed by `${targetLang}::${text}` — translations are deterministic in the
 * (language, text) pair, so sharing across users is correct and cheaper.
 */
const cache = new Map<string, string>();
const CACHE_MAX = 500;

function cacheGet(key: string): string | undefined {
  return cache.get(key);
}
function cacheSet(key: string, value: string): void {
  if (!value) return;
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}
/** Test helper. */
export function __clearCache(): void {
  cache.clear();
}

function systemPrompt(targetLang: string): string {
  return (
    `You are a translation engine. Translate the user's text into ${targetLang}. ` +
    `Output ONLY the translation — no quotes, no notes, no original text. ` +
    `If it's already in ${targetLang}, return it unchanged.`
  );
}

/**
 * One-way: translate a short segment into `targetLang`, streaming partial output
 * via `onDelta` (called with the full text so far). Returns the final
 * translation. Cached results are delivered once through `onDelta`.
 */
export async function translateStream(
  text: string,
  targetLang: string,
  onDelta: (partial: string) => void,
): Promise<string> {
  const g = guardInput(text);
  if (!g.ok) {
    if (g.reason === "toolong") {
      const msg = "(too long to translate)";
      onDelta(msg);
      return msg;
    }
    return "";
  }

  const key = `${targetLang}::${g.text}`;
  const cached = cacheGet(key);
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
      { role: "user", content: g.text },
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
  cacheSet(key, result);
  return result;
}

// --- Conversation mode ------------------------------------------------------

export interface PairResult {
  /** Which side of the pair the utterance was spoken in. */
  from: "A" | "B";
  /** The translation, in the OTHER language. */
  translation: string;
}

export function pairSystemPrompt(langA: string, langB: string): string {
  return (
    `You are a two-way interpreter between ${langA} (A) and ${langB} (B). ` +
    `Given one spoken utterance, decide whether it is in ${langA} or ${langB}, ` +
    `then translate it into the OTHER language. These two languages may share a ` +
    `script, so judge by vocabulary and grammar, not just characters. ` +
    `Return ONLY a JSON object: {"from":"A"|"B","translation":"<text in the other language>"}. ` +
    `"from" is the language the utterance was spoken in (A=${langA}, B=${langB}); ` +
    `the translation must be in the opposite language. No notes, no original text.`
  );
}

/** Robust parse + coerce of the model's JSON (mirrors meeting-app/analyzer.ts). Pure. */
export function coercePairResult(raw: string): PairResult | null {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const from = parsed.from === "B" ? "B" : parsed.from === "A" ? "A" : null;
  const translation =
    typeof parsed.translation === "string" ? parsed.translation.trim() : "";
  if (!from || !translation) return null;
  return { from, translation };
}

/**
 * Conversation: detect which language the utterance is in and translate it into
 * the other one. Returns null on empty/too-long input or an unparseable reply.
 */
export async function translatePair(
  text: string,
  langA: string,
  langB: string,
): Promise<PairResult | null> {
  const g = guardInput(text);
  if (!g.ok) return null;

  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: pairSystemPrompt(langA, langB) },
      { role: "user", content: g.text },
    ],
  });

  return coercePairResult(res.choices[0]?.message?.content ?? "{}");
}
