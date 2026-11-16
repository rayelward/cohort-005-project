import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("describeNoteDraft", () => {
  it("cannot save an empty draft when there is no note yet", () => {
    expect(describeNoteDraft("", "")).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      overLimit: false,
      unsaved: false,
      canSave: false,
    });
  });

  it("can save a new draft with text in it", () => {
    const draft = describeNoteDraft("Result types beat throw", "");
    expect(draft.length).toBe(23);
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("cannot save a draft that is only whitespace", () => {
    const draft = describeNoteDraft("   \n ", "");
    expect(draft.unsaved).toBe(false);
    expect(draft.canSave).toBe(false);
  });

  it("cannot save a draft that matches the saved note", () => {
    const draft = describeNoteDraft("same note", "same note");
    expect(draft.unsaved).toBe(false);
    expect(draft.canSave).toBe(false);
  });

  it("ignores surrounding whitespace when comparing with the saved note", () => {
    expect(describeNoteDraft("  same note\n", "same note").unsaved).toBe(false);
  });

  it("can save an edit to the saved note", () => {
    const draft = describeNoteDraft("same note, edited", "same note");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("cannot save a cleared draft over a saved note", () => {
    const draft = describeNoteDraft("  ", "same note");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("allows a draft exactly at the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), "");
    expect(draft.overLimit).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("refuses a draft one character over the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), "");
    expect(draft.length).toBe(MAX_NOTE_LENGTH + 1);
    expect(draft.overLimit).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("does not count surrounding whitespace against the limit", () => {
    const draft = describeNoteDraft(` ${"a".repeat(MAX_NOTE_LENGTH)} `, "");
    expect(draft.overLimit).toBe(false);
    expect(draft.canSave).toBe(true);
  });
});
