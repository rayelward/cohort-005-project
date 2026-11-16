export type CoverTone = "sky" | "violet" | "emerald" | "amber" | "rose";

const TONES: readonly CoverTone[] = [
  "sky",
  "violet",
  "emerald",
  "amber",
  "rose",
];

// The seeded categories get hand-picked tones so the featured row never
// repeats a colour; any other category hashes onto the same palette.
const CATEGORY_TONES: Record<string, CoverTone> = {
  programming: "sky",
  design: "violet",
  "data-science": "emerald",
  devops: "amber",
  marketing: "rose",
};

export function coverToneFor(categorySlug: string): CoverTone {
  const known = CATEGORY_TONES[categorySlug];
  if (known) return known;
  let hash = 0;
  for (const char of categorySlug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return TONES[hash % TONES.length];
}
