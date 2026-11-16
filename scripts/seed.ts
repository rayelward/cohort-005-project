import Database from "better-sqlite3";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "../app/db/schema";
import { existsSync } from "fs";
import { defaultNotifications } from "../app/lib/notifications.server";
import { syncAllUsers } from "../app/lib/notification-preferences.server";
import { seedUsers } from "./seed/users";
import { seedTypescriptCourse } from "./seed/course-typescript";
import { seedNodeCourse } from "./seed/course-nodejs";
import { seedMoreCourses } from "./seed/more-courses";
import { seedQuizzes } from "./seed/quizzes";
import { seedEngagement } from "./seed/engagement";
import { seedProgress } from "./seed/progress";
import { seedPurchasesAndTeams } from "./seed/purchases";
import { seedHistory } from "./seed/history";
import { seedRefunds } from "./seed/refunds";
import { printSummary } from "./seed/summary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, "../drizzle");

// Runs under tsx, not Vite, so load .env for the Knock keys ourselves.
const envFile = path.resolve(__dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

// ─── Seed Data ───

async function seed() {
  console.log("Seeding database...");

  // Drop and recreate tables for a clean seed
  sqlite.exec(`
    DROP TABLE IF EXISTS bookmarks;
    DROP TABLE IF EXISTS notes;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS course_ratings;
    DROP TABLE IF EXISTS video_watch_events;
    DROP TABLE IF EXISTS quiz_answers;
    DROP TABLE IF EXISTS quiz_attempts;
    DROP TABLE IF EXISTS quiz_options;
    DROP TABLE IF EXISTS quiz_questions;
    DROP TABLE IF EXISTS quizzes;
    DROP TABLE IF EXISTS lesson_progress;
    DROP TABLE IF EXISTS coupons;
    DROP TABLE IF EXISTS team_members;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS refunds;
    DROP TABLE IF EXISTS purchases;
    DROP TABLE IF EXISTS enrollments;
    DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS modules;
    DROP TABLE IF EXISTS courses;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS __drizzle_migrations;
  `);

  // Create tables using the same Drizzle migrations as the live database
  migrate(db, { migrationsFolder });

  console.log("Tables created.");

  // Every count this script reports is read back out of the database. A written
  // -down count is a count that goes stale the first time the data around it
  // changes.
  function countRows(table: SQLiteTable, where?: SQL) {
    const query = db.select({ count: sql<number>`count(*)` }).from(table);
    return (where ? query.where(where) : query).get()?.count ?? 0;
  }

  const {
    admin,
    instructor1,
    instructor2,
    students,
    bossy,
    cohort,
    studentByEmail,
  } = seedUsers({ db });

  // ─── Categories ───

  const categoriesData = db
    .insert(schema.categories)
    .values([
      { name: "Programming", slug: "programming" },
      { name: "Design", slug: "design" },
      { name: "Data Science", slug: "data-science" },
      { name: "DevOps", slug: "devops" },
      { name: "Marketing", slug: "marketing" },
    ])
    .returning()
    .all();

  const catBySlug = Object.fromEntries(categoriesData.map((c) => [c.slug, c]));

  console.log(`Created ${categoriesData.length} categories.`);

  const { course1, course1LessonIds } = seedTypescriptCourse({
    catBySlug,
    db,
    instructor1,
  });
  const { course2, course2LessonIds } = seedNodeCourse({
    catBySlug,
    db,
    instructor2,
  });
  const { course3, course3LessonIds } = seedMoreCourses({
    catBySlug,
    db,
    instructor1,
    instructor2,
  });
  const {
    quiz1,
    quiz1OptionIds,
    quiz2,
    quiz2OptionIds,
    quiz3,
    quiz3OptionIds,
  } = seedQuizzes({ countRows, course1LessonIds, course2LessonIds, db });
  seedEngagement({
    admin,
    countRows,
    course1,
    course1LessonIds,
    course2,
    course2LessonIds,
    db,
    instructor1,
    instructor2,
    students,
  });
  const { addWatchSession, watchEventRows } = seedProgress({
    countRows,
    course1LessonIds,
    course2LessonIds,
    db,
    quiz1,
    quiz1OptionIds,
    quiz2,
    quiz2OptionIds,
    quiz3,
    quiz3OptionIds,
    students,
  });
  seedPurchasesAndTeams({
    bossy,
    countRows,
    course1,
    course2,
    db,
    studentByEmail,
    students,
  });
  const { novakLicence } = seedHistory({
    addWatchSession,
    cohort,
    course1,
    course1LessonIds,
    course2,
    course2LessonIds,
    course3,
    course3LessonIds,
    db,
    studentByEmail,
  });
  seedRefunds({ course1, course1LessonIds, db, novakLicence, studentByEmail });
  // ─── Flush watch events ───
  // Batched: the heartbeat makes these by far the largest table, and one
  // statement per row would dominate the seed's runtime.

  const WATCH_EVENT_CHUNK = 400;
  for (let i = 0; i < watchEventRows.length; i += WATCH_EVENT_CHUNK) {
    db.insert(schema.videoWatchEvents)
      .values(watchEventRows.slice(i, i + WATCH_EVENT_CHUNK))
      .run();
  }

  console.log(`Created ${watchEventRows.length} video watch events.`);

  printSummary({ countRows, db });
  // ─── Sync users to Knock ───
  // Name, email, avatar, and default preferences for anyone without a set.
  if (process.env.KNOCK_SECRET_API_KEY) {
    const synced = await syncAllUsers(db, await defaultNotifications());
    console.log(`  Synced ${synced} users to Knock.`);
  } else {
    console.log("  Skipped Knock user sync: KNOCK_SECRET_API_KEY is not set.");
  }
}

seed().catch(console.error);
