import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";

// The landing page only reads the catalogue, and nothing in the app writes
// courses, modules or lessons through a service yet, so rows go in directly.
// Kept in one place so a schema change touches only this file.

type Base = ReturnType<typeof seedBaseData>;

type NewCourse = {
  title: string;
  createdAt: string;
  status?: CourseStatus;
  instructorId?: number;
  categoryId?: number;
};

let slugCounter = 0;

function addInstructor(db: TestDb, name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      role: UserRole.Instructor,
    })
    .returning()
    .get();
}

function addCategory(db: TestDb, name: string) {
  return db
    .insert(schema.categories)
    .values({ name, slug: name.toLowerCase() })
    .returning()
    .get();
}

function addCourse(db: TestDb, base: Base, course: NewCourse) {
  slugCounter += 1;
  return db
    .insert(schema.courses)
    .values({
      title: course.title,
      slug: `course-${slugCounter}`,
      description: `About ${course.title}`,
      salesCopy: markdown(course.title),
      instructorId: course.instructorId ?? base.instructor.id,
      categoryId: course.categoryId ?? base.category.id,
      status: course.status ?? CourseStatus.Published,
      coverImageUrl: `/images/${slugCounter}.svg`,
      createdAt: course.createdAt,
    })
    .returning()
    .get();
}

// One module per entry in `perModule`, holding that many lessons.
function addLessons(db: TestDb, courseId: number, perModule: number[]) {
  perModule.forEach((count, mi) => {
    const mod = db
      .insert(schema.modules)
      .values({ courseId, title: `Module ${mi + 1}`, position: mi + 1 })
      .returning()
      .get();
    for (let li = 0; li < count; li++) {
      db.insert(schema.lessons)
        .values({
          moduleId: mod.id,
          title: `Lesson ${li + 1}`,
          position: li + 1,
        })
        .run();
    }
  });
}

function setStatus(db: TestDb, courseId: number, status: CourseStatus) {
  db.update(schema.courses)
    .set({ status })
    .where(eq(schema.courses.id, courseId))
    .run();
}

/** A test database holding `seedBaseData`'s one published course. */
export function createCatalogue() {
  const db = createTestDb();
  const base = seedBaseData(db);

  return {
    db,
    base,
    addInstructor: (name: string) => addInstructor(db, name),
    addCategory: (name: string) => addCategory(db, name),
    addCourse: (course: NewCourse) => addCourse(db, base, course),
    addLessons: (courseId: number, perModule: number[]) =>
      addLessons(db, courseId, perModule),
    setStatus: (courseId: number, status: CourseStatus) =>
      setStatus(db, courseId, status),
  };
}

export type Catalogue = ReturnType<typeof createCatalogue>;
