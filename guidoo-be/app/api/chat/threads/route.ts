import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { teacherTeachesClass } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";

/**
 * The teacher's chat inbox: one row per student in the class that has at least
 * one message, newest conversation first. The thread body is fetched separately
 * via GET /api/chat/history?studentId=, and a reply is posted via POST /api/chat.
 */
export async function GET(req: Request) {
  try {
    const session = requireSession(req, "teacher");
    const classId = new URL(req.url).searchParams.get("classId");
    if (!classId) throw new ApiError(400, "classId query param is required");
    if (!(await teacherTeachesClass(sql, session.sub, classId))) {
      throw new ApiError(403, "You don't teach this class");
    }

    const threads = await sql`
      select
        s.id                       as "studentId",
        s.name                     as "studentName",
        parents.names              as "parentNames",
        last.content               as "lastMessage",
        last.role                  as "lastMessageRole",
        last.created_at            as "lastMessageAt",
        coalesce(esc.open_count, 0) as "openEscalations"
      from students s
      join lateral (
        select content, role, created_at
        from messages
        where student_id = s.id
        order by created_at desc
        limit 1
      ) last on true
      left join lateral (
        select count(*)::int as open_count
        from escalations
        where student_id = s.id and status = 'open'
      ) esc on true
      left join lateral (
        select string_agg(u.name, '、') as names
        from parent_student ps
        join users u on u.id = ps.parent_user_id
        where ps.student_id = s.id
      ) parents on true
      where s.class_id = ${classId}
      order by last.created_at desc
    `;

    return NextResponse.json({ threads });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
