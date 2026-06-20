import { test, expect, afterEach } from "bun:test";
import { enqueueSpeak, __clearSpeakQueues } from "./speakQueue.js";

afterEach(() => __clearSpeakQueues());

test("serializes utterances: only the first speaks synchronously", () => {
  const spoken: string[] = [];
  const speak = (t: string) => spoken.push(t);
  enqueueSpeak("u1", "one", speak);
  enqueueSpeak("u1", "two", speak);
  enqueueSpeak("u1", "three", speak);
  // The rest sit behind the gap timer.
  expect(spoken).toEqual(["one"]);
});

test("ignores empty/whitespace text", () => {
  const spoken: string[] = [];
  enqueueSpeak("u2", "   ", (t) => spoken.push(t));
  expect(spoken.length).toBe(0);
});
