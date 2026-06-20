import { test, expect } from "bun:test";
import { isValidLanguage, isValidMode, langCode } from "./languages.js";

test("isValidLanguage", () => {
  expect(isValidLanguage("Spanish")).toBe(true);
  expect(isValidLanguage("Simplified Chinese")).toBe(true);
  expect(isValidLanguage("Klingon")).toBe(false);
  expect(isValidLanguage("")).toBe(false);
});

test("isValidMode", () => {
  expect(isValidMode("oneway")).toBe(true);
  expect(isValidMode("conversation")).toBe(true);
  expect(isValidMode("bogus")).toBe(false);
});

test("langCode maps known names and falls back", () => {
  expect(langCode("Spanish")).toBe("ES");
  expect(langCode("Hindi")).toBe("HI");
  expect(langCode("Simplified Chinese")).toBe("ZH");
  expect(langCode("Unknown Language")).toBe("UN");
});
