import { test, expect, beforeEach } from "bun:test";
import type OpenAI from "openai";
import {
  guardInput,
  translateStream,
  translatePair,
  coercePairResult,
  pairSystemPrompt,
  __setOpenAIForTests,
  __clearCache,
  MAX_INPUT,
} from "./translator.js";

function makeFake() {
  let calls = 0;
  const client = {
    chat: {
      completions: {
        create: async (params: { stream?: boolean }) => {
          calls++;
          if (params.stream) {
            async function* g() {
              yield { choices: [{ delta: { content: "ho" } }] };
              yield { choices: [{ delta: { content: "la" } }] };
            }
            return g();
          }
          return {
            choices: [
              { message: { content: JSON.stringify({ from: "A", translation: "hello" }) } },
            ],
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls: () => calls };
}

beforeEach(() => {
  __clearCache();
  __setOpenAIForTests(null);
});

test("guardInput handles empty, whitespace, too-long, and trims", () => {
  expect(guardInput("")).toEqual({ ok: false, reason: "empty" });
  expect(guardInput("   ")).toEqual({ ok: false, reason: "empty" });
  expect(guardInput("a".repeat(MAX_INPUT + 1))).toEqual({ ok: false, reason: "toolong" });
  expect(guardInput("  hi ")).toEqual({ ok: true, text: "hi" });
});

test("translateStream returns translation, caches it, and never calls API when too long", async () => {
  const f = makeFake();
  __setOpenAIForTests(f.client);

  const deltas: string[] = [];
  const r1 = await translateStream("hello", "Spanish", (d) => deltas.push(d));
  expect(r1).toBe("hola");
  expect(deltas[deltas.length - 1]).toBe("hola");
  expect(f.calls()).toBe(1);

  const r2 = await translateStream("hello", "Spanish", () => {});
  expect(r2).toBe("hola");
  expect(f.calls()).toBe(1); // cache hit — no second API call

  const long = await translateStream("a".repeat(MAX_INPUT + 1), "Spanish", () => {});
  expect(long).toBe("(too long to translate)");
  expect(f.calls()).toBe(1); // guarded — no API call
});

test("coercePairResult parses valid and rejects malformed", () => {
  expect(coercePairResult('{"from":"A","translation":"hola"}')).toEqual({ from: "A", translation: "hola" });
  expect(coercePairResult('{"from":"B","translation":"x"}')).toEqual({ from: "B", translation: "x" });
  expect(coercePairResult("not json")).toBeNull();
  expect(coercePairResult('{"from":"A"}')).toBeNull();
  expect(coercePairResult('{"translation":"x"}')).toBeNull();
  expect(coercePairResult('{"from":"C","translation":"x"}')).toBeNull();
});

test("pairSystemPrompt names both languages and the JSON contract", () => {
  const p = pairSystemPrompt("English", "Hindi");
  expect(p).toContain("English");
  expect(p).toContain("Hindi");
  expect(p).toContain('"from"');
});

test("translatePair parses the model JSON", async () => {
  const f = makeFake();
  __setOpenAIForTests(f.client);
  const r = await translatePair("hello", "English", "Spanish");
  expect(r).toEqual({ from: "A", translation: "hello" });
});
