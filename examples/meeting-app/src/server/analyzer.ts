import OpenAI from "openai";
import type { ActionItem, Insights, Participant } from "./types.js";

let client: OpenAI | null = null;
function openai(): OpenAI {
  // Lazy so the server still boots without the key (only analysis fails).
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const SYSTEM = `You are a meeting-notes assistant. You receive a raw, un-attributed transcript of a spoken conversation captured from one person's smart glasses (no speaker labels are available).

Infer structure from context and return ONLY a JSON object with EXACTLY these keys:
{
  "participantEstimate": number,        // your best estimate of how many distinct people are talking, inferred from names mentioned, greetings, turn-taking, pronouns ("you", "we"), and questions/answers. Minimum 1.
  "participants": [{"name": string, "role": string|null}],  // distinct people you can identify or reasonably infer ("Speaker 2" if unnamed). role is their apparent role or null.
  "summary": string,                    // 1-3 sentence neutral summary of the discussion so far.
  "topics": string[],                   // short topic phrases discussed.
  "decisions": string[],                // concrete decisions reached (empty if none).
  "actionItems": [{"text": string, "owner": string|null}],  // follow-ups/tasks; owner is the person responsible or null.
  "takeaways": string[]                 // the key points worth remembering.
}

Be concise and faithful to the transcript. Do not invent decisions or action items that were not discussed. If the transcript is too short to tell, return small/empty arrays and participantEstimate 1.`;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asString).filter(Boolean);
}

function asParticipants(v: unknown): Participant[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) => {
      const obj = (p ?? {}) as Record<string, unknown>;
      const name = asString(obj.name);
      if (!name) return null;
      return { name, role: asString(obj.role) || null };
    })
    .filter((p): p is Participant => p !== null);
}

function asActionItems(v: unknown): ActionItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((a) => {
      const obj = (a ?? {}) as Record<string, unknown>;
      const text = asString(obj.text);
      if (!text) return null;
      return { text, owner: asString(obj.owner) || null };
    })
    .filter((a): a is ActionItem => a !== null);
}

/**
 * Summarize the meeting transcript so far into structured insights using
 * gpt-4o-mini. Participant count is an inference from conversational context,
 * not audio diarization (the SDK exposes no speaker identity).
 */
export async function analyzeMeeting(transcript: string): Promise<Insights> {
  const res = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: transcript },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* fall through to defaults */
  }

  const estimate = Number(parsed.participantEstimate);
  return {
    participantEstimate:
      Number.isFinite(estimate) && estimate >= 1 ? Math.round(estimate) : 1,
    participants: asParticipants(parsed.participants),
    summary: asString(parsed.summary),
    topics: asStringArray(parsed.topics),
    decisions: asStringArray(parsed.decisions),
    actionItems: asActionItems(parsed.actionItems),
    takeaways: asStringArray(parsed.takeaways),
    updatedAt: Date.now(),
  };
}
