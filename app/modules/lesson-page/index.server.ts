import type {
  CourseDecisions,
  CourseRef,
} from "~/modules/permissions/course-permissions.server";
import type { Person } from "~/modules/permissions/person.server";
import { loadLessonPage as load } from "./lib/load.server";
import { runLessonAction as run } from "./lib/actions.server";

/**
 * Everything the lesson page shows, for someone the permissions module has
 * already found the course for. Someone who cannot view gets the locked
 * view: the outline and the reason, never the content. Throws 404 when the
 * lesson or its module is missing.
 */
export function loadLessonPage(
  decisions: Extract<CourseDecisions, { found: true }>,
  lessonId: number
) {
  return load(decisions, lessonId);
}

/**
 * Runs one lesson page intent for a Person whose capability the route has
 * already checked. Returns `{ ok: false, error }` for a correctable input
 * error; throws a 400 or 404 response otherwise.
 */
export function runLessonAction(input: {
  intent: string;
  formData: FormData;
  person: Person;
  ref: CourseRef;
  lessonId: number;
}) {
  return run(input);
}
