import type { SQL } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type * as schema from "../../app/db/schema";

export type SeedDb = BetterSQLite3Database<typeof schema>;

export type CountRows = (table: SQLiteTable, where?: SQL) => number;

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Deterministic PRNG (mulberry32). The generated history below is a fixture that
// later work asserts against, so it must be identical on every run.
export function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type User = typeof schema.users.$inferSelect;
export type Course = typeof schema.courses.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;
export type Quiz = typeof schema.quizzes.$inferSelect;
export type QuizOptionIds = {
  questionId: number;
  optionId: number;
  correct: boolean;
}[];
