import { test, expect, beforeEach } from "bun:test";
import type { ServerResponse } from "node:http";
import { store } from "./store.js";

function fakeRes() {
  const frames: string[] = [];
  const res = {
    write: (f: string) => {
      frames.push(f);
      return true;
    },
    end: () => {},
  } as unknown as ServerResponse;
  return { res, frames };
}

beforeEach(() => store.__reset());

test("groups segments into sessions", () => {
  store.startSession("u1", "s1", 1000);
  store.upsertSegment("u1", "s1", {
    segmentId: "a",
    original: "hi",
    translated: "hola",
    sourceLang: null,
    isFinal: true,
  });
  const list = store.listSessions("u1");
  expect(list.length).toBe(1);
  expect(list[0]?.sessionId).toBe("s1");
  expect(list[0]?.segmentCount).toBe(1);
  expect(store.getSession("u1", "s1")?.segments.length).toBe(1);
});

test("updateSettings applies the patch and broadcasts one settings frame", () => {
  const { res, frames } = fakeRes();
  store.addListener("u2", res);
  const s = store.updateSettings("u2", {
    mode: "conversation",
    langA: "Spanish",
    langB: "Hindi",
  });
  expect(s.mode).toBe("conversation");
  expect(s.langA).toBe("Spanish");
  const settingsFrames = frames.filter((f) => f.includes('"type":"settings"'));
  expect(settingsFrames.length).toBe(1);
  expect(settingsFrames[0]).toContain("conversation");
});

test("drops a listener whose write throws, keeping healthy ones", () => {
  const good = fakeRes();
  const bad = {
    write: () => {
      throw new Error("EPIPE");
    },
    end: () => {},
  } as unknown as ServerResponse;
  store.addListener("u3", good.res);
  store.addListener("u3", bad);

  store.updateSettings("u3", { speakBack: false }); // first broadcast removes bad
  good.frames.length = 0;
  store.updateSettings("u3", { speakBack: true }); // good still receives
  expect(good.frames.length).toBeGreaterThan(0);
});

test("caps segments per session, keeping the newest", () => {
  store.startSession("u4", "s4", 1);
  for (let i = 0; i < 600; i++) {
    store.upsertSegment("u4", "s4", {
      segmentId: `seg${i}`,
      original: `o${i}`,
      translated: null,
      sourceLang: null,
      isFinal: true,
    });
  }
  const segs = store.getSession("u4", "s4")!.segments;
  expect(segs.length).toBe(500);
  expect(segs[segs.length - 1]?.segmentId).toBe("seg599");
});
