import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  saveNote,
  toggleBookmark,
} from "./bookmarks-and-notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const MONDAY = new Date("2026-11-09T12:00:00.000Z");
const TUESDAY = new Date("2026-11-10T12:00:00.000Z");

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let otherLessonId: number;
let otherStudentId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

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

  otherLessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 2", position: 2 })
    .returning()
    .get().id;

  otherStudentId = db
    .insert(schema.users)
    .values({
      name: "Other Student",
      email: "other@example.com",
      role: schema.UserRole.Student,
    })
    .returning()
    .get().id;
});

describe("toggling a Bookmark", () => {
  it("adds a Bookmark, then removes it on the second toggle", () => {
    expect(toggleBookmark(db, base.user.id, lessonId)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonId)).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonId)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonId)).toBe(false);
  });

  it("only touches the Student's own Bookmark", () => {
    toggleBookmark(db, otherStudentId, lessonId);

    expect(toggleBookmark(db, base.user.id, lessonId)).toBe(true);
    expect(toggleBookmark(db, base.user.id, lessonId)).toBe(false);
    expect(isBookmarked(db, otherStudentId, lessonId)).toBe(true);
  });
});

describe("saving a Note", () => {
  it("creates the Note with the body trimmed", () => {
    const note = saveNote(
      db,
      base.user.id,
      lessonId,
      "  Revisit this  ",
      MONDAY
    );

    expect(note).toMatchObject({
      userId: base.user.id,
      lessonId,
      body: "Revisit this",
      createdAt: MONDAY.toISOString(),
      updatedAt: MONDAY.toISOString(),
    });
  });

  it("updates the existing Note rather than adding a second one", () => {
    const first = saveNote(db, base.user.id, lessonId, "Draft", MONDAY);
    const second = saveNote(db, base.user.id, lessonId, "Final", TUESDAY);

    expect(second).toMatchObject({
      id: first?.id,
      body: "Final",
      createdAt: MONDAY.toISOString(),
      updatedAt: TUESDAY.toISOString(),
    });
    expect(db.select().from(schema.notes).all()).toHaveLength(1);
  });

  it("deletes the Note when the body is cleared", () => {
    saveNote(db, base.user.id, lessonId, "Draft", MONDAY);

    expect(saveNote(db, base.user.id, lessonId, "   ", TUESDAY)).toBeNull();
    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });

  it("leaves another Student's Note alone when clearing your own", () => {
    saveNote(db, otherStudentId, lessonId, "Theirs", MONDAY);
    saveNote(db, base.user.id, lessonId, "Mine", MONDAY);

    saveNote(db, base.user.id, lessonId, "", TUESDAY);

    expect(getNote(db, otherStudentId, lessonId)?.body).toBe("Theirs");
  });
});

describe("listing saved lessons", () => {
  it("lists only the Student's own Bookmarks, newest first, placed in their course", () => {
    toggleBookmark(db, base.user.id, lessonId);
    toggleBookmark(db, base.user.id, otherLessonId);
    toggleBookmark(db, otherStudentId, lessonId);

    const listed = listBookmarks(db, base.user.id);

    expect(listed.map((b) => b.lessonId)).toEqual([otherLessonId, lessonId]);
    expect(listed[0]).toMatchObject({
      lessonTitle: "Lesson 2",
      moduleTitle: "Basics",
      courseTitle: "Test Course",
      courseSlug: "test-course",
    });
  });

  it("lists only the Student's own Notes, most recently edited first", () => {
    saveNote(db, base.user.id, lessonId, "Older", MONDAY);
    saveNote(db, base.user.id, otherLessonId, "Newer", TUESDAY);
    saveNote(db, otherStudentId, lessonId, "Not mine", TUESDAY);

    expect(listNotes(db, base.user.id).map((n) => n.body)).toEqual([
      "Newer",
      "Older",
    ]);
  });
});

describe("deleting what a Bookmark or Note points at", () => {
  it("removes the Lesson's Bookmarks and Notes with it", () => {
    toggleBookmark(db, base.user.id, lessonId);
    saveNote(db, base.user.id, lessonId, "Gone soon", MONDAY);

    db.delete(schema.lessons).where(eq(schema.lessons.id, lessonId)).run();

    expect(db.select().from(schema.bookmarks).all()).toEqual([]);
    expect(db.select().from(schema.notes).all()).toEqual([]);
  });

  it("removes the Student's Bookmarks and Notes with them", () => {
    toggleBookmark(db, otherStudentId, lessonId);
    saveNote(db, otherStudentId, lessonId, "Gone soon", MONDAY);

    db.delete(schema.users).where(eq(schema.users.id, otherStudentId)).run();

    expect(db.select().from(schema.bookmarks).all()).toEqual([]);
    expect(db.select().from(schema.notes).all()).toEqual([]);
  });
});
