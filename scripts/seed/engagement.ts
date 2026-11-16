import { isNull } from "drizzle-orm";
import * as schema from "../../app/db/schema";
import { markdown } from "../../app/lib/text";
import {
  daysAgo,
  type SeedDb,
  type CountRows,
  type User,
  type Course,
} from "./helpers";

type SeedEngagementDeps = {
  admin: User;
  countRows: CountRows;
  course1: Course;
  course1LessonIds: number[];
  course2: Course;
  course2LessonIds: number[];
  db: SeedDb;
  instructor1: User;
  instructor2: User;
  students: User[];
};

function comment(
  db: SeedDb,
  values: Omit<typeof schema.comments.$inferInsert, "body"> & { body: string }
) {
  const [row] = db
    .insert(schema.comments)
    .values({ ...values, body: markdown(values.body) })
    .returning()
    .all();
  return row;
}

function seedEnrollments({
  countRows,
  course1,
  course2,
  db,
  students,
}: SeedEngagementDeps) {
  // ─── Enrollments ───
  // Varied enrollment patterns:
  // - Emma: enrolled in both courses (nearly complete in course 1, mid-way in course 2)
  // - James: enrolled in course 1 only (completed)
  // - Olivia: enrolled in both courses (just started course 1, mid-way in course 2)
  // - Liam: enrolled in course 2 only (just started, abandoned)
  // - Sophia: enrolled in course 1 only (recently enrolled, barely started)

  db.insert(schema.enrollments)
    .values([
      { userId: students[0].id, courseId: course1.id, enrolledAt: daysAgo(50) },
      { userId: students[0].id, courseId: course2.id, enrolledAt: daysAgo(40) },
      {
        userId: students[1].id,
        courseId: course1.id,
        enrolledAt: daysAgo(45),
        completedAt: daysAgo(10),
      },
      { userId: students[2].id, courseId: course1.id, enrolledAt: daysAgo(35) },
      { userId: students[2].id, courseId: course2.id, enrolledAt: daysAgo(30) },
      { userId: students[3].id, courseId: course2.id, enrolledAt: daysAgo(25) },
      { userId: students[4].id, courseId: course1.id, enrolledAt: daysAgo(15) },
    ])
    .run();

  console.log(`Created ${countRows(schema.enrollments)} enrollments.`);
}

function seedRatings({
  countRows,
  course1,
  course2,
  db,
  students,
}: SeedEngagementDeps) {
  // ─── Course Ratings ───
  // Star ratings from enrolled students only. Not everyone rates.
  // Course 1 averages 4.3 (4 ratings), course 2 averages 4.5 (2 ratings).

  const ratings = [
    { student: students[0], course: course1, rating: 5, daysAgo: 20 },
    { student: students[1], course: course1, rating: 5, daysAgo: 9 },
    { student: students[2], course: course1, rating: 4, daysAgo: 18 },
    { student: students[4], course: course1, rating: 3, daysAgo: 5 },
    { student: students[0], course: course2, rating: 4, daysAgo: 12 },
    { student: students[3], course: course2, rating: 5, daysAgo: 8 },
  ];

  db.insert(schema.courseRatings)
    .values(
      ratings.map((r) => ({
        userId: r.student.id,
        courseId: r.course.id,
        rating: r.rating,
        createdAt: daysAgo(r.daysAgo),
        updatedAt: daysAgo(r.daysAgo),
      }))
    )
    .run();

  console.log(`Created ${countRows(schema.courseRatings)} course ratings.`);
}

function seedCourse1Questions({
  course1LessonIds,
  db,
  instructor1,
  students,
}: SeedEngagementDeps) {
  // ─── Lesson Comments ───
  // Covers every state the Q&A feature can be in, so the instructor queue and
  // the lesson thread both have something real to render: answered threads,
  // questions still waiting (two of them stale enough to flag), a question only
  // another student replied to (still unanswered), an edited comment, and a
  // deleted question kept as a tombstone because it has a reply.
  // Only enrolled students comment.

  // Answered: student asks, Sarah answers, student confirms.
  const c1q1 = comment(db, {
    lessonId: course1LessonIds[2],
    userId: students[0].id,
    body: "I'm getting `tsc: command not found` when I run the compile step. Did I miss an install somewhere?",
    createdAt: daysAgo(30),
  });
  comment(db, {
    lessonId: course1LessonIds[2],
    userId: instructor1.id,
    parentId: c1q1.id,
    body: "That usually means TypeScript is installed locally but not on your PATH. Two options:\n\n```bash\nnpx tsc --version\n```\n\nor install it globally with `npm i -g typescript`. I'd stick with `npx` — it keeps the version pinned to the project.",
    createdAt: daysAgo(29),
  });
  comment(db, {
    lessonId: course1LessonIds[2],
    userId: students[0].id,
    parentId: c1q1.id,
    body: "`npx` did it. Thank you!",
    createdAt: daysAgo(29),
  });

  // Waiting, and stale enough to flag amber in the queue.
  comment(db, {
    lessonId: course1LessonIds[7],
    userId: students[2].id,
    body: "Why does this fail to infer? I expected `T` to come out as `string`.\n\n```typescript\nfunction first<T>(items: T[]): T {\n  return items[0];\n}\n\nconst x = first([]);\n```",
    createdAt: daysAgo(6),
  });

  // Waiting, but posted today — should look calm in the queue.
  comment(db, {
    lessonId: course1LessonIds[4],
    userId: students[4].id,
    body: "Is there a reason to prefer `interface` over `type` here, or is it purely style?",
    createdAt: daysAgo(1),
  });
}

function seedCourse1LaterQuestions({
  course1LessonIds,
  db,
  instructor1,
  students,
}: SeedEngagementDeps) {
  // Another student replied, but no staff has — still counts as unanswered.
  const c1q4 = comment(db, {
    lessonId: course1LessonIds[3],
    userId: students[1].id,
    body: "Does strict mode change anything about how this example behaves?",
    createdAt: daysAgo(4),
  });
  comment(db, {
    lessonId: course1LessonIds[3],
    userId: students[0].id,
    parentId: c1q4.id,
    body: "I think it only affects the null checks, but I'd like a second opinion too.",
    createdAt: daysAgo(4),
  });

  // Edited by its author — renders an "(edited)" marker.
  const c1q5 = comment(db, {
    lessonId: course1LessonIds[0],
    userId: students[1].id,
    body: "Coming from JavaScript, how much of this will feel familiar? (Edited to add: I've used JSDoc types before.)",
    createdAt: daysAgo(40),
    editedAt: daysAgo(39),
  });
  comment(db, {
    lessonId: course1LessonIds[0],
    userId: instructor1.id,
    parentId: c1q5.id,
    body: "Most of it. If you've written JSDoc types you already understand the mental model — the syntax is just less noisy.",
    createdAt: daysAgo(39),
  });

  // Deleted question that keeps its reply — renders as a tombstone.
  const c1q6 = comment(db, {
    lessonId: course1LessonIds[1],
    userId: students[4].id,
    body: "Posted this on the wrong lesson, sorry!",
    createdAt: daysAgo(12),
    deletedAt: daysAgo(12),
  });
  comment(db, {
    lessonId: course1LessonIds[1],
    userId: instructor1.id,
    parentId: c1q6.id,
    body: "No problem at all — asked and answered over on the generics lesson.",
    createdAt: daysAgo(12),
  });
}

function seedCourse2Questions({
  admin,
  countRows,
  course2LessonIds,
  db,
  instructor2,
  students,
}: SeedEngagementDeps) {
  // Course 2: waiting a long time.
  comment(db, {
    lessonId: course2LessonIds[2],
    userId: students[3].id,
    body: "When would you return a 422 instead of a 400? The distinction still isn't clicking for me.",
    createdAt: daysAgo(9),
  });

  // Course 2: answered by an admin rather than the owning instructor.
  const c2q2 = comment(db, {
    lessonId: course2LessonIds[0],
    userId: students[2].id,
    body: "Are the example requests in this lesson hitting a real API, or is it all mocked?",
    createdAt: daysAgo(14),
  });
  comment(db, {
    lessonId: course2LessonIds[0],
    userId: admin.id,
    parentId: c2q2.id,
    body: "All mocked — nothing leaves your machine. The repo linked on the lesson has the fixtures.",
    createdAt: daysAgo(13),
  });

  // An instructor's own top-level post never queues up as work for themselves.
  comment(db, {
    lessonId: course2LessonIds[1],
    userId: instructor2.id,
    body: "Heads up: the status code table was updated this week to include 418. Refresh if you cached the old one.",
    createdAt: daysAgo(7),
  });

  console.log(
    `Created ${countRows(schema.comments)} lesson comments across ${countRows(schema.comments, isNull(schema.comments.parentId))} threads.`
  );
}

export function seedEngagement(deps: SeedEngagementDeps) {
  seedEnrollments(deps);
  seedRatings(deps);
  seedCourse1Questions(deps);
  seedCourse1LaterQuestions(deps);
  seedCourse2Questions(deps);
}
