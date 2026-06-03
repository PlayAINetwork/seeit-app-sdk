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

export function isValidLanguage(value: string): boolean {
  return LANGUAGES.some((l) => l.value === value);
}
