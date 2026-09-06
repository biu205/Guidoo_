import { GoogleGenAI } from "@google/genai";
import {
  LEGAL_CATEGORIES,
  type ChatLLMResult,
  type EscalationSeverity,
  type LegalCategory,
  type NoteLegalClassification,
} from "./types";

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
//
// Deliberately scoped to "relevant to the current conversation" (not "any
// concerning note that happens to be in CONTEXT") — a note describing a past
// incident already gets its own legal classification the moment a teacher
// writes it (§4a). Without this carve-out, a student with any flagged
// history would have every future, unrelated question (e.g. "did he finish
// his lunch?") permanently re-escalated as legally urgent, which is both
// wrong and would quickly desensitize teachers to real alerts.
const LEGAL_CATEGORIES_BLOCK = `
法定通報類型 — 若家長「這一次」的訊息本身，或 CONTEXT 中與「這一次問題實際討論的情況」直接相關的備注，
顯示以下任一情形，都必須將 escalate 設為 true、legalFlag 設為 true，並將 legalCategory 設為最符合的代碼
——即使家長本次訊息的措辭聽起來很日常、很委婉，只要內容實際上符合以下類型，也要如實標記；不屬於任何一類
則 legalCategory 設為 "none"。這個分類只是提醒校方進行人工複核與後續依法通報，系統本身不會自動對外通報，
也不要在給家長的回覆內容中透露這項分類或任何細節：

重要：CONTEXT 中可能包含這名學生「過去」的備注，RECENT CONVERSATION 中也可能包含家長在「先前」訊息中
提到的內容（例如上一輪對話中曾提到孩子受傷或疑似被欺負）。如果這些過去的備注或先前對話內容涉及以下情形，
但與家長「這一次」問的問題本身完全無關（例如這次只是單純詢問吃飯、功課、活動時間、校外教學集合時間等日常
事務），請不要僅因為那些內容出現在 CONTEXT 或 RECENT CONVERSATION 中，就把「這一次」的訊息也標記為
escalate/legalFlag——那件過去的事件應該已經在當時（不論是教師撰寫備注時，或家長最初傳送那則訊息時）被
另外處理及通報過了，不需要在無關的新問題上重複觸發。判斷依據永遠是 PARENT'S QUESTION 這一段「這一次」的
內容，RECENT CONVERSATION 只用來理解代名詞、前後文等語意，不代表這一次的問題也涉及相同的疑慮。

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

// Severity used to color-code escalations in the teacher UI. Only meaningful
// when escalate is true — the value is ignored otherwise, so any integer is
// fine in that case.
const SEVERITY_BLOCK = `
若 escalate 為 true，請將 score 設為以下三個嚴重程度之一（必須是整數 1、2 或 3，不可為其他數字或小數）：

- 3（紅色 / 最高等級）：事情會需要嚴重到通報教育局，或需要學校緊急處理。只要 legalFlag 為 true（符合上方法定通報類型），score 一律設為 3。
- 2（黃色）：事情需要特別注意，若再嚴重下去，之後可能需要採取行動。
- 1（綠色）：事情需要去做／回覆，但如果沒有立即處理，也不會造成嚴重後果。

若 escalate 為 false，score 請設為 1（此時不會被使用）。
`.trim();

// Without this, the model has no anchor for "today" and can't reliably judge
// relative-time phrases like "下個月" (next month) or "這週" (this week) — it
// would just be guessing. Computed in Asia/Taipei time since that's the
// timezone all of this app's dates/timestamps are already in.
function todayInTaipei(): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function buildChatPrompt(opts: { context: string; history: string; question: string }): string {
  return `You are a school assistant answering a parent's question about their child, their child's class, or the school.

今天日期：${todayInTaipei()}（回答「最近」、「這週」、「下個月」等相對時間問題時，請以此為基準判斷）

Rules:
- Answer ONLY using the CONTEXT below. Never use outside knowledge about schools, children, or education in general.
- If the answer is not clearly in the context, do not guess — set escalate=true and say why in \`reason\`.
- Always escalate if THIS message — the parent's current question, in the PARENT'S QUESTION section below —
  itself concerns: a conflict or disciplinary matter, the student's emotional or mental health, or anything
  that sounds urgent or distressing. Base this only on the current question (and CONTEXT directly relevant
  to it) — NOT on older concerns that only appear in RECENT CONVERSATION or in unrelated CONTEXT notes; those
  were already escalated when they first came up, and repeating that escalation on every later, unrelated
  question would bury real new alerts under noise.
- Only answer directly (escalate=false) for clear factual/logistical questions: schedules, events,
  what to bring, and similar low-stakes lookups.
- Reply in Traditional Chinese (繁體中文), warm but concise.
- Respond only in the given JSON schema.

${LEGAL_CATEGORIES_BLOCK}

${SEVERITY_BLOCK}

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
    // Severity: 1 (green) / 2 (yellow) / 3 (red) — see SEVERITY_BLOCK. Declared
    // as "integer" here, but parseSeverity() below still clamps defensively,
    // since Gemini's structured-output enforcement for numeric types has been
    // inconsistent across SDK/API versions (this is exactly how a stray 0.9
    // ended up in the escalations table before this field had any real
    // definition).
    score: { type: "integer" },
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

/** Clamp/round whatever the LLM returned into a valid 1|2|3, defensively. */
function parseSeverity(raw: number): EscalationSeverity {
  const rounded = Math.round(raw);
  const clamped = Math.min(3, Math.max(1, rounded));
  return clamped as EscalationSeverity;
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
    score: parseSeverity(parsed.score),
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
