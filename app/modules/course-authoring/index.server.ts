import { db } from "~/db";
import {
  addLesson,
  addModule,
  createCourse,
  setCourseStatus,
  type Db,
  type NewCourse,
  type NewLesson,
  type NewModule,
  type StatusChange,
} from "./lib/course-authoring";

export type {
  NewCourse,
  NewLesson,
  NewModule,
  StatusChange,
} from "./lib/course-authoring";

/**
 * Writing courses, their modules and their lessons, bound to a database. The
 * app uses `courseAuthoring`; tests build their own against a test database.
 */
export function createCourseAuthoring(database: Db) {
  return {
    /**
     * A new course, always a draft, created at `now`. Throws when the sales
     * copy is blank.
     */
    createCourse(course: NewCourse, now: Date) {
      return createCourse(database, course, now);
    },

    /** Moves a course to `status`, stamping `now` as its last update. */
    setCourseStatus(change: StatusChange, now: Date) {
      return setCourseStatus(database, change, now);
    },

    /** A new module, placed after the course's last one. */
    addModule(module: NewModule, now: Date) {
      return addModule(database, module, now);
    },

    /** A new lesson with no content yet, placed after the module's last one. */
    addLesson(lesson: NewLesson, now: Date) {
      return addLesson(database, lesson, now);
    },
  };
}

// Pure so a route importing this only for its action doesn't pull the
// database into the client bundle (see `~/db`).
export const courseAuthoring = /* @__PURE__ */ createCourseAuthoring(db);
