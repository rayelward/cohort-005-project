import * as schema from "../../app/db/schema";
import { LessonProgressStatus } from "../../app/db/schema";
import {
  daysAgo,
  makeRandom,
  type SeedDb,
  type User,
  type Course,
} from "./helpers";
import type { AddWatchSession } from "./progress";
import { seedTeamLicences } from "./team-licences";

// ─── Generated history ───
//
// Everything above is hand-written narrative data: a handful of students whose
// comments, quiz attempts and ratings are written one by one. Everything below
// is the bulk history the analytics work is evaluated against — roughly twelve
// months of purchases, enrolments, progress and watch events for the cohort.
//
// Generated from a fixed PRNG seed, so every run produces the same database and
// a number read off the dashboard can be checked against a number computed
// here.

// ─── Drop-off cliffs ───
//
// Progress is not spread evenly through a course. Each course has two lessons
// where a large share of students stop for good, and the analytics work is
// expected to surface exactly these lessons. They are, by lesson index
// (0-based, in course order):
//
//   Course 1 — Introduction to TypeScript
//     index 8  "Generics Basics"                 — first cliff
//     index 13 "Mapped Types"                    — second cliff
//
//   Course 2 — Building REST APIs with Node.js
//     index 5  "Custom Middleware"               — first cliff
//     index 11 "Transactions"                    — second cliff
//
//   Course 3 — Design Systems with Tailwind
//     index 3  "Variants and Composition"        — first cliff
//     index 6  "Documentation That Gets Read"    — second cliff
//
// Assert against the lessons, not against a drop-off percentage. Each enrolment
// rolls: 12% never start, 38% stop at the first cliff, 22% at the second, 13%
// finish, and the remaining 15% stop at a uniformly random lesson — so the
// cliffs stand out against a noisy background rather than being the only
// stopping points. Those are per-enrolment odds, not the share of students who
// reach a given lesson: because students who stop at the first cliff never
// reach the second, the observed drop-off at each cliff is much steeper than
// its roll.

type SellableCourse = {
  course: Course;
  lessonIds: number[];
  // [bigCliffIndex, secondCliffIndex] — the lesson a stopping student last
  // completed.
  cliffs: [number, number];
};

type History = {
  db: SeedDb;
  // One PRNG for the whole history: the order of its calls is part of the
  // fixture, so keep it.
  random: () => number;
  addWatchSession: AddWatchSession;
  lessonDurationSeconds: Map<number, number>;
  sellableCourses: SellableCourse[];
  sold: Set<string>;
  counts: { purchases: number; enrollments: number; progressRows: number };
};

type SeedHistoryDeps = {
  addWatchSession: AddWatchSession;
  cohort: User[];
  course1: Course;
  course1LessonIds: number[];
  course2: Course;
  course2LessonIds: number[];
  course3: Course;
  course3LessonIds: number[];
  db: SeedDb;
  studentByEmail: (email: string) => User;
};

const fullPriceCountries = ["US", "GB", "DE", "CA", "AU", "NL"];
const pppCountries = ["IN", "BR", "PH", "NG", "ID", "VN"];

// The last lesson the student completes, or null if they bought it and never
// opened it.
function pickStopIndex(random: () => number, target: SellableCourse) {
  const { lessonIds, cliffs } = target;
  const roll = random();

  if (roll < 0.12) return null;
  if (roll < 0.5) return cliffs[0];
  if (roll < 0.72) return cliffs[1];
  if (roll < 0.85) return lessonIds.length - 1;
  return Math.floor(random() * lessonIds.length);
}

type Walk = {
  userId: number;
  lessonIds: number[];
  stopIndex: number;
  startedDaysAgo: number;
};

function completeLessons(history: History, walk: Walk) {
  const { db, addWatchSession, lessonDurationSeconds } = history;
  const { userId, lessonIds, stopIndex, startedDaysAgo } = walk;
  // Progress is made over the days following the purchase, and never in the
  // future.
  const daySpan = Math.min(startedDaysAgo, 30);

  for (let li = 0; li <= stopIndex; li++) {
    const completedDaysAgo = Math.max(
      0,
      Math.round(startedDaysAgo - (daySpan * li) / lessonIds.length)
    );
    db.insert(schema.lessonProgress)
      .values({
        userId,
        lessonId: lessonIds[li],
        status: LessonProgressStatus.Completed,
        completedAt: daysAgo(completedDaysAgo),
      })
      .run();

    // The lesson they stopped on is left half-watched: a session that never
    // reached the end, heartbeats and all.
    if (li === stopIndex) {
      const duration = lessonDurationSeconds.get(lessonIds[li]) ?? 600;
      addWatchSession({
        userId,
        lessonId: lessonIds[li],
        from: 0,
        to: duration,
        videoDurationSeconds: duration,
        startHoursAgo: completedDaysAgo * 24 + 1,
      });
    }
  }

  return stopIndex + 1;
}

function leaveNextLessonInProgress(history: History, walk: Walk) {
  const { db, random, addWatchSession, lessonDurationSeconds } = history;
  const { userId, lessonIds, stopIndex, startedDaysAgo } = walk;
  if (stopIndex >= lessonIds.length - 1) return 0;

  const nextLessonId = lessonIds[stopIndex + 1];
  db.insert(schema.lessonProgress)
    .values({
      userId,
      lessonId: nextLessonId,
      status: LessonProgressStatus.InProgress,
    })
    .run();

  const duration = lessonDurationSeconds.get(nextLessonId) ?? 600;
  const abandonedAt = Math.round(duration * (0.1 + random() * 0.5));
  addWatchSession({
    userId,
    lessonId: nextLessonId,
    from: 0,
    to: abandonedAt,
    videoDurationSeconds: duration,
    startHoursAgo: Math.max(1, Math.round(startedDaysAgo * 24 * 0.4)),
  });
  return 1;
}

// Walks a student through a course as far as they got, leaving the lesson
// after their last completed one in progress. Returns the number of rows
// written.
function generateProgress(
  history: History,
  start: { userId: number; target: SellableCourse; startedDaysAgo: number }
): number {
  const stopIndex = pickStopIndex(history.random, start.target);
  if (stopIndex === null) return 0;

  const walk = {
    userId: start.userId,
    lessonIds: start.target.lessonIds,
    stopIndex,
    startedDaysAgo: start.startedDaysAgo,
  };
  return (
    completeLessons(history, walk) + leaveNextLessonInProgress(history, walk)
  );
}

// Two in five buy at a parity-adjusted price.
function pickCountryAndPrice(random: () => number, course: Course) {
  const ppp = random() < 0.4;
  const country = ppp
    ? pppCountries[Math.floor(random() * pppCountries.length)]
    : fullPriceCountries[Math.floor(random() * fullPriceCountries.length)];
  const amountPaid = ppp
    ? Math.round((course.price * 0.5) / 100) * 100
    : course.price;
  return { country, amountPaid };
}

function pickCourse(history: History, buyer: User, purchasedDaysAgo: number) {
  const { random, sellableCourses, sold } = history;
  const purchasedAt = Date.parse(daysAgo(purchasedDaysAgo));

  const available = sellableCourses.filter(
    (c) =>
      Date.parse(c.course.createdAt) <= purchasedAt &&
      !sold.has(`${buyer.id}:${c.course.id}`)
  );

  if (available.length === 0) return null;

  const target = available[Math.floor(random() * available.length)];
  sold.add(`${buyer.id}:${target.course.id}`);
  return target;
}

// A student buys, enrols, and works through the course as far as they get.
// Returns false if there was nothing they could have bought on that day — a
// course cannot be sold before it was created, and nobody buys twice.
function buyCourse(
  history: History,
  buyer: User,
  purchasedDaysAgo: number
): boolean {
  const { db, counts } = history;
  const target = pickCourse(history, buyer, purchasedDaysAgo);
  if (!target) return false;

  const { country, amountPaid } = pickCountryAndPrice(
    history.random,
    target.course
  );

  db.insert(schema.purchases)
    .values({
      userId: buyer.id,
      courseId: target.course.id,
      amountPaid,
      country,
      createdAt: daysAgo(purchasedDaysAgo),
    })
    .run();
  counts.purchases++;

  db.insert(schema.enrollments)
    .values({
      userId: buyer.id,
      courseId: target.course.id,
      enrolledAt: daysAgo(purchasedDaysAgo),
    })
    .run();
  counts.enrollments++;

  counts.progressRows += generateProgress(history, {
    userId: buyer.id,
    target,
    startedDaysAgo: purchasedDaysAgo,
  });

  return true;
}

const signupDaysAgo = (student: User) =>
  Math.round((Date.now() - Date.parse(student.createdAt)) / 86_400_000);

function createHistory(deps: SeedHistoryDeps): History {
  const { db } = deps;
  const lessonDurationSeconds = new Map(
    db
      .select({
        id: schema.lessons.id,
        durationMinutes: schema.lessons.durationMinutes,
      })
      .from(schema.lessons)
      .all()
      .map((l) => [l.id, (l.durationMinutes ?? 10) * 60] as const)
  );

  return {
    db,
    random: makeRandom(20260731),
    addWatchSession: deps.addWatchSession,
    lessonDurationSeconds,
    sellableCourses: [
      {
        course: deps.course1,
        lessonIds: deps.course1LessonIds,
        cliffs: [8, 13],
      },
      {
        course: deps.course2,
        lessonIds: deps.course2LessonIds,
        cliffs: [5, 11],
      },
      {
        course: deps.course3,
        lessonIds: deps.course3LessonIds,
        cliffs: [3, 6],
      },
    ],
    sold: new Set<string>(),
    counts: { purchases: 0, enrollments: 0, progressRows: 0 },
  };
}

function generateCohortPurchases(history: History, cohort: User[]) {
  const { random } = history;

  // Purchases hang off sign-up dates, which already span the year: everyone buys
  // something within days of joining, and about two in five come back for a
  // second course a few months later.
  for (const buyer of cohort) {
    const joined = signupDaysAgo(buyer);

    buyCourse(history, buyer, Math.max(0, joined - Math.floor(random() * 4)));

    if (random() < 0.42) {
      buyCourse(
        history,
        buyer,
        Math.max(1, joined - 90 - Math.floor(random() * 20))
      );
    }
  }

  // Launch week: a burst of sales from long-standing students inside the last
  // seven days, so the short date ranges are never empty and never identical to
  // the long ones.
  const launchWeekDays = [7, 6, 5, 3, 2, 1];
  const longStanding = cohort.filter((s) => signupDaysAgo(s) > 60);

  for (let i = 0; i < launchWeekDays.length; i++) {
    buyCourse(
      history,
      longStanding[i % longStanding.length],
      launchWeekDays[i]
    );
  }
}

export function seedHistory(deps: SeedHistoryDeps) {
  const history = createHistory(deps);
  generateCohortPurchases(history, deps.cohort);

  const { counts } = history;
  console.log(
    `Created ${counts.purchases} generated purchases, ${counts.enrollments} enrolments and ${counts.progressRows} lesson progress rows.`
  );

  return seedTeamLicences(deps);
}
