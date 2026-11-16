import type { loadLessonPage } from "./index.server";

/** What the lesson page loader returns, for the components that render it. */
export type LessonPageData = Awaited<ReturnType<typeof loadLessonPage>>;
export type FullLessonData = Extract<LessonPageData, { view: "full" }>;
export type LockedLessonData = Extract<LessonPageData, { view: "locked" }>;
