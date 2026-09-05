import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertCanReadHistory } from "@/lib/permissions";
import { ApiError, errorResponseBody } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    const session = requireSession(req); // either role, checked per-row below
    const studentId = new URL(req.url).searchParams.get("studentId");
    if (!studentId) throw new ApiError(400, "studentId query param is required");

    await assertCanReadHistory(sql, session, studentId);

    const messages = await sql`
      select id, role, content, status, created_at as "createdAt"
      from messages
      where student_id = ${studentId}
      order by created_at asc
    `;

    return NextResponse.json({ messages });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
