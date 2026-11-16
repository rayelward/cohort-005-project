import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import type { z } from "zod/v4";
import { claudeAgent, required, writeJson } from "../shared/common";
import { extractionPrompt } from "../shared/extraction-prompt";
import { runWithExtraction } from "../shared/run-with-extraction";
import { diffLines } from "./diff-lines";
import { reviewSchema } from "./review-schema";

type Comment = z.infer<typeof reviewSchema>["comments"][number];

const BASE_REF = required("BASE_REF");

const shared = {
  agent: claudeAgent(),
  sandbox: noSandbox(),
  logging: { type: "stdout" },
  output: sandcastle.Output.object({ tag: "comments", schema: reviewSchema }),
  extractionPrompt: extractionPrompt("comments", reviewSchema),
} as const;

// The agent fixes and commits, writes the verdict file, and hands back the
// human calls it left. The workflow pushes the commits, posts the verdict and
// the inline comments, and marks the PR ready.
const first = await runWithExtraction({
  ...shared,
  name: "review",
  promptFile: path.join(import.meta.dirname, "prompt.md"),
  promptArgs: {
    PR_NUMBER: required("PR_NUMBER"),
    BRANCH: required("BRANCH"),
    BASE_REF,
  },
});

// Every finding left behind costs the human reviewer time, so one challenge
// round sends the agent back over them before anything is posted.
const challengePrompt = (left: Comment[]): string =>
  [
    "Before this review is posted, go back over the findings you left:",
    "",
    ...left.map(
      (comment) => `- \`${comment.path}:${comment.line}\`: ${comment.humanCall}`
    ),
    "",
    "Fix each one that a human does not have to decide, and commit the fix through the pre-commit hook. A human call is a product decision or a reading of the spec the ticket does not settle; size, risk, and code this PR only moved are not. Then update /tmp/review-verdict.md to match.",
  ].join("\n");

const sessionId = first.iterations.at(-1)?.sessionId;
const final: z.infer<typeof reviewSchema> =
  first.output.comments.length > 0 && sessionId
    ? (
        await runWithExtraction({
          ...shared,
          name: "review (challenge)",
          prompt: challengePrompt(first.output.comments),
          resumeSession: sessionId,
        })
      ).output
    : first.output;

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const render = (comment: Comment): string =>
  `**Human call:** ${comment.humanCall}\n\n${comment.body}`;

// The diff after the agent's commits: the comments land on that. GitHub
// rejects a whole review for one comment outside the diff, so those go into
// the review's summary instead of being lost.
const hunks = diffLines(git("diff", `origin/${BASE_REF}...HEAD`));
const inline = final.comments.filter((c) => hunks.get(c.path)?.has(c.line));
const outside = final.comments.filter((c) => !hunks.get(c.path)?.has(c.line));

const body = [
  "The decisions this review left for you, on their lines. The verdict is in its own comment.",
  ...outside.map(
    (comment) =>
      `\n---\n\n\`${comment.path}:${comment.line}\`\n\n${render(comment)}`
  ),
].join("\n");

// The request body for POST /repos/{owner}/{repo}/pulls/{n}/reviews. No
// human calls means no file, and the workflow posts no review.
if (final.comments.length > 0)
  writeJson("review-comments.json", {
    commit_id: git("rev-parse", "HEAD").trim(),
    event: "COMMENT",
    body,
    comments: inline.map((comment) => ({
      path: comment.path,
      line: comment.line,
      side: "RIGHT",
      body: render(comment),
    })),
  });
