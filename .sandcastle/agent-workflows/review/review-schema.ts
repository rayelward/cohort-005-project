import { z } from "zod/v4";

// The findings the review left unfixed: its human calls. The workflow posts
// each one as an inline comment on the pull request, on its file and line.
export const reviewSchema = z
  .strictObject({
    comments: z
      .array(
        z.strictObject({
          path: z
            .string()
            .min(1)
            .describe("The file, relative to the repository root."),
          line: z
            .number()
            .int()
            .positive()
            .describe(
              "A line in the file as it is now, inside a hunk of the diff against the base. A comment outside the hunks goes into the review's summary instead."
            ),
          humanCall: z
            .string()
            .min(1)
            .describe(
              "The decision only a human can make here: a product decision, or a reading of the spec the ticket does not settle. One sentence, phrased as the question for the human."
            ),
          body: z
            .string()
            .min(1)
            .describe(
              "The finding, in Markdown: the rule or spec line it breaks, and the options for the human."
            ),
        })
      )
      .describe(
        "One entry per finding you left unfixed. Every one is a human call. Empty is fine."
      ),
  })
  .describe("The review's inline comments.");
