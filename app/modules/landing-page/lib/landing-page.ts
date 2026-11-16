import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import {
  categories,
  courses,
  CourseStatus,
  lessons,
  modules,
  users,
} from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const FEATURED_COURSE_COUNT = 3;

export type FeaturedCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  instructorName: string;
  categoryName: string;
  lessonCount: number;
};

export type CatalogueStats = {
  courses: number;
  lessons: number;
  instructors: number;
};

export type LandingPage = {
  featuredCourses: FeaturedCourse[];
  stats: CatalogueStats;
};

const isPublished = eq(courses.status, CourseStatus.Published);

function getFeaturedCourses(db: Db): FeaturedCourse[] {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
      categoryName: categories.name,
      lessonCount: sql<number>`count(${lessons.id})`,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .leftJoin(modules, eq(modules.courseId, courses.id))
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(isPublished)
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(FEATURED_COURSE_COUNT)
    .all();
}

function getCatalogueStats(db: Db): CatalogueStats {
  // An aggregate without GROUP BY always returns exactly one row.
  const [catalogue] = db
    .select({
      courses: countDistinct(courses.id),
      instructors: countDistinct(courses.instructorId),
    })
    .from(courses)
    .where(isPublished)
    .all();

  const [lessonCount] = db
    .select({ lessons: sql<number>`count(*)` })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, and(eq(modules.courseId, courses.id), isPublished))
    .all();

  return {
    courses: catalogue.courses,
    lessons: lessonCount.lessons,
    instructors: catalogue.instructors,
  };
}

export function getLandingPage(db: Db): LandingPage {
  return {
    featuredCourses: getFeaturedCourses(db),
    stats: getCatalogueStats(db),
  };
}
