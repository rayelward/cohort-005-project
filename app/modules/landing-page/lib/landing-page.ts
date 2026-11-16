import { countDistinct, desc, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const FEATURED_COURSE_LIMIT = 3;

export type FeaturedCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  instructorName: string;
  categoryName: string;
  categorySlug: string;
  lessonCount: number;
};

export type LandingStats = {
  courses: number;
  lessons: number;
  instructors: number;
};

export type LandingPage = {
  featuredCourses: FeaturedCourse[];
  stats: LandingStats;
};

const { courses, users, categories, modules, lessons } = schema;
const isPublished = eq(courses.status, CourseStatus.Published);

function getFeaturedCourses(db: Db): FeaturedCourse[] {
  const lessonCounts = db
    .select({
      courseId: modules.courseId,
      lessonCount: sql<number>`count(${lessons.id})`.as("lesson_count"),
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId)
    .as("lesson_counts");

  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      instructorName: users.name,
      categoryName: categories.name,
      categorySlug: categories.slug,
      lessonCount: sql<number>`coalesce(${lessonCounts.lessonCount}, 0)`,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .leftJoin(lessonCounts, eq(lessonCounts.courseId, courses.id))
    .where(isPublished)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(FEATURED_COURSE_LIMIT)
    .all();
}

// An aggregate with no GROUP BY always returns exactly one row, even when
// nothing matches, so the destructured row is never missing.
function getStats(db: Db): LandingStats {
  const [totals] = db
    .select({
      courses: countDistinct(courses.id),
      lessons: countDistinct(lessons.id),
      instructors: countDistinct(courses.instructorId),
    })
    .from(courses)
    .leftJoin(modules, eq(modules.courseId, courses.id))
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(isPublished)
    .all();
  return totals;
}

export function getLandingPage(db: Db): LandingPage {
  return { featuredCourses: getFeaturedCourses(db), stats: getStats(db) };
}
