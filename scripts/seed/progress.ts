import * as schema from "../../app/db/schema";
import { LessonProgressStatus } from "../../app/db/schema";
import {
  daysAgo,
  hoursAgo,
  type SeedDb,
  type CountRows,
  type User,
  type Quiz,
  type QuizOptionIds,
} from "./helpers";

type SeedProgressDeps = {
  countRows: CountRows;
  course1LessonIds: number[];
  course2LessonIds: number[];
  db: SeedDb;
  quiz1: Quiz;
  quiz1OptionIds: QuizOptionIds;
  quiz2: Quiz;
  quiz2OptionIds: QuizOptionIds;
  quiz3: Quiz;
  quiz3OptionIds: QuizOptionIds;
  students: User[];
};

type QuizWithOptions = { quiz: Quiz; optionIds: QuizOptionIds };

function markComplete(
  db: SeedDb,
  {
    userId,
    lessonId,
    daysAgoCompleted,
  }: { userId: number; lessonId: number; daysAgoCompleted: number }
) {
  db.insert(schema.lessonProgress)
    .values({
      userId,
      lessonId,
      status: LessonProgressStatus.Completed,
      completedAt: daysAgo(daysAgoCompleted),
    })
    .run();
}

function markInProgress(db: SeedDb, userId: number, lessonId: number) {
  db.insert(schema.lessonProgress)
    .values({
      userId,
      lessonId,
      status: LessonProgressStatus.InProgress,
    })
    .run();
}

// Completes the first `count` lessons, one a day, ending `startDaysAgo - count + 1`
// days ago.
function completeFirst(
  db: SeedDb,
  {
    userId,
    lessonIds,
    count,
    startDaysAgo,
  }: {
    userId: number;
    lessonIds: number[];
    count: number;
    startDaysAgo: number;
  }
) {
  for (let i = 0; i < count; i++) {
    markComplete(db, {
      userId,
      lessonId: lessonIds[i],
      daysAgoCompleted: startDaysAgo - i,
    });
  }
}

function pickOption(
  optionIds: QuizOptionIds,
  questionId: number,
  wantCorrect: boolean
) {
  const selectedOption = optionIds.find(
    (o) => o.questionId === questionId && o.correct === wantCorrect
  );
  if (!selectedOption) {
    throw new Error(
      `Question ${questionId} has no ${wantCorrect ? "correct" : "wrong"} option`
    );
  }
  return selectedOption.optionId;
}

function seedEarlyLearnersProgress({
  course1LessonIds,
  course2LessonIds,
  db,
  students,
}: SeedProgressDeps) {
  // ─── Lesson Progress ───

  const emma = students[0].id;
  const james = students[1].id;
  const c1 = course1LessonIds;
  const c2 = course2LessonIds;

  // Emma (students[0]) — nearly complete in course 1 (17 of 19 lessons done)
  completeFirst(db, {
    userId: emma,
    lessonIds: c1,
    count: 17,
    startDaysAgo: 50,
  });
  markInProgress(db, emma, c1[17]);

  // Emma — mid-way through course 2 (10 of 20 lessons done)
  completeFirst(db, {
    userId: emma,
    lessonIds: c2,
    count: 10,
    startDaysAgo: 40,
  });
  markInProgress(db, emma, c2[10]);

  // James (students[1]) — completed all of course 1
  completeFirst(db, {
    userId: james,
    lessonIds: c1,
    count: c1.length,
    startDaysAgo: 45,
  });
}

function seedLaterLearnersProgress({
  course1LessonIds,
  course2LessonIds,
  db,
  students,
}: SeedProgressDeps) {
  const olivia = students[2].id;
  const liam = students[3].id;
  const sophia = students[4].id;
  const c1 = course1LessonIds;
  const c2 = course2LessonIds;

  // Olivia (students[2]) — just started course 1 (3 lessons done)
  completeFirst(db, {
    userId: olivia,
    lessonIds: c1,
    count: 3,
    startDaysAgo: 30,
  });
  markInProgress(db, olivia, c1[3]);

  // Olivia — mid-way through course 2 (8 lessons done)
  completeFirst(db, {
    userId: olivia,
    lessonIds: c2,
    count: 8,
    startDaysAgo: 28,
  });

  // Liam (students[3]) — just started course 2, abandoned (2 lessons done)
  completeFirst(db, {
    userId: liam,
    lessonIds: c2,
    count: 2,
    startDaysAgo: 22,
  });

  // Sophia (students[4]) — barely started course 1 (1 lesson done)
  completeFirst(db, {
    userId: sophia,
    lessonIds: c1,
    count: 1,
    startDaysAgo: 12,
  });
  markInProgress(db, sophia, c1[1]);
}

function seedLessonProgress(deps: SeedProgressDeps) {
  seedEarlyLearnersProgress(deps);
  seedLaterLearnersProgress(deps);

  console.log(
    `Created ${deps.countRows(schema.lessonProgress)} lesson progress records.`
  );
}

// Records a quiz attempt with answers. `correct` lists which questions
// (0-based) the student got right.
function recordQuizAttempt(
  db: SeedDb,
  {
    student,
    quiz,
    correct: selectedCorrectIndices,
    daysAgo: attemptDaysAgo,
  }: {
    student: User;
    quiz: QuizWithOptions;
    correct: number[];
    daysAgo: number;
  }
) {
  const userId = student.id;
  const quizId = quiz.quiz.id;
  const optionIds = quiz.optionIds;
  const totalQuestions = new Set(optionIds.map((o) => o.questionId)).size;
  const correctCount = selectedCorrectIndices.length;
  const score = correctCount / totalQuestions;

  // Determine passing based on quiz passingScore (we'll just use 0.7 as default)
  const passed = score >= 0.7;

  const [attempt] = db
    .insert(schema.quizAttempts)
    .values({
      userId,
      quizId,
      score,
      passed,
      attemptedAt: daysAgo(attemptDaysAgo),
    })
    .returning()
    .all();

  // Build answer selections
  const questionIds = [...new Set(optionIds.map((o) => o.questionId))];
  for (let qi = 0; qi < questionIds.length; qi++) {
    const qId = questionIds[qi];
    // Pick a correct answer for the questions answered correctly, a wrong
    // one for the rest
    const wantCorrect = selectedCorrectIndices.includes(qi);

    db.insert(schema.quizAnswers)
      .values({
        attemptId: attempt.id,
        questionId: qId,
        selectedOptionId: pickOption(optionIds, qId, wantCorrect),
      })
      .run();
  }
}

function seedQuizAttempts({
  countRows,
  db,
  quiz1,
  quiz1OptionIds,
  quiz2,
  quiz2OptionIds,
  quiz3,
  quiz3OptionIds,
  students,
}: SeedProgressDeps) {
  // ─── Quiz Attempts ───

  const q1 = { quiz: quiz1, optionIds: quiz1OptionIds };
  const q2 = { quiz: quiz2, optionIds: quiz2OptionIds };
  const q3 = { quiz: quiz3, optionIds: quiz3OptionIds };

  const attempts = [
    // Emma — passed quiz 1 (3/3 correct)
    { student: students[0], quiz: q1, correct: [0, 1, 2], daysAgo: 35 },
    // Emma — passed quiz 2 (2/2 correct)
    { student: students[0], quiz: q2, correct: [0, 1], daysAgo: 30 },
    // Emma — passed quiz 3 (2/3 correct, just barely at 67% with 70% passing = fail, then retake)
    { student: students[0], quiz: q3, correct: [0, 2], daysAgo: 28 },
    // Retake — all correct
    { student: students[0], quiz: q3, correct: [0, 1, 2], daysAgo: 27 },
    // James — passed quiz 1 (3/3 correct)
    { student: students[1], quiz: q1, correct: [0, 1, 2], daysAgo: 40 },
    // James — passed quiz 2 (2/2 correct)
    { student: students[1], quiz: q2, correct: [0, 1], daysAgo: 35 },
    // Olivia — failed quiz 1 first attempt (1/3 correct), then passed on retry (3/3)
    { student: students[2], quiz: q1, correct: [0], daysAgo: 25 },
    { student: students[2], quiz: q1, correct: [0, 1, 2], daysAgo: 24 },
    // Olivia — passed quiz 3 (3/3 correct)
    { student: students[2], quiz: q3, correct: [0, 1, 2], daysAgo: 20 },
    // Sophia — failed quiz 1 (1/3 correct, hasn't retaken yet)
    { student: students[4], quiz: q1, correct: [1], daysAgo: 10 },
  ];
  for (const attempt of attempts) recordQuizAttempt(db, attempt);

  console.log(
    `Created ${countRows(schema.quizAttempts)} quiz attempts and ${countRows(schema.quizAnswers)} answers.`
  );
}

// ─── Video Watch Events ───
//
// The only event types the player emits are `play`, `pause`, `ended` and
// `progress` — see app/components/youtube-player.tsx. `progress` is the
// heartbeat it posts every 10 seconds while the video is playing, so in real
// data it outnumbers every other type by an order of magnitude. Seed nothing
// the player cannot produce, and never a watch session without heartbeats.

const HEARTBEAT_INTERVAL_SECONDS = 10;

type WatchEventRow = typeof schema.videoWatchEvents.$inferInsert;

export type WatchSession = {
  userId: number;
  lessonId: number;
  from: number;
  to: number;
  videoDurationSeconds: number;
  startHoursAgo: number;
};

export type AddWatchSession = (session: WatchSession) => void;

// One watch session: `play`, a `progress` heartbeat every 10 seconds of
// playback, then `ended` if they reached the end or `pause` if they stopped
// short. Clock time advances with playback position, as it does in real life.
function watchSessionRows(session: WatchSession): WatchEventRow[] {
  const { userId, lessonId, from, to, videoDurationSeconds, startHoursAgo } =
    session;
  // Clock time runs backwards from startHoursAgo as playback advances.
  const event = (eventType: string, positionSeconds: number) => ({
    userId,
    lessonId,
    eventType,
    positionSeconds,
    createdAt: hoursAgo(startHoursAgo - (positionSeconds - from) / 3600),
  });

  const rows = [event("play", from)];
  for (
    let pos = from + HEARTBEAT_INTERVAL_SECONDS;
    pos < to;
    pos += HEARTBEAT_INTERVAL_SECONDS
  ) {
    rows.push(event("progress", pos));
  }

  const reachedEnd = to >= videoDurationSeconds;
  rows.push(event(reachedEnd ? "ended" : "pause", to));
  return rows;
}

function seedWatchSessions(
  addWatchSession: AddWatchSession,
  { course1LessonIds, course2LessonIds, students }: SeedProgressDeps
) {
  // Emma watched course 1 lesson 1 (8 min video) in two sittings.
  const lesson1 = { lessonId: course1LessonIds[0], videoDurationSeconds: 480 };
  const emma = { ...lesson1, userId: students[0].id };
  addWatchSession({ ...emma, from: 0, to: 180, startHoursAgo: 50 * 24 });
  addWatchSession({ ...emma, from: 180, to: 480, startHoursAgo: 49 * 24 });

  // James watched it straight through.
  const james = { ...lesson1, userId: students[1].id };
  addWatchSession({ ...james, from: 0, to: 480, startHoursAgo: 45 * 24 });

  // Liam started course 2 lesson 1 and gave up six minutes in.
  const liam = {
    lessonId: course2LessonIds[0],
    videoDurationSeconds: 600,
    userId: students[3].id,
  };
  addWatchSession({ ...liam, from: 0, to: 300, startHoursAgo: 22 * 24 });
  addWatchSession({ ...liam, from: 300, to: 360, startHoursAgo: 21 * 24 });
}

export function seedProgress(deps: SeedProgressDeps) {
  seedLessonProgress(deps);
  seedQuizAttempts(deps);

  const watchEventRows: WatchEventRow[] = [];
  const addWatchSession: AddWatchSession = (session) => {
    watchEventRows.push(...watchSessionRows(session));
  };
  seedWatchSessions(addWatchSession, deps);

  return { addWatchSession, watchEventRows };
}
