import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertTeacherCanAuthor } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";
import type { FactType, Scope } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const session = requireSession(req, "teacher");
    const { scope, scopeId, factType, subject, term, eventDate, value } = (await req.json()) as {
      scope?: Scope;
      scopeId?: string;
      factType?: FactType;
      subject?: string;
      term?: string;
      eventDate?: string;
      value?: unknown;
    };
    if (!scope || !scopeId || !factType || value === undefined) {
      throw new ApiError(400, "scope, scopeId, factType, and value are required");
    }
    if (factType === "event" && !eventDate) {
      throw new ApiError(400, "eventDate is required when factType is 'event'");
    }

    await assertTeacherCanAuthor(sql, session.sub, scope, scopeId);

    const studentId = scope === "student" ? scopeId : null;
    const classId = scope === "class" ? scopeId : null;
    const schoolId = scope === "school" ? scopeId : null;

    const [fact] = await sql<{ id: string }[]>`
      insert into facts (student_id, class_id, school_id, fact_type, subject, term, event_date, value)
      values (${studentId}, ${classId}, ${schoolId}, ${factType}, ${subject ?? null},
              ${term ?? null}, ${eventDate ?? null}, ${sql.json(JSON.parse(JSON.stringify(value)))})
      returning id
    `;

    return NextResponse.json({ factId: fact.id });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
