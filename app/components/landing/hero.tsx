import { Link } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CourseCover } from "~/components/landing/course-cover";

type CoverCourse = {
  id: number;
  title: string;
  categoryName: string;
  categorySlug: string;
};

const HIGHLIGHTS = [
  "Track your progress lesson by lesson",
  "Check what you learned with quizzes",
  "Learn on your own schedule",
];

// Each card in the collage sits at its own offset and tilt.
const COLLAGE_POSITIONS = [
  "left-0 top-0 -rotate-3",
  "right-0 top-1/4 rotate-2",
  "bottom-0 left-1/6 -rotate-1",
];

export function Hero({
  signedIn,
  courses,
}: {
  signedIn: boolean;
  courses: CoverCourse[];
}) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-28">
      <div>
        <p className="mb-6 w-fit rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground">
          Self-paced courses for developers
        </p>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Learn to code,
          <br />
          <span className="text-muted-foreground">at your own pace</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Structured courses built by experienced instructors. Track your
          progress, take quizzes, and build real-world skills.
        </p>
        <CallsToAction signedIn={signedIn} />
        <Highlights />
      </div>
      <HeroCollage courses={courses} />
    </section>
  );
}

function CallsToAction({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
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

function Highlights() {
  return (
    <ul className="mt-10 space-y-3">
      {HIGHLIGHTS.map((highlight) => (
        <li
          key={highlight}
          className="flex items-center gap-3 text-sm text-muted-foreground"
        >
          <CheckCircle2 className="size-4 text-primary" />
          {highlight}
        </li>
      ))}
    </ul>
  );
}

function HeroCollage({ courses }: { courses: CoverCourse[] }) {
  if (courses.length === 0) return null;

  return (
    <div className="relative hidden h-[26rem] lg:block">
      {courses.map((course, index) => (
        <CourseCover
          key={course.id}
          title={course.title}
          categoryName={course.categoryName}
          categorySlug={course.categorySlug}
          showTitle={index === courses.length - 1}
          className={`absolute w-3/4 rounded-xl shadow-xl ring-1 ring-black/5 ${COLLAGE_POSITIONS[index]}`}
        />
      ))}
    </div>
  );
}
