import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { teacherTeachesClass } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireSession(req, "teacher");
    const { id } = await params;

    const rows = await sql<{ student_class_id: string }[]>`
      select st.class_id as student_class_id
      from escalations e
      join students st on st.id = e.student_id
      where e.id = ${id}
    `;
    if (rows.length === 0) throw new ApiError(404, "Escalation not found");
    if (!(await teacherTeachesClass(sql, session.sub, rows[0].student_class_id))) {
      throw new ApiError(403, "You don't teach this student's class");
    }

    await sql`
      update escalations
      set status = 'resolved', resolved_at = now(), resolved_by = ${session.sub}
      where id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
