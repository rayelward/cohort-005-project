import { describe, it, expect, beforeEach } from "vitest";
import { CourseStatus } from "~/db/schema";
import { createLandingPage } from "../index.server";
import { createCatalogue, type Catalogue } from "./fixtures";

let catalogue: Catalogue;

beforeEach(() => {
  catalogue = createCatalogue();
});

function landingPage() {
  return createLandingPage(catalogue.db).get();
}

describe("featured courses", () => {
  it("are the three newest published courses, newest first", () => {
    catalogue.setStatus(catalogue.base.course.id, CourseStatus.Draft);
    catalogue.addCourse({
      title: "Oldest",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    catalogue.addCourse({
      title: "Newest",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    catalogue.addCourse({
      title: "Middle",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    catalogue.addCourse({
      title: "Newer",
      createdAt: "2026-03-01T00:00:00.000Z",
    });

    expect(landingPage().featuredCourses.map((c) => c.title)).toEqual([
      "Newest",
      "Newer",
      "Middle",
    ]);
  });

  it("leave out draft and archived courses, however new", () => {
    catalogue.addCourse({
      title: "Draft",
      createdAt: "2026-05-01T00:00:00.000Z",
      status: CourseStatus.Draft,
    });
    catalogue.addCourse({
      title: "Archived",
      createdAt: "2026-05-02T00:00:00.000Z",
      status: CourseStatus.Archived,
    });

    expect(landingPage().featuredCourses.map((c) => c.title)).toEqual([
      "Test Course",
    ]);
  });

  it("carry what a course card shows", () => {
    const instructor = catalogue.addInstructor("Ada Lovelace");
    const category = catalogue.addCategory("Design");
    const course = catalogue.addCourse({
      title: "Tokens",
      createdAt: "2099-01-01T00:00:00.000Z",
      instructorId: instructor.id,
      categoryId: category.id,
    });

    expect(landingPage().featuredCourses[0]).toEqual({
      id: course.id,
      title: "Tokens",
      slug: course.slug,
      description: "About Tokens",
      coverImageUrl: course.coverImageUrl,
      instructorName: "Ada Lovelace",
      categoryName: "Design",
      lessonCount: 0,
    });
  });

  it("count every lesson across a course's modules", () => {
    const course = catalogue.addCourse({
      title: "Counted",
      createdAt: "2099-01-01T00:00:00.000Z",
    });
    catalogue.addLessons(course.id, [3, 2]);
    catalogue.addLessons(catalogue.base.course.id, [4]);

    const counts = Object.fromEntries(
      landingPage().featuredCourses.map((c) => [c.title, c.lessonCount])
    );
    expect(counts).toEqual({ Counted: 5, "Test Course": 4 });
  });

  it("are empty when nothing is published", () => {
    catalogue.setStatus(catalogue.base.course.id, CourseStatus.Draft);

    expect(landingPage().featuredCourses).toEqual([]);
  });
});

describe("catalogue stats", () => {
  it("count only published courses", () => {
    catalogue.addCourse({
      title: "Live",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    catalogue.addCourse({
      title: "Draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      status: CourseStatus.Draft,
    });
    catalogue.addCourse({
      title: "Archived",
      createdAt: "2026-01-01T00:00:00.000Z",
      status: CourseStatus.Archived,
    });

    expect(landingPage().stats.courses).toBe(2);
  });

  it("count every course, not only the featured three", () => {
    for (let i = 1; i <= 4; i++) {
      catalogue.addCourse({
        title: `Course ${i}`,
        createdAt: `2026-0${i}-01T00:00:00.000Z`,
      });
    }

    expect(landingPage().stats.courses).toBe(5);
  });

  it("count lessons in published courses only", () => {
    const draft = catalogue.addCourse({
      title: "Draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      status: CourseStatus.Draft,
    });
    catalogue.addLessons(catalogue.base.course.id, [2, 3]);
    catalogue.addLessons(draft.id, [7]);

    expect(landingPage().stats.lessons).toBe(5);
  });

  it("count each instructor with a published course once", () => {
    const ada = catalogue.addInstructor("Ada Lovelace");
    catalogue.addInstructor("Idle Instructor");
    const drafter = catalogue.addInstructor("Only Drafts");
    catalogue.addCourse({
      title: "Ada 1",
      createdAt: "2026-01-01T00:00:00.000Z",
      instructorId: ada.id,
    });
    catalogue.addCourse({
      title: "Ada 2",
      createdAt: "2026-01-02T00:00:00.000Z",
      instructorId: ada.id,
    });
    catalogue.addCourse({
      title: "Drafted",
      createdAt: "2026-01-03T00:00:00.000Z",
      instructorId: drafter.id,
      status: CourseStatus.Draft,
    });

    expect(landingPage().stats.instructors).toBe(2);
  });

  it("are zero when nothing is published", () => {
    catalogue.addLessons(catalogue.base.course.id, [3]);
    catalogue.setStatus(catalogue.base.course.id, CourseStatus.Draft);

    expect(landingPage().stats).toEqual({
      courses: 0,
      lessons: 0,
      instructors: 0,
    });
  });
});
