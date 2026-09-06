import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { embed, classifyNoteForLegalReporting } from "@/lib/gemini";
import { notifyByEmail } from "@/lib/resend";
import { assertTeacherCanAuthor } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";
import type { NoteCategory, Scope } from "@/lib/types";

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function POST(req: Request) {
  try {
    const session = requireSession(req, "teacher");
    const { scope, scopeId, category, body, needsParentAction } = (await req.json()) as {
      scope?: Scope;
      scopeId?: string;
      category?: NoteCategory;
      body?: string;
      needsParentAction?: boolean;
    };
    if (!scope || !scopeId || !category || !body) {
      throw new ApiError(400, "scope, scopeId, category, and body are required");
    }

    await assertTeacherCanAuthor(sql, session.sub, scope, scopeId);

    const vectorLiteral = toVectorLiteral(await embed(body));
    const studentId = scope === "student" ? scopeId : null;
    const classId = scope === "class" ? scopeId : null;
    const schoolId = scope === "school" ? scopeId : null;

    const [note] = await sql<{ id: string }[]>`
      insert into notes
        (student_id, class_id, school_id, author_teacher_id, category, body, needs_parent_action, embedding)
      values
        (${studentId}, ${classId}, ${schoolId}, ${session.sub}, ${category}, ${body},
         ${needsParentAction ?? false}, ${vectorLiteral}::vector)
      returning id
    `;

    // §4a — catch a legally-reportable situation the moment it's written,
    // before any parent ever asks. Student-scoped notes only.
    if (scope === "student") {
      const legalReportingEmail = process.env.LEGAL_REPORTING_EMAIL;
      const cls = await classifyNoteForLegalReporting(body, category);
      if (cls.legalFlag) {
        await sql`
          insert into escalations (note_id, student_id, reason, legal_flag, legal_category)
          values (${note.id}, ${scopeId}, ${cls.reason}, true, ${cls.legalCategory})
        `;
        if (legalReportingEmail) {
          await notifyByEmail({
            to: legalReportingEmail,
            subject: `[依法通報疑慮] 新的教師備注需要複核`,
            html: `<p>分類：${cls.legalCategory}</p><p>原因：${cls.reason}</p>`,
          });
        } else {
          console.warn(
            "LEGAL_REPORTING_EMAIL is not set — legal-flag escalation created but no email sent."
          );
        }
      }
    }

    return NextResponse.json({ noteId: note.id });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
