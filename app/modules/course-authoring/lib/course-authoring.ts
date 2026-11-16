import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";
import { markdown } from "~/lib/text";

export type Db = BetterSQLite3Database<typeof schema>;

export type NewCourse = {
  title: string;
  slug: string;
  description: string;
  salesCopy: string;
  instructorId: number;
  categoryId: number;
  coverImageUrl: string | null;
};

const { courses, modules, lessons } = schema;

export function createCourse(db: Db, course: NewCourse, now: Date) {
  if (course.salesCopy.trim().length === 0) {
    throw new Error("Sales copy cannot be empty");
  }

  const at = now.toISOString();
  return db
    .insert(courses)
    .values({
      ...course,
      salesCopy: markdown(course.salesCopy),
      status: CourseStatus.Draft,
      createdAt: at,
      updatedAt: at,
    })
    .returning()
    .get();
}

export type StatusChange = { courseId: number; status: CourseStatus };

export function setCourseStatus(
  db: Db,
  { courseId, status }: StatusChange,
  now: Date
) {
  return db
    .update(courses)
    .set({ status, updatedAt: now.toISOString() })
    .where(eq(courses.id, courseId))
    .returning()
    .get();
}

export type NewModule = { courseId: number; title: string };

export function addModule(db: Db, { courseId, title }: NewModule, now: Date) {
  const last = db
    .select({ max: sql<number>`coalesce(max(${modules.position}), 0)` })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .get();

  return db
    .insert(modules)
    .values({
      courseId,
      title,
      position: (last?.max ?? 0) + 1,
      createdAt: now.toISOString(),
    })
    .returning()
    .get();
}

export type NewLesson = { moduleId: number; title: string };

export function addLesson(db: Db, { moduleId, title }: NewLesson, now: Date) {
  const last = db
    .select({ max: sql<number>`coalesce(max(${lessons.position}), 0)` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .get();

  return db
    .insert(lessons)
    .values({
      moduleId,
      title,
      position: (last?.max ?? 0) + 1,
      createdAt: now.toISOString(),
    })
    .returning()
    .get();
}
