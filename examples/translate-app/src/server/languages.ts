/** Target languages offered in the picker. `value` is the name fed to the model. */
export const LANGUAGES = [
  { label: "Spanish", value: "Spanish" },
  { label: "French", value: "French" },
  { label: "German", value: "German" },
  { label: "Italian", value: "Italian" },
  { label: "Portuguese", value: "Portuguese" },
  { label: "Hindi", value: "Hindi" },
  { label: "Japanese", value: "Japanese" },
  { label: "Korean", value: "Korean" },
  { label: "Chinese (Simplified)", value: "Simplified Chinese" },
  { label: "Arabic", value: "Arabic" },
  { label: "Russian", value: "Russian" },
  { label: "English", value: "English" },
] as const;

export const DEFAULT_LANGUAGE = "Spanish";
export const DEFAULT_LANG_A = "English";
export const DEFAULT_LANG_B = "Spanish";

export type Mode = "oneway" | "conversation";

/** Short codes used for the conversation direction badge (e.g. "ES → HI"). */
export const LANG_CODE: Record<string, string> = {
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

export function langCode(name: string): string {
  return LANG_CODE[name] ?? name.slice(0, 2).toUpperCase();
}

export function isValidLanguage(value: string): boolean {
  return LANGUAGES.some((l) => l.value === value);
}

export function isValidMode(value: string): value is Mode {
  return value === "oneway" || value === "conversation";
}
