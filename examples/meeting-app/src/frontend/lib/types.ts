/** Shapes shared between the stream hook, views, and export helpers. */

export interface Segment {
  segmentId: string;
  text: string;
  isFinal: boolean;
}

export interface ActionItem {
  text: string;
  owner: string | null;
}

export interface Participant {
  name: string;
  role: string | null;
}

/** LLM-derived meeting intelligence (regenerated as the conversation grows). */
export interface Insights {
  /** Inferred from conversational context — NOT audio diarization. */
  participantEstimate: number;
  participants: Participant[];
  summary: string;
  topics: string[];
  decisions: string[];
  actionItems: ActionItem[];
  takeaways: string[];
  updatedAt: number;
}
