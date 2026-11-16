import { coverToneFor, type CoverTone } from "~/modules/landing-page";
import { cn } from "~/lib/utils";

// Literal class strings so Tailwind's scanner finds every one of them.
const TONE_CLASSES: Record<CoverTone, string> = {
  sky: "from-sky-500 to-indigo-600",
  violet: "from-violet-500 to-fuchsia-600",
  emerald: "from-emerald-500 to-teal-700",
  amber: "from-amber-400 to-orange-600",
  rose: "from-rose-500 to-pink-700",
};

export function CourseCover({
  title,
  categoryName,
  categorySlug,
  showTitle = true,
  className,
}: {
  title: string;
  categoryName: string;
  categorySlug: string;
  showTitle?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-video flex-col justify-between overflow-hidden bg-gradient-to-br p-5 text-white",
        TONE_CLASSES[coverToneFor(categorySlug)],
        className
      )}
    >
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 right-12 size-32 rounded-full bg-black/10" />
      <span className="relative w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
        {categoryName}
      </span>
      {showTitle && (
        <span className="relative max-w-[85%] text-lg font-semibold leading-tight tracking-tight">
          {title}
        </span>
      )}
    </div>
  );
}
