import type { LucideIcon } from "lucide-react";
import { BookOpen, Clock, GraduationCap, Users } from "lucide-react";

type Stat = { icon: LucideIcon; value: string; label: string };

export function StatsBand({
  stats,
}: {
  stats: { courses: number; lessons: number; instructors: number };
}) {
  const items: Stat[] = [
    { icon: BookOpen, value: `${stats.courses}`, label: "Published courses" },
    {
      icon: GraduationCap,
      value: `${stats.lessons}`,
      label: "Lessons to work through",
    },
    {
      icon: Users,
      value: `${stats.instructors}`,
      label: "Experienced instructors",
    },
    { icon: Clock, value: "Self-paced", label: "Learn on your schedule" },
  ];

  return (
    <section className="border-y border-border bg-muted/50 py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
