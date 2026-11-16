import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CourseImage } from "~/components/course-image";
import type { FeaturedCourse } from "~/modules/landing-page/index.server";

const HIGHLIGHTS = [
  "Hands-on quizzes",
  "Progress tracking",
  "Learn on any schedule",
];

// Where each cover sits in the hero collage, front-most last.
const COLLAGE_POSITIONS = [
  "left-0 top-0 -rotate-3",
  "right-0 top-12 rotate-2",
  "bottom-0 left-1/4 -rotate-1",
];

export function LandingHero({
  signedIn,
  courses,
}: {
  signedIn: boolean;
  courses: FeaturedCourse[];
}) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-28">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Self-paced courses for developers
        </p>
        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Learn to code,
          <br />
          <span className="text-muted-foreground">at your own pace</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Structured courses built by experienced instructors. Track your
          progress, take quizzes, and build real-world skills.
        </p>
        <HeroActions signedIn={signedIn} />
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight} className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              {highlight}
            </li>
          ))}
        </ul>
      </div>
      <CourseCollage courses={courses} />
    </section>
  );
}

function HeroActions({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <Link to="/courses">
          Browse Courses
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </Button>
      {!signedIn && (
        <Button asChild size="lg" variant="outline">
          <Link to="/signup">Sign Up</Link>
        </Button>
      )}
    </div>
  );
}

function CourseCollage({ courses }: { courses: FeaturedCourse[] }) {
  if (courses.length === 0) return null;

  return (
    <div className="relative hidden h-[480px] lg:block" aria-hidden="true">
      <div className="absolute inset-x-6 inset-y-10 rounded-3xl bg-gradient-to-br from-muted via-muted/60 to-transparent" />
      {courses.map((course, i) => (
        <div
          key={course.id}
          className={`absolute w-72 overflow-hidden rounded-xl border border-border bg-card shadow-xl ${COLLAGE_POSITIONS[i]}`}
        >
          <CourseImage
            src={course.coverImageUrl}
            alt=""
            className="aspect-video w-full object-cover"
          />
          <div className="px-4 py-3">
            <p className="truncate text-sm font-semibold">{course.title}</p>
            <p className="text-xs text-muted-foreground">
              {course.instructorName} · {course.lessonCount} lessons
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
