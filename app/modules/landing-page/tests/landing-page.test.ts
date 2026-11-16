import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { CourseStatus } from "~/db/schema";
import { createCourseAuthoring } from "~/modules/course-authoring/index.server";
import { createLandingPage, FEATURED_COURSE_LIMIT } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let authoring: ReturnType<typeof createCourseAuthoring>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  authoring = createCourseAuthoring(db);
});

// ─── Fixtures ───

let slugCounter = 0;

function addCourse(
  title: string,
  createdAt: string,
  options: { status?: CourseStatus; instructorId?: number } = {}
) {
  slugCounter += 1;
  const now = new Date(createdAt);
  const course = authoring.createCourse(
    {
      title,
      slug: `course-${slugCounter}`,
      description: `About ${title}`,
      salesCopy: title,
      instructorId: options.instructorId ?? base.instructor.id,
      categoryId: base.category.id,
      coverImageUrl: null,
    },
    now
  );
  const status = options.status ?? CourseStatus.Published;
  if (status !== CourseStatus.Draft) {
    authoring.setCourseStatus({ courseId: course.id, status }, now);
  }
  return course;
}

function addLessons(courseId: number, perModule: number[]) {
  const now = new Date("2026-05-01T00:00:00.000Z");
  perModule.forEach((count, index) => {
    const mod = authoring.addModule(
      { courseId, title: `Module ${index + 1}` },
      now
    );
    for (let i = 0; i < count; i++) {
      authoring.addLesson({ moduleId: mod.id, title: `Lesson ${i + 1}` }, now);
    }
  });
}
const page = () => createLandingPage(db).get();

describe("featured courses", () => {
  it("lists the newest published courses first, up to the limit", () => {
    // Later than the base course, which is created at the real "now".
    addCourse("Oldest", "2999-01-01T00:00:00.000Z");
    addCourse("Newest", "2999-04-01T00:00:00.000Z");
    addCourse("Middle", "2999-02-01T00:00:00.000Z");
    addCourse("Newer", "2999-03-01T00:00:00.000Z");

    const titles = page().featuredCourses.map((c) => c.title);

    expect(FEATURED_COURSE_LIMIT).toBe(3);
    expect(titles).toEqual(["Newest", "Newer", "Middle"]);
  });

  it("leaves out draft and archived courses", () => {
    addCourse("Draft", "2026-05-01T00:00:00.000Z", {
      status: CourseStatus.Draft,
    });
    addCourse("Archived", "2026-05-02T00:00:00.000Z", {
      status: CourseStatus.Archived,
    });

    const titles = page().featuredCourses.map((c) => c.title);

    expect(titles).toEqual(["Test Course"]);
  });

  it("counts every lesson across a course's modules", () => {
    const course = addCourse("Deep", "2026-05-01T00:00:00.000Z");
    addLessons(course.id, [2, 3]);

    const featured = page().featuredCourses.find((c) => c.id === course.id);

    expect(featured?.lessonCount).toBe(5);
  });

  it("counts zero lessons for a course with no modules", () => {
    expect(page().featuredCourses[0].lessonCount).toBe(0);
  });

  it("carries the instructor and category a card shows", () => {
    expect(page().featuredCourses[0]).toEqual({
      id: base.course.id,
      title: "Test Course",
      slug: "test-course",
      description: "A test course",
      instructorName: "Test Instructor",
      categoryName: "Programming",
      categorySlug: "programming",
      lessonCount: 0,
    });
  });
});

describe("stats", () => {
  it("totals published courses, their lessons and their instructors", () => {
    // "Instructors" counts the distinct authors of published courses, and no
    // module creates users, so the seeded second user is the other author.
    const second = addCourse("Second", "2026-05-01T00:00:00.000Z", {
      instructorId: base.user.id,
    });
    const third = addCourse("Third", "2026-05-02T00:00:00.000Z");
    addLessons(base.course.id, [1]);
    addLessons(second.id, [2, 2]);
    addLessons(third.id, [3]);

    expect(page().stats).toEqual({ courses: 3, lessons: 8, instructors: 2 });
  });

  it("leaves unpublished courses and their lessons out of every total", () => {
    const draft = addCourse("Draft", "2026-05-01T00:00:00.000Z", {
      status: CourseStatus.Draft,
      instructorId: base.user.id,
    });
    addLessons(draft.id, [4]);

    expect(page().stats).toEqual({ courses: 1, lessons: 0, instructors: 1 });
  });

  it("is all zeros when nothing is published", () => {
    authoring.setCourseStatus(
      { courseId: base.course.id, status: CourseStatus.Draft },
      new Date("2026-05-01T00:00:00.000Z")
    );

    expect(page()).toEqual({
      featuredCourses: [],
      stats: { courses: 0, lessons: 0, instructors: 0 },
    });
  });
});
