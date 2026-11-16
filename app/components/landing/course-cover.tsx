import { useState } from "react";
import { coverToneFor, type CoverTone } from "~/modules/landing-page";
import type { FeaturedCourse } from "~/modules/landing-page/index.server";
import { cn } from "~/lib/utils";

type CoverCourse = Pick<
  FeaturedCourse,
  "title" | "categoryName" | "categorySlug" | "coverImageUrl"
>;

// Literal class strings so Tailwind's scanner finds every one of them.
const TONE_CLASSES: Record<CoverTone, string> = {
  sky: "from-sky-500 to-indigo-600",
  violet: "from-violet-500 to-fuchsia-600",
  emerald: "from-emerald-500 to-teal-700",
  amber: "from-amber-400 to-orange-600",
  rose: "from-rose-500 to-pink-700",
};

export function CourseCover({
  course,
  showTitle = true,
  className,
}: {
  course: CoverCourse;
  showTitle?: boolean;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  // An instructor's own cover wins; the gradient stands in when there is none.
  if (course.coverImageUrl && !imageFailed) {
    return (
      <img
        src={course.coverImageUrl}
        alt=""
        aria-hidden
        className={cn("aspect-video w-full object-cover", className)}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-video flex-col justify-between overflow-hidden bg-gradient-to-br p-5 text-white",
        TONE_CLASSES[coverToneFor(course.categorySlug)],
        className
      )}
    >
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 right-12 size-32 rounded-full bg-black/10" />
      <span className="relative w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
        {course.categoryName}
      </span>
      {showTitle && (
        <span className="relative max-w-[85%] text-lg font-semibold leading-tight tracking-tight">
          {course.title}
        </span>
      )}
    </div>
  );
}
