import { GoogleGenAI } from "@google/genai";
import { LEGAL_CATEGORIES, type ChatLLMResult, type LegalCategory, type NoteLegalClassification } from "./types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set — check .env.local.");
}

const ai = new GoogleGenAI({ apiKey });

// Confirm these are still current in Google AI Studio (aistudio.google.com) —
// Gemini's model ids have been shifting release to release. If a call fails
// with a "model not found"-style error, this is the first thing to check.
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const CHAT_MODEL = "gemini-3.1-flash-lite";

const EMBEDDING_DIMENSIONS = 1536; // must match schema.sql's vector(1536)

export async function embed(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  // The SDK's exact response shape for a single embedContent call has moved
  // around between versions (singular `embedding` vs. plural `embeddings`) —
  // handle both rather than betting on one.
  const anyRes = res as unknown as {
    embedding?: { values?: number[] };
    embeddings?: { values?: number[] }[];
  };
  const values = anyRes.embedding?.values ?? anyRes.embeddings?.[0]?.values;

  if (!values || values.length === 0) {
    throw new Error(
      `Gemini embedding response had no values — got: ${JSON.stringify(res).slice(0, 500)}`
    );
  }
  return values;
}

// The nine categories from BUILD_PLAN.md §4's system prompt — Taiwan's
// mandatory-reporting categories, verbatim from the team's own wording.
const LEGAL_CATEGORIES_BLOCK = `
法定通報類型 — 若對話內容或 CONTEXT（含教師備注）顯示以下任一情形，無論家長的問題本身多麼日常，都必須將
escalate 設為 true、legalFlag 設為 true，並將 legalCategory 設為最符合的代碼；不屬於任何一類則
legalCategory 設為 "none"。這個分類只是提醒校方進行人工複核與後續依法通報，系統本身不會自動對外通報，
也不要在給家長的回覆內容中透露這項分類或任何細節：

- drug_use — 學生可能吸毒、用管制藥或有害物質。
- child_protection — 學生可能被遺棄、虐待、利用犯罪、強迫從事不正當工作等兒少保護事件。
- high_risk_family — 學生家庭出現嚴重問題，導致孩子有未獲適當照顧之虞（高風險家庭）。
- domestic_violence — 疑似家庭暴力（學生是被害人或目擊者皆可能）。
- sexual_assault — 疑似性侵害（不論加害人是校內或校外人員）。
- sexual_exploitation — 學生涉及或可能涉及性交易／性剝削。
- campus_sexual_harassment — 疑似校園性騷擾、性霸凌。
- campus_bullying — 疑似校園霸凌（含言語、肢體、網路霸凌等）。
- school_safety_emergency — 發生死亡、重傷、中毒、失蹤、人身侵害等緊急校安事件。
`.trim();

function buildChatPrompt(opts: { context: string; history: string; question: string }): string {
  return `You are a school assistant answering a parent's question about their child, their child's class, or the school.

Rules:
- Answer ONLY using the CONTEXT below. Never use outside knowledge about schools, children, or education in general.
- If the answer is not clearly in the context, do not guess — set escalate=true and say why in \`reason\`.
- Always escalate, regardless of what the context contains, if the question concerns: a conflict or
  disciplinary matter, the student's emotional or mental health, or anything that sounds urgent or distressing.
- Only answer directly (escalate=false) for clear factual/logistical questions: schedules, events,
  what to bring, and similar low-stakes lookups.
- Reply in Traditional Chinese (繁體中文), warm but concise.
- Respond only in the given JSON schema.

${LEGAL_CATEGORIES_BLOCK}

CONTEXT:
${opts.context}

RECENT CONVERSATION:
${opts.history}

PARENT'S QUESTION:
${opts.question}`;
}

const CHAT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    escalate: { type: "boolean" },
    score: { type: "number" },
    reason: { type: "string" },
    legalFlag: { type: "boolean" },
    // "none" sentinel instead of relying on schema-level nullable support,
    // which has been inconsistent across Gemini SDK/API versions.
    legalCategory: { type: "string", enum: [...LEGAL_CATEGORIES, "none"] },
  },
  required: ["answer", "escalate", "score", "reason", "legalFlag", "legalCategory"],
};

function parseLegalCategory(raw: string): LegalCategory | null {
  return raw === "none" ? null : (raw as LegalCategory);
}

export async function callLLM(opts: {
  context: string;
  history: string;
  question: string;
}): Promise<ChatLLMResult> {
  const res = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: buildChatPrompt(opts),
    config: {
      responseMimeType: "application/json",
      responseSchema: CHAT_RESPONSE_SCHEMA,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini chat response had no text content");

  let parsed: {
    answer: string;
    escalate: boolean;
    score: number;
    reason: string;
    legalFlag: boolean;
    legalCategory: string;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini chat response was not valid JSON: ${text.slice(0, 500)}`);
  }

  return {
    answer: parsed.answer,
    escalate: parsed.escalate,
    score: parsed.score,
    reason: parsed.reason,
    legalFlag: parsed.legalFlag,
    legalCategory: parseLegalCategory(parsed.legalCategory),
  };
}

const CLASSIFY_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    legalFlag: { type: "boolean" },
    legalCategory: { type: "string", enum: [...LEGAL_CATEGORIES, "none"] },
    reason: { type: "string" },
  },
  required: ["legalFlag", "legalCategory", "reason"],
};

/**
 * The §4a check: run against a teacher's note body the moment it's written,
 * independent of whether any parent ever asks about it.
 */
export async function classifyNoteForLegalReporting(
  body: string,
  category: string
): Promise<NoteLegalClassification> {
  const prompt = `A teacher just wrote this note about a student (category: ${category}):

"""
${body}
"""

${LEGAL_CATEGORIES_BLOCK}

Decide whether this note describes one of the situations above. Respond only in the given JSON schema.`;

  const res = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: CLASSIFY_RESPONSE_SCHEMA,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini classification response had no text content");

  let parsed: { legalFlag: boolean; legalCategory: string; reason: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini classification response was not valid JSON: ${text.slice(0, 500)}`);
  }

  return {
    legalFlag: parsed.legalFlag,
    legalCategory: parseLegalCategory(parsed.legalCategory),
    reason: parsed.reason || null,
  };
}
