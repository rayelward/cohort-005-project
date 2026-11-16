import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  max: number;
  overLimit: boolean;
  unsaved: boolean;
  canSave: boolean;
};

export function assessDraft(draft: string, savedBody: string): NoteDraft {
  // The server trims before it validates and stores, so count and judge the
  // draft the same way, or the counter disagrees with the limit.
  const trimmed = draft.trim();
  const overLimit = trimmed.length > MAX_NOTE_LENGTH;
  const unsaved = trimmed !== savedBody;
  return {
    length: trimmed.length,
    max: MAX_NOTE_LENGTH,
    overLimit,
    unsaved,
    canSave: unsaved && trimmed.length > 0 && !overLimit,
  };
}
