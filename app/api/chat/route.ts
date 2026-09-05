import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { embed, callLLM } from "@/lib/gemini";
import { notifyByEmail } from "@/lib/resend";
import { assertParentOwnsStudent, getStudentScope } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";
import type { ChatSource } from "@/lib/types";

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
    ? notes
        .map((n) => `- (${n.category}, ${n.created_at}) ${n.body}`)
        .join("\n")
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

function renderHistory(
  messages: { role: "parent" | "assistant"; content: string }[]
): string {
  if (messages.length === 0) return "(no prior messages)";
  return messages.map((m) => `${m.role === "parent" ? "家長" : "助理"}: ${m.content}`).join("\n");
}

function buildSources(notes: NoteRow[], facts: FactRow[]): ChatSource[] {
  return [
    ...notes.map((n): ChatSource => ({
      type: "note",
      id: n.id,
      snippet: `${n.category}: ${n.body.slice(0, 80)}`,
    })),
    ...facts.map((f): ChatSource => ({
      type: "fact",
      id: f.id,
      snippet: `${f.fact_type}${f.subject ? ` (${f.subject})` : ""}: ${JSON.stringify(f.value)}`,
    })),
  ];
}

export async function POST(req: Request) {
  try {
    const session = requireSession(req, "parent");
    const { studentId, message } = (await req.json()) as {
      studentId?: string;
      message?: string;
    };
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

    const scopedFacts = await sql<FactRow[]>`
      select id, fact_type, subject, term, event_date, value
      from facts
      where student_id = ${studentId} or class_id = ${classId} or school_id = ${schoolId}
      order by coalesce(event_date, recorded_at) desc
      limit 8
    `;

    const priorMessages = await sql<{ role: "parent" | "assistant"; content: string }[]>`
      select role, content from messages
      where student_id = ${studentId} and parent_user_id = ${session.sub}
      order by created_at desc
      limit 6
    `;
    const history = renderHistory([...priorMessages].reverse());
    const context = renderContext(similarNotes, scopedFacts);

    const llmOut = await callLLM({ context, history, question: message });

    // Save the parent's message first so an escalation can reference it.
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

      // Notify whichever teacher(s) teach this student's class.
      const teachers = await sql<{ email: string; name: string }[]>`
        select distinct u.email, u.name
        from teacher_class tc
        join users u on u.id = tc.teacher_user_id
        where tc.class_id = ${classId}
      `;
      const subjectTag = llmOut.legalFlag ? "[依法通報疑慮] " : "";
      for (const teacher of teachers) {
        await notifyByEmail({
          to: teacher.email,
          subject: `${subjectTag}家長提問需要您協助`,
          html: `<p>家長提問：${message}</p><p>原因：${llmOut.reason}</p>`,
        });
      }

      // Never let the classification reach the parent — same neutral holding
      // message regardless of category. See BUILD_PLAN.md §4's callout.
      replyText = "這是個好問題，我已經通知老師了，老師會再跟您回覆。";
      status = "escalated";
    } else {
      replyText = llmOut.answer;
      status = "answered";
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
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
