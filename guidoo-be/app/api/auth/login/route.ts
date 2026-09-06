import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { signToken } from "@/lib/auth";
import { ApiError, errorResponseBody } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) throw new ApiError(400, "email and password are required");

    const users = await sql<
      { id: string; name: string; role: "teacher" | "parent"; password_hash: string | null }[]
    >`
      select id, name, role, password_hash from users where email = ${email}
    `;
    if (users.length === 0) throw new ApiError(401, "Invalid email or password");
    const user = users[0];

    if (!user.password_hash) {
      // Seeded users have no password set until you run the demo-password SQL
      // from SETUP.md — this is a clearer error than a bcrypt crash.
      throw new ApiError(401, "This account has no password set yet — see SETUP.md's demo-password step");
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new ApiError(401, "Invalid email or password");

    const token = signToken({ sub: user.id, role: user.role, name: user.name });

    if (user.role === "parent") {
      const students = await sql<{ id: string; name: string; classId: string }[]>`
        select st.id, st.name, st.class_id as "classId"
        from parent_student ps
        join students st on st.id = ps.student_id
        where ps.parent_user_id = ${user.id}
      `;
      return NextResponse.json({
        token,
        user: { id: user.id, name: user.name, role: user.role, students },
      });
    }

    // teacher — dedupe classes (a teacher can teach the same class under
    // multiple subjects, e.g. homeroom + math)
    const classes = await sql<{ id: string; name: string }[]>`
      select distinct c.id, c.name
      from teacher_class tc
      join classes c on c.id = tc.class_id
      where tc.teacher_user_id = ${user.id}
    `;
    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, classes },
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
