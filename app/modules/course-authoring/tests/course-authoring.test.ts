import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";
import { createCourseAuthoring, type NewCourse } from "../index.server";

let authoring: ReturnType<typeof createCourseAuthoring>;
let base: ReturnType<typeof seedBaseData>;
let db: TestDb;

const NOW = new Date("2026-05-01T12:00:00.000Z");
const LATER = new Date("2026-06-01T12:00:00.000Z");

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  authoring = createCourseAuthoring(db);
});

function newCourse(overrides: Partial<NewCourse> = {}): NewCourse {
  return {
    title: "Rust Basics",
    slug: "rust-basics",
    description: "Learn Rust",
    salesCopy: "## Rust\n\nLearn it.",
    instructorId: base.instructor.id,
    categoryId: base.category.id,
    coverImageUrl: null,
    ...overrides,
  };
}

describe("createCourse", () => {
  it("creates a draft stamped with the time it was given", () => {
    const course = authoring.createCourse(
      newCourse({ coverImageUrl: "/images/rust.svg" }),
      NOW
    );

    expect(course).toMatchObject({
      title: "Rust Basics",
      slug: "rust-basics",
      description: "Learn Rust",
      salesCopy: "## Rust\n\nLearn it.",
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      coverImageUrl: "/images/rust.svg",
      status: CourseStatus.Draft,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it("refuses blank sales copy", () => {
    expect(() =>
      authoring.createCourse(newCourse({ salesCopy: "  \n " }), NOW)
    ).toThrow("Sales copy cannot be empty");
  });
});

describe("setCourseStatus", () => {
  it("moves the course to the status and stamps the update time", () => {
    const course = authoring.createCourse(newCourse(), NOW);

    const updated = authoring.setCourseStatus(
      { courseId: course.id, status: CourseStatus.Published },
      LATER
    );

    expect(updated).toMatchObject({
      status: CourseStatus.Published,
      createdAt: NOW.toISOString(),
      updatedAt: LATER.toISOString(),
    });
  });

  it("leaves other courses alone", () => {
    const course = authoring.createCourse(newCourse(), NOW);

    authoring.setCourseStatus(
      { courseId: course.id, status: CourseStatus.Archived },
      LATER
    );

    const untouched = db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, base.course.id))
      .get();
    expect(untouched?.status).toBe(CourseStatus.Published);
  });
});

describe("addModule", () => {
  it("places each module after the course's last one", () => {
    const first = authoring.addModule(
      { courseId: base.course.id, title: "Intro" },
      NOW
    );
    const second = authoring.addModule(
      { courseId: base.course.id, title: "Next" },
      LATER
    );

    expect(first).toMatchObject({
      courseId: base.course.id,
      title: "Intro",
      position: 1,
      createdAt: NOW.toISOString(),
    });
    expect(second.position).toBe(2);
  });

  it("numbers each course's modules on their own", () => {
    const other = authoring.createCourse(newCourse(), NOW);
    authoring.addModule({ courseId: base.course.id, title: "Intro" }, NOW);
    authoring.addModule({ courseId: base.course.id, title: "Next" }, NOW);

    expect(
      authoring.addModule({ courseId: other.id, title: "Start" }, NOW).position
    ).toBe(1);
  });
});

describe("addLesson", () => {
  it("places each lesson after the module's last one, with no content", () => {
    const mod = authoring.addModule(
      { courseId: base.course.id, title: "Intro" },
      NOW
    );

    const first = authoring.addLesson(
      { moduleId: mod.id, title: "Hello" },
      NOW
    );
    const second = authoring.addLesson(
      { moduleId: mod.id, title: "World" },
      LATER
    );

    expect(first).toMatchObject({
      moduleId: mod.id,
      title: "Hello",
      position: 1,
      content: null,
      videoUrl: null,
      durationMinutes: null,
      createdAt: NOW.toISOString(),
    });
    expect(second.position).toBe(2);
  });

  it("numbers each module's lessons on their own", () => {
    const intro = authoring.addModule(
      { courseId: base.course.id, title: "Intro" },
      NOW
    );
    const next = authoring.addModule(
      { courseId: base.course.id, title: "Next" },
      NOW
    );
    authoring.addLesson({ moduleId: intro.id, title: "Hello" }, NOW);
    authoring.addLesson({ moduleId: intro.id, title: "World" }, NOW);

    expect(
      authoring.addLesson({ moduleId: next.id, title: "Again" }, NOW).position
    ).toBe(1);
  });
});
