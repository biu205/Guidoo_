// Shared types across API routes. Mirrors BUILD_PLAN.md §2/§3/§4.

export type Role = "teacher" | "parent";

export const LEGAL_CATEGORIES = [
  "drug_use",
  "child_protection",
  "high_risk_family",
  "domestic_violence",
  "sexual_assault",
  "sexual_exploitation",
  "campus_sexual_harassment",
  "campus_bullying",
  "school_safety_emergency",
] as const;

export type LegalCategory = (typeof LEGAL_CATEGORIES)[number];

export type Scope = "student" | "class" | "school";

export type FactType = "grade" | "attendance" | "homework_status" | "event";

export type NoteCategory =
  | "incident"
  | "academic"
  | "emotional"
  | "habit"
  | "event"
  | "logistics"
  | "other";

export type SessionPayload = {
  sub: string; // user id
  role: Role;
  name: string;
};

export type ChatSource = {
  type: "note" | "fact";
  id: string;
  snippet: string;
};

// The shape callLLM() returns — see BUILD_PLAN.md §4's responseSchema and §4a.
export type ChatLLMResult = {
  answer: string;
  escalate: boolean;
  score: number;
  reason: string;
  legalFlag: boolean;
  legalCategory: LegalCategory | null;
};

// The smaller call from §4a, run on student-scoped notes at write time.
export type NoteLegalClassification = {
  legalFlag: boolean;
  legalCategory: LegalCategory | null;
  reason: string | null;
};
