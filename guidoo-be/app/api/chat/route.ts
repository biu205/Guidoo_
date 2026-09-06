import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { embed, callLLM } from "@/lib/gemini";
import { notifyByEmail } from "@/lib/resend";
import {
  assertParentOwnsStudent,
  getLinkedParents,
  getStudentScope,
  teacherTeachesClass,
} from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";
import type { ChatSource, SessionPayload } from "@/lib/types";

type NoteRow = {
  id: string;
  category: string;
  body: string;
  created_at: string;
};

type FactRow = {
  id: string;
  fact_type: string;
  subject: string | null;
  term: string | null;
  event_date: string | null;
  value: unknown;
};

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

function renderContext(notes: NoteRow[], facts: FactRow[]): string {
  const noteLines = notes.length
    ? notes.map((n) => `- (${n.category}, ${n.created_at}) ${n.body}`).join("\n")
    : "(none)";

  const factLines = facts.length
    ? facts
        .map((f) => {
          const label = f.subject ? `${f.fact_type} ${f.subject}` : f.fact_type;
          const when = f.event_date ? ` @ ${f.event_date}` : f.term ? ` (${f.term})` : "";
          return `- ${label}${when}: ${JSON.stringify(f.value)}`;
        })
        .join("\n")
    : "(none)";

  return `[Notes]\n${noteLines}\n\n[Facts]\n${factLines}`;
}

function renderHistory(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return "(no prior messages)";
  const label = (r: string) => (r === "parent" ? "家長" : r === "teacher" ? "老師" : "助理");
  return messages.map((m) => `${label(m.role)}: ${m.content}`).join("\n");
}

function buildSources(notes: NoteRow[], facts: FactRow[]): ChatSource[] {
  return [
    ...notes.map(
      (n): ChatSource => ({ type: "note", id: n.id, snippet: `${n.category}: ${n.body.slice(0, 80)}` })
    ),
    ...facts.map(
      (f): ChatSource => ({
        type: "fact",
        id: f.id,
        snippet: `${f.fact_type}${f.subject ? ` (${f.subject})` : ""}: ${JSON.stringify(f.value)}`,
      })
    ),
  ];
}

/** The original flow: parent asks a question, gets an AI-grounded answer or an escalation. */
async function handleParentChat(req: Request, session: SessionPayload) {
  const { studentId, message } = (await req.json()) as { studentId?: string; message?: string };
  if (!studentId || !message) throw new ApiError(400, "studentId and message are required");

  await assertParentOwnsStudent(sql, session.sub, studentId);
  const { classId, schoolId } = await getStudentScope(sql, studentId);

  const queryVector = await embed(message);
  const vectorLiteral = toVectorLiteral(queryVector);

  const similarNotes = await sql<NoteRow[]>`
    select id, category, body, created_at
    from notes
    where student_id = ${studentId} or class_id = ${classId} or school_id = ${schoolId}
    order by embedding <-> ${vectorLiteral}::vector
    limit 5
  `;

  // Two pools, unioned: upcoming events nearest-first (what answers "what's
  // coming up" questions), and everything else (grades/attendance/homework,
  // plus any past-dated events) most-recently-recorded first. Kept separate
  // rather than one query ordered desc by date, because with enough events
  // in scope a single desc-ordered, limited query returns the FARTHEST-future
  // facts first — burying the nearest upcoming events (and even the
  // student's own grades) behind the limit cutoff.
  const scopedFacts = await sql<FactRow[]>`
    (
      select id, fact_type, subject, term, event_date, value
      from facts
      where (student_id = ${studentId} or class_id = ${classId} or school_id = ${schoolId})
        and fact_type = 'event'
        and event_date >= now()
      order by event_date asc
      limit 10
    )
    union all
    (
      select id, fact_type, subject, term, event_date, value
      from facts
      where (student_id = ${studentId} or class_id = ${classId} or school_id = ${schoolId})
        and not (fact_type = 'event' and event_date >= now())
      order by coalesce(event_date, recorded_at) desc
      limit 8
    )
  `;

  // Full thread for this student (parent + teacher + assistant messages), not just this
  // parent's own turns — a teacher may have replied in between.
  const priorMessages = await sql<{ role: string; content: string }[]>`
    select role, content from messages
    where student_id = ${studentId} and parent_user_id = ${session.sub}
    order by created_at desc
    limit 6
  `;
  const history = renderHistory([...priorMessages].reverse());
  const context = renderContext(similarNotes, scopedFacts);

  let llmOut = await callLLM({ context, history, question: message });
  console.log(
    `[chat] studentId=${studentId} question=${JSON.stringify(message)} ` +
      `notesFound=${similarNotes.length} factsFound=${scopedFacts.length} ` +
      `llmOut(raw)=${JSON.stringify(llmOut)}`
  );

  // Deterministic backstop: if the vector search + facts query found nothing
  // at all for this student's scope, don't rely on the LLM to reliably
  // self-report "I don't know" — in practice it sometimes just writes a
  // reassuring "the teacher will get back to you" sentence in `answer`
  // without ever setting escalate=true, which means no escalation row and no
  // teacher email actually fires. Force it here instead. Severity is green
  // (1): this is a plain information gap, not an urgent situation.
  const hasContext = similarNotes.length > 0 || scopedFacts.length > 0;
  if (!hasContext && !llmOut.escalate) {
    llmOut = {
      ...llmOut,
      escalate: true,
      score: 1,
      reason: llmOut.reason || "資料庫中找不到與此問題相關的備注或資料，需要老師協助回覆。",
    };
  }

  // Second deterministic check: if this student has an OPEN, legally-flagged
  // escalation on file, keep the teacher quietly in the loop on every message
  // from this family — even a mundane one — rather than relying on the LLM to
  // notice a historical note buried in CONTEXT (unreliable; see the "did he
  // finish lunch" test). Importantly, this is a SEPARATE, independent signal
  // from llmOut.escalate: it must never discard a genuinely correct direct
  // answer the LLM already produced (that was the bug — a parent asking a
  // perfectly answerable question, e.g. field-trip time, was getting the
  // generic "teacher will get back to you" reply instead of the real answer,
  // just because of an unrelated open legal escalation on file). So when the
  // LLM's own answer stands (escalate=false), the parent still gets that real
  // answer, and we ALSO log a background, non-legally-tagged FYI escalation +
  // email for the teacher's awareness. Clears itself automatically once a
  // teacher resolves the underlying open escalation.
  let notifyTeacherForAwareness = false;
  if (!llmOut.escalate) {
    const [{ hasOpenLegalEscalation }] = await sql<{ hasOpenLegalEscalation: boolean }[]>`
      select exists (
        select 1 from escalations
        where student_id = ${studentId} and legal_flag = true and status = 'open'
      ) as "hasOpenLegalEscalation"
    `;
    console.log(`[chat] studentId=${studentId} hasOpenLegalEscalation=${hasOpenLegalEscalation}`);
    notifyTeacherForAwareness = hasOpenLegalEscalation;
  }

  const [parentMessageRow] = await sql<{ id: string }[]>`
    insert into messages (student_id, parent_user_id, role, content)
    values (${studentId}, ${session.sub}, 'parent', ${message})
    returning id
  `;

  let escalationId: string | null = null;
  let replyText: string;
  let status: "answered" | "escalated";

  if (llmOut.escalate) {
    const [escalationRow] = await sql<{ id: string }[]>`
      insert into escalations (message_id, student_id, score, reason, legal_flag, legal_category)
      values (${parentMessageRow.id}, ${studentId}, ${llmOut.score}, ${llmOut.reason},
              ${llmOut.legalFlag}, ${llmOut.legalCategory})
      returning id
    `;
    escalationId = escalationRow.id;

    const teachers = await sql<{ email: string; name: string }[]>`
      select distinct u.email, u.name
      from teacher_class tc
      join users u on u.id = tc.teacher_user_id
      where tc.class_id = ${classId}
    `;
    console.log(
      `[chat escalation] classId=${classId} matched ${teachers.length} teacher(s):`,
      teachers.map((t) => t.email)
    );
    const subjectTag = llmOut.legalFlag ? "[依法通報疑慮] " : "";
    for (const teacher of teachers) {
      await notifyByEmail({
        to: teacher.email,
        subject: `${subjectTag}家長提問需要您協助`,
        html: `<p>家長提問：${message}</p><p>原因：${llmOut.reason}</p>`,
      });
    }

    replyText = "我已經通知老師了，老師會盡快處理.";
    status = "escalated";
  } else {
    replyText = llmOut.answer;
    status = "answered";

    // Background FYI path: the parent gets the real answer above; separately,
    // log a low-severity, non-legal escalation and quietly notify the class's
    // teachers so they stay aware of this family's activity while a legal
    // escalation is open on file. Does not affect what the parent sees.
    if (notifyTeacherForAwareness) {
      const [escalationRow] = await sql<{ id: string }[]>`
        insert into escalations (message_id, student_id, score, reason, legal_flag, legal_category)
        values (${parentMessageRow.id}, ${studentId}, 1,
                '此學生目前有尚未結案的法定通報疑慮紀錄，雖然本次訊息內容本身沒有明顯問題，仍附上供老師留意並確認。',
                false, null)
        returning id
      `;
      escalationId = escalationRow.id;

      const teachers = await sql<{ email: string; name: string }[]>`
        select distinct u.email, u.name
        from teacher_class tc
        join users u on u.id = tc.teacher_user_id
        where tc.class_id = ${classId}
      `;
      console.log(
        `[chat awareness-fyi] classId=${classId} matched ${teachers.length} teacher(s):`,
        teachers.map((t) => t.email)
      );
      for (const teacher of teachers) {
        await notifyByEmail({
          to: teacher.email,
          subject: "家長提問通知（僅供留意）",
          html: `<p>家長提問：${message}</p><p>系統回覆：${replyText}</p><p>提醒：此學生目前有尚未結案的法定通報疑慮紀錄，僅供留意，本次訊息內容本身沒有明顯問題。</p>`,
        });
      }
    }
  }

  await sql`
    insert into messages (student_id, parent_user_id, role, content, status, escalation_id)
    values (${studentId}, ${session.sub}, 'assistant', ${replyText}, ${status}, ${escalationId})
  `;

  return NextResponse.json({
    status,
    message: replyText,
    sources: buildSources(similarNotes, scopedFacts),
    escalationId,
  });
}

/**
 * A teacher replying directly in a student's chat — no LLM involved, just a
 * plain message insert. Resolves which parent's thread to post into
 * automatically when there's exactly one linked parent (the common case);
 * otherwise the caller must pass parentUserId.
 */
async function handleTeacherReply(req: Request, session: SessionPayload) {
  const { studentId, message, parentUserId } = (await req.json()) as {
    studentId?: string;
    message?: string;
    parentUserId?: string;
  };
  if (!studentId || !message) throw new ApiError(400, "studentId and message are required");

  const { classId } = await getStudentScope(sql, studentId);
  if (!(await teacherTeachesClass(sql, session.sub, classId))) {
    throw new ApiError(403, "You don't teach this student's class");
  }

  const linkedParents = await getLinkedParents(sql, studentId);
  let resolvedParentUserId: string;
  if (parentUserId) {
    if (!linkedParents.some((p) => p.id === parentUserId)) {
      throw new ApiError(400, "parentUserId is not linked to this student");
    }
    resolvedParentUserId = parentUserId;
  } else if (linkedParents.length === 1) {
    resolvedParentUserId = linkedParents[0].id;
  } else if (linkedParents.length === 0) {
    throw new ApiError(400, "This student has no linked parent account yet");
  } else {
    throw new ApiError(
      400,
      "This student has more than one linked parent — pass parentUserId to pick which thread"
    );
  }

  const [row] = await sql<{ id: string; created_at: string }[]>`
    insert into messages (student_id, parent_user_id, role, content, author_teacher_id)
    values (${studentId}, ${resolvedParentUserId}, 'teacher', ${message}, ${session.sub})
    returning id, created_at
  `;

  return NextResponse.json({
    messageId: row.id,
    studentId,
    parentUserId: resolvedParentUserId,
    createdAt: row.created_at,
    linkedParents: linkedParents.length > 1 ? linkedParents : undefined,
  });
}

export async function POST(req: Request) {
  try {
    const session = requireSession(req); // either role — dispatched below
    if (session.role === "teacher") {
      return await handleTeacherReply(req, session);
    }
    return await handleParentChat(req, session);
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
