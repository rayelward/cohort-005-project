import { assessDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the note editor shows for a draft: how long it is against the limit,
 * whether it differs from the saved note, and whether Save may be pressed.
 * `savedBody` is the note as the server stored it (trimmed), or "" when the
 * Student has no note for the lesson yet.
 */
export function describeNoteDraft(draft: string, savedBody: string): NoteDraft {
  return assessDraft(draft, savedBody);
}
