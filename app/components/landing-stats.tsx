import type { LucideIcon } from "lucide-react";
import { BookOpen, Clock, GraduationCap, PlayCircle } from "lucide-react";
import type { CatalogueStats } from "~/modules/landing-page/index.server";

type Stat = { icon: LucideIcon; value: string; label: string };

function statsFor(stats: CatalogueStats): Stat[] {
  return [
    {
      icon: BookOpen,
      value: String(stats.courses),
      label: "Published courses",
    },
    {
      icon: PlayCircle,
      value: String(stats.lessons),
      label: "Lessons to work through",
    },
    {
      icon: GraduationCap,
      value: String(stats.instructors),
      label: "Expert instructors",
    },
    { icon: Clock, value: "Self-paced", label: "Learn on your schedule" },
  ];
}

export function LandingStats({ stats }: { stats: CatalogueStats }) {
  return (
    <section className="border-y border-border bg-muted/50 py-12">
      <dl className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {statsFor(stats).map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-6 text-primary" />
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-bold tracking-tight">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
