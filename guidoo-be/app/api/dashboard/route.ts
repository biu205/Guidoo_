import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { teacherTeachesClass } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    const session = requireSession(req, "teacher");
    const classId = new URL(req.url).searchParams.get("classId");
    if (!classId) throw new ApiError(400, "classId query param is required");
    if (!(await teacherTeachesClass(sql, session.sub, classId))) {
      throw new ApiError(403, "You don't teach this class");
    }

    // "for this class" = a note/escalation scoped directly to the class, or
    // scoped to one of its students.
    const [{ count: noteCount7d }] = await sql<{ count: number }[]>`
      select count(*)::int as count from notes
      where (class_id = ${classId} or student_id in (select id from students where class_id = ${classId}))
        and created_at >= now() - interval '7 days'
    `;

    const [{ count: incidentCount7d }] = await sql<{ count: number }[]>`
      select count(*)::int as count from notes
      where category = 'incident'
        and (class_id = ${classId} or student_id in (select id from students where class_id = ${classId}))
        and created_at >= now() - interval '7 days'
    `;

    const [{ count: openEscalations }] = await sql<{ count: number }[]>`
      select count(*)::int as count from escalations
      where status = 'open'
        and student_id in (select id from students where class_id = ${classId})
    `;

    const [{ count: legalFlagCount7d }] = await sql<{ count: number }[]>`
      select count(*)::int as count from escalations
      where legal_flag = true
        and student_id in (select id from students where class_id = ${classId})
        and created_at >= now() - interval '7 days'
    `;

    const recentEscalations = await sql`
      select
        e.id,
        s.id as "studentId",
        s.name as "studentName",
        m.content as question,
        e.score,
        e.created_at as "createdAt",
        e.legal_flag as "legalFlag",
        e.legal_category as "legalCategory"
      from escalations e
      join students s on s.id = e.student_id
      left join messages m on m.id = e.message_id
      where e.student_id in (select id from students where class_id = ${classId})
      order by e.created_at desc
      limit 10
    `;

    return NextResponse.json({
      noteCount7d,
      incidentCount7d,
      openEscalations,
      legalFlagCount7d,
      recentEscalations,
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
