import { franc } from "franc";

/** ISO 639-3 → display name, covering the languages we care about + common ones. */
const NAMES: Record<string, string> = {
  eng: "English",
  spa: "Spanish",
  fra: "French",
  deu: "German",
  ita: "Italian",
  por: "Portuguese",
  hin: "Hindi",
  jpn: "Japanese",
  kor: "Korean",
  cmn: "Chinese",
  zho: "Chinese",
  arb: "Arabic",
  ara: "Arabic",
  rus: "Russian",
  nld: "Dutch",
  pol: "Polish",
  tur: "Turkish",
  ukr: "Ukrainian",
  vie: "Vietnamese",
  ind: "Indonesian",
  tha: "Thai",
  swe: "Swedish",
  ell: "Greek",
  heb: "Hebrew",
  ron: "Romanian",
};

/**
 * Best-effort source-language detection (offline, no API cost). Short
 * utterances are unreliable, so we only attempt it on text with enough signal
 * and return `null` when we can't say.
 */
export function detectLanguage(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 12) return null;
  const code = franc(trimmed, { minLength: 12 });
  if (code === "und") return null;
  return NAMES[code] ?? null;
}
