// Fails when .oxlintrc.json exempts a file from a ratcheted rule that the last
// commit did not. The exemption lists hold old debt: they only shrink. A file
// over a limit is fixed, not added to a list, even when a split moved the
// code there unchanged.
// Usage: node scripts/check-lint-exemptions.js [.oxlintrc.json]

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RATCHETED = [
  "max-lines",
  "max-lines-per-function",
  "max-depth",
  "max-params",
  "standards/no-number-coercion",
];
const CONFIG = ".oxlintrc.json";

// The config is JSON with whole-line `//` comments.
const parse = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));

const exemptions = (config) =>
  new Set(
    (config.overrides ?? []).flatMap(({ files = [], rules = {} }) =>
      RATCHETED.filter((rule) => rules[rule] === "off").flatMap((rule) =>
        files.map((file) => `${rule}: ${file}`)
      )
    )
  );

const committed = () => {
  try {
    return execFileSync("git", ["show", `HEAD:${CONFIG}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
};

const before = committed();
if (before === undefined) process.exit(0);

const was = exemptions(parse(before));
const added = [
  ...exemptions(parse(readFileSync(process.argv[2] ?? CONFIG, "utf8"))),
].filter((entry) => !was.has(entry));

if (added.length > 0) {
  console.error(
    [
      "New exemptions in .oxlintrc.json. These lists only shrink:",
      "",
      ...added.map((entry) => `  ${entry}`),
      "",
      "Fix the file instead: split the long function, flatten the nesting with",
      "early returns, bundle the parameters into one object, or parse the",
      "input with a zod schema. Code moved unchanged from an exempt file is",
      "fixed too, not exempted again.",
    ].join("\n")
  );
  process.exit(1);
}
