import { describe, it, expect } from "vitest";
import { coverToneFor } from "../index";

describe("coverToneFor", () => {
  it("gives each seeded category its own tone", () => {
    const tones = [
      "programming",
      "design",
      "data-science",
      "devops",
      "marketing",
    ].map(coverToneFor);
    expect(tones).toEqual(["sky", "violet", "emerald", "amber", "rose"]);
  });

  it("hashes an unknown category onto the palette", () => {
    const tones = ["cooking", "woodworking", "finance", "writing", "law"].map(
      coverToneFor
    );
    expect(tones).toEqual(["sky", "violet", "amber", "emerald", "rose"]);
  });

  it("gives the same unknown category the same tone every time", () => {
    expect(coverToneFor("woodworking")).toBe(coverToneFor("woodworking"));
  });
});
