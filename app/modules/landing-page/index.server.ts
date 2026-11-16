import { db } from "~/db";
import { getLandingPage, type Db } from "./lib/landing-page";

export type {
  CatalogueStats,
  FeaturedCourse,
  LandingPage,
} from "./lib/landing-page";

/**
 * The landing page bound to a database. The app uses `landingPage`, which
 * reads the app database; tests build their own against a test database.
 */
export function createLandingPage(database: Db) {
  return {
    /**
     * What `/` shows about the catalogue: the newest published courses, with
     * the details a course card needs, and counts across every published
     * course. Drafts and archived courses never appear in either.
     */
    get() {
      return getLandingPage(database);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const landingPage = /* @__PURE__ */ createLandingPage(db);
