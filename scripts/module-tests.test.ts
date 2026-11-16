import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Every module ships with tests through its entry points, in its `tests/`
// folder (app/modules/README.md). A module without one is invisible to
// `npm run test:mutation`.

const modulesDir = fileURLToPath(new URL("../app/modules/", import.meta.url));

const modules = readdirSync(modulesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("app/modules", () => {
  it.each(modules)("%s has a tests/ folder with a test in it", (name) => {
    const testsDir = `${modulesDir}${name}/tests`;
    const tests = existsSync(testsDir)
      ? readdirSync(testsDir).filter((file) => /\.test\.tsx?$/.test(file))
      : [];
    expect(
      tests,
      `app/modules/${name}/tests/ has no *.test.ts file`
    ).not.toEqual([]);
  });
});
