/** Right-to-left languages we may translate into. */
const RTL = new Set(["Arabic", "Hebrew", "Persian", "Urdu"]);

export function isRTL(lang?: string | null): boolean {
  return !!lang && RTL.has(lang);
}

export function dirFor(lang?: string | null): "rtl" | "ltr" {
  return isRTL(lang) ? "rtl" : "ltr";
}

const LANG_CODE: Record<string, string> = {
  Spanish: "ES",
  French: "FR",
  German: "DE",
  Italian: "IT",
  Portuguese: "PT",
  Hindi: "HI",
  Japanese: "JA",
  Korean: "KO",
  "Simplified Chinese": "ZH",
  Arabic: "AR",
  Russian: "RU",
  English: "EN",
};

/** Short badge code, e.g. "Spanish" → "ES". */
export function langCode(name: string): string {
  return LANG_CODE[name] ?? name.slice(0, 2).toUpperCase();
}
