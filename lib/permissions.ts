import type postgres from "postgres";
import { ApiError } from "./errors";
import type { Scope } from "./types";

type Sql = postgres.Sql;

export async function getStudentScope(
  sql: Sql,
  studentId: string
): Promise<{ classId: string; schoolId: string }> {
  const rows = await sql<{ class_id: string; school_id: string }[]>`
    select s.class_id, c.school_id
    from students s
    join classes c on c.id = s.class_id
    where s.id = ${studentId}
  `;
  if (rows.length === 0) throw new ApiError(404, "Student not found");
  return { classId: rows[0].class_id, schoolId: rows[0].school_id };
}

export async function assertParentOwnsStudent(
  sql: Sql,
  parentUserId: string,
  studentId: string
): Promise<void> {
  const rows = await sql`
    select 1 from parent_student
    where parent_user_id = ${parentUserId} and student_id = ${studentId}
  `;
  if (rows.length === 0) throw new ApiError(403, "This student is not linked to your account");
}

/** True if the teacher teaches the given class (any subject, including homeroom). */
export async function teacherTeachesClass(
  sql: Sql,
  teacherUserId: string,
  classId: string
): Promise<boolean> {
  const rows = await sql`
    select 1 from teacher_class
    where teacher_user_id = ${teacherUserId} and class_id = ${classId}
  `;
  return rows.length > 0;
}

/** True if the teacher teaches at least one class in the given school. */
export async function teacherTeachesInSchool(
  sql: Sql,
  teacherUserId: string,
  schoolId: string
): Promise<boolean> {
  const rows = await sql`
    select 1 from teacher_class tc
    join classes c on c.id = tc.class_id
    where tc.teacher_user_id = ${teacherUserId} and c.school_id = ${schoolId}
  `;
  return rows.length > 0;
}

/**
 * Checks a teacher is allowed to write a note/fact at the given scope.
 * - student scope: teacher must teach that student's class
 * - class scope: teacher must teach that class
 * - school scope: teacher must teach at least one class in that school
 */
export async function assertTeacherCanAuthor(
  sql: Sql,
  teacherUserId: string,
  scope: Scope,
  scopeId: string
): Promise<void> {
  if (scope === "student") {
    const { classId } = await getStudentScope(sql, scopeId);
    if (!(await teacherTeachesClass(sql, teacherUserId, classId))) {
      throw new ApiError(403, "You don't teach this student's class");
    }
    return;
  }
  if (scope === "class") {
    if (!(await teacherTeachesClass(sql, teacherUserId, scopeId))) {
      throw new ApiError(403, "You don't teach this class");
    }
    return;
  }
  // scope === "school"
  if (!(await teacherTeachesInSchool(sql, teacherUserId, scopeId))) {
    throw new ApiError(403, "You don't teach at this school");
  }
}

/**
 * Chat history access: the parent who owns the student, or any teacher who
 * teaches that student's class.
 */
export async function assertCanReadHistory(
  sql: Sql,
  session: { sub: string; role: "teacher" | "parent" },
  studentId: string
): Promise<void> {
  if (session.role === "parent") {
    await assertParentOwnsStudent(sql, session.sub, studentId);
    return;
  }
  const { classId } = await getStudentScope(sql, studentId);
  if (!(await teacherTeachesClass(sql, session.sub, classId))) {
    throw new ApiError(403, "You don't teach this student's class");
  }
}
