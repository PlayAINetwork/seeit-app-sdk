import { test, expect } from "bun:test";
import { detectLanguage } from "./langdetect.js";

test("detects language from a long enough utterance", () => {
  expect(
    detectLanguage(
      "Buenos días a todos, vamos a comenzar la reunión ahora mismo por favor.",
    ),
  ).toBe("Spanish");
  expect(
    detectLanguage("The quick brown fox jumps over the lazy dog every morning."),
  ).toBe("English");
});

test("returns null for too-short or undetectable input", () => {
  expect(detectLanguage("hi")).toBeNull();
  expect(detectLanguage("")).toBeNull();
  expect(detectLanguage("   ")).toBeNull();
});
