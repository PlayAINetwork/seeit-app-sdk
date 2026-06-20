import { test, expect } from "bun:test";
import { routeDirection } from "./translateFlow.js";

test("routeDirection maps A→B and B→A with a direction badge", () => {
  expect(routeDirection("Spanish", "Hindi", "A")).toEqual({
    sourceLang: "Spanish",
    targetLang: "Hindi",
    direction: "ES → HI",
  });
  expect(routeDirection("Spanish", "Hindi", "B")).toEqual({
    sourceLang: "Hindi",
    targetLang: "Spanish",
    direction: "HI → ES",
  });
});
