import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { NOTE_MAX_LENGTH } from "~/lib/bookmarks-and-notes";
import { getNote, isBookmarked } from "~/lib/bookmarks-and-notes.server";

// The route reads `db` and the signed-in user from module scope; point both at
// test doubles.
const state = vi.hoisted(() => ({
  db: undefined as TestDb | undefined,
  userId: null as number | null,
}));

vi.mock("~/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        if (!state.db) throw new Error("test db not set");
        const value = Reflect.get(state.db, prop);
        return typeof value === "function" ? value.bind(state.db) : value;
      },
    }
  ),
}));

vi.mock("~/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => state.userId),
}));

vi.mock("~/lib/country.server", () => ({
  resolveCountry: vi.fn(async () => null),
}));

import { action } from "./courses.$slug.lessons.$lessonId";

type ActionArgs = Parameters<typeof action>[0];

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let lessonInOtherCourseId: number;

beforeEach(() => {
  db = createTestDb();
  state.db = db;
  base = seedBaseData(db);
  state.userId = base.user.id;

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;

  const otherCourse = db
    .insert(schema.courses)
    .values({
      title: "Other Course",
      slug: "other-course",
      description: "Another course",
      salesCopy: "Sales copy.",
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
  const otherModule = db
    .insert(schema.modules)
    .values({ courseId: otherCourse.id, title: "Elsewhere", position: 1 })
    .returning()
    .get();
  lessonInOtherCourseId = db
    .insert(schema.lessons)
    .values({ moduleId: otherModule.id, title: "Other lesson", position: 1 })
    .returning()
    .get().id;

  db.insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
});

function post(fields: Record<string, string>, targetLessonId = lessonId) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  const request = new Request(
    `http://localhost/courses/test-course/lessons/${targetLessonId}`,
    { method: "POST", body }
  );
  // The action only reads params and request; the rest of the route args are
  // framework plumbing.
  return action({
    request,
    params: { slug: "test-course", lessonId: String(targetLessonId) },
  } as unknown as ActionArgs);
}

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (thrown) {
    if (
      thrown &&
      typeof thrown === "object" &&
      "init" in thrown &&
      thrown.init &&
      typeof thrown.init === "object" &&
      "status" in thrown.init
    ) {
      return thrown.init.status;
    }
    throw thrown;
  }
  throw new Error("expected the action to throw");
}

describe("toggle-bookmark", () => {
  it("bookmarks the Lesson for an enrolled Student, then un-bookmarks it", async () => {
    expect(await post({ intent: "toggle-bookmark" })).toEqual({
      bookmarked: true,
    });
    expect(isBookmarked(db, base.user.id, lessonId)).toBe(true);

    expect(await post({ intent: "toggle-bookmark" })).toEqual({
      bookmarked: false,
    });
    expect(isBookmarked(db, base.user.id, lessonId)).toBe(false);
  });

  it("rejects a signed-out visitor with 401", async () => {
    state.userId = null;
    expect(await statusOf(post({ intent: "toggle-bookmark" }))).toBe(401);
  });

  it("rejects a Student who isn't enrolled with 403", async () => {
    db.delete(schema.enrollments).run();
    expect(await statusOf(post({ intent: "toggle-bookmark" }))).toBe(403);
  });

  it("rejects the course's Instructor with 403", async () => {
    state.userId = base.instructor.id;
    expect(await statusOf(post({ intent: "toggle-bookmark" }))).toBe(403);
  });

  it("rejects a Lesson from another course with 404", async () => {
    expect(
      await statusOf(post({ intent: "toggle-bookmark" }, lessonInOtherCourseId))
    ).toBe(404);
    expect(isBookmarked(db, base.user.id, lessonInOtherCourseId)).toBe(false);
  });

  it("rejects a Lesson that doesn't exist with 404", async () => {
    expect(await statusOf(post({ intent: "toggle-bookmark" }, 99999))).toBe(
      404
    );
  });
});

describe("save-note", () => {
  it("saves the Note, trimmed", async () => {
    expect(
      await post({ intent: "save-note", body: "  Rewatch 3:10  " })
    ).toEqual({ noteSaved: true });
    expect(getNote(db, base.user.id, lessonId)?.body).toBe("Rewatch 3:10");
  });

  it("deletes the Note when the box is cleared", async () => {
    await post({ intent: "save-note", body: "Draft" });
    await post({ intent: "save-note", body: "" });

    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });

  it(`rejects a Note over ${NOTE_MAX_LENGTH} characters with 400`, async () => {
    expect(
      await statusOf(
        post({ intent: "save-note", body: "x".repeat(NOTE_MAX_LENGTH + 1) })
      )
    ).toBe(400);
    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });

  it(`accepts a Note of exactly ${NOTE_MAX_LENGTH} characters`, async () => {
    await post({ intent: "save-note", body: "x".repeat(NOTE_MAX_LENGTH) });
    expect(getNote(db, base.user.id, lessonId)?.body).toHaveLength(
      NOTE_MAX_LENGTH
    );
  });

  it("rejects a Student who isn't enrolled with 403", async () => {
    db.delete(schema.enrollments).run();
    expect(await statusOf(post({ intent: "save-note", body: "Sneaky" }))).toBe(
      403
    );
  });

  it("rejects a Lesson from another course with 404", async () => {
    expect(
      await statusOf(
        post(
          { intent: "save-note", body: "Wrong place" },
          lessonInOtherCourseId
        )
      )
    ).toBe(404);
  });
});
