import * as schema from "../../app/db/schema";
import { CourseStatus } from "../../app/db/schema";
import { markdown } from "../../app/lib/text";
import { daysAgo, type SeedDb, type User, type Category } from "./helpers";
import { insertCourseContent, type ModuleSpec } from "./course-content";

const DESIGN_SYSTEMS_SALES_COPY = `## Design Systems That Survive

Most design systems die the same way: a beautiful component library nobody uses, drifting out of sync with the product it was meant to serve.

This course is about the other kind — the system your team reaches for because it is faster than not using it.

### What You'll Learn

- **Design tokens** — colour, spacing and type scales that mean something
- **Component APIs** — variants that compose instead of multiplying
- **Theming** — light, dark, and brand themes without a fork
- **Governance** — how changes land without breaking every consumer

## Who Is This For?

Frontend developers who have built components before and watched the collection turn into a mess. Tailwind experience helps but is not required.`;

const DATA_VIS_SALES_COPY = `## Charts People Can Read

A chart is an argument. This course is about making the argument clearly — picking the right encoding, scaling it honestly, and colouring it so everyone can read it.

### Topics

- Choosing an encoding that matches the question
- Scales, axes, and the zero-baseline argument
- Colour palettes that survive colour blindness
- Annotating a chart so it needs no caption

## Who Is This For?

Developers and analysts who produce charts for other people to act on.`;

const DOCKER_SALES_COPY = `## From Laptop to Cluster

Containers made deployment reproducible and Kubernetes made it configurable. This course covers both without pretending either is simple.

### Topics

- Writing a Dockerfile that builds fast and ships small
- Pods, deployments, services — what each one is actually for
- Config, secrets and the twelve-factor bits that matter
- Rolling out a change and rolling it back

## Status

This course is still in draft while the cluster examples are rewritten against the current API.`;

const course3Modules: ModuleSpec[] = [
  {
    title: "Foundations",
    lessons: [
      {
        title: "What a Design System Is For",
        duration: 9,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## What a Design System Is For\n\nA design system is a shared vocabulary, not a component folder. This lesson covers what belongs in one and — more usefully — what does not.",
      },
      {
        title: "Design Tokens",
        duration: 14,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## Design Tokens\n\nColour, spacing, radius and type scales expressed as named values, so a change lands in one place instead of two hundred.",
      },
      {
        title: "Spacing and Type Scales",
        duration: 12,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## Scales\n\nWhy a constrained scale produces better layouts than free choice, and how to pick one you can live with.",
      },
    ],
  },
  {
    title: "Components",
    lessons: [
      {
        title: "Variants and Composition",
        duration: 18,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        githubRepoUrl:
          "https://github.com/total-typescript/design-system-variants",
        content:
          "## Variants\n\nA variant API that composes beats one that enumerates. We build a button whose options multiply without the source doing the same.",
      },
      {
        title: "Accessible Primitives",
        duration: 16,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## Accessible Primitives\n\nFocus management, keyboard interaction and ARIA — handled once in the primitive rather than in every consumer.",
      },
      {
        title: "Theming and Dark Mode",
        duration: 15,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## Theming\n\nOne set of components, several themes, no forks. CSS custom properties do most of the work.",
      },
    ],
  },
  {
    title: "Living With It",
    lessons: [
      {
        title: "Documentation That Gets Read",
        duration: 11,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## Documentation\n\nDocs next to the code, examples that run, and the one page every new team member actually opens.",
      },
      {
        title: "Versioning and Breaking Changes",
        duration: 13,
        videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
        content:
          "## Breaking Changes\n\nHow to ship a breaking change to twelve teams without becoming the reason they fork.",
      },
      {
        title: "Course Wrap-Up",
        duration: 6,
        content:
          "## Wrap-Up\n\nYou have a token layer, a component API you can defend, and a story for how changes land. Go and delete some CSS.",
      },
    ],
  },
];

const course4Modules: ModuleSpec[] = [
  {
    title: "Choosing a Chart",
    lessons: [
      {
        title: "Encodings and What They Say",
        duration: 12,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Encodings\n\nPosition beats length beats angle beats area. Pick the strongest encoding the question allows.",
      },
      {
        title: "Time Series Done Right",
        duration: 14,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Time Series\n\nRanges, resampling, and why a 30-day and a 90-day view of the same data should not look identical.",
      },
      {
        title: "Distributions",
        duration: 13,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Distributions\n\nHistograms, box plots, and the mean hiding a bimodal population.",
      },
    ],
  },
  {
    title: "Making It Readable",
    lessons: [
      {
        title: "Scales and Axes",
        duration: 11,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Scales\n\nWhen truncating an axis is honest, and when it is a lie with a legend.",
      },
      {
        title: "Colour and Accessibility",
        duration: 15,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Colour\n\nSequential, diverging and categorical palettes, checked against the three common forms of colour blindness.",
      },
      {
        title: "Annotation and Narrative",
        duration: 10,
        content:
          "## Annotation\n\nThe label on the spike is doing more work than the spike.",
      },
    ],
  },
];

const course5Modules: ModuleSpec[] = [
  {
    title: "Containers",
    lessons: [
      {
        title: "Why Containers",
        duration: 8,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Why Containers\n\nThe problem containers solve, stated precisely enough to know when you do not have it.",
      },
      {
        title: "Writing a Dockerfile",
        duration: 17,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## Dockerfiles\n\nLayer caching, multi-stage builds, and getting the image under a hundred megabytes.",
      },
      {
        title: "Images and Registries",
        duration: 12,
        content:
          "## Registries\n\nTagging, pushing, and why `latest` is not a version.",
      },
    ],
  },
  {
    title: "Kubernetes Basics",
    lessons: [
      {
        title: "Pods, Deployments, Services",
        duration: 19,
        videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
        content:
          "## The Core Objects\n\nThree objects explain most of Kubernetes. This lesson is those three.",
      },
      {
        title: "Config and Secrets",
        duration: 14,
        content:
          "## Config\n\nConfigMaps, Secrets, and keeping environment differences out of the image.",
      },
    ],
  },
];

function seedDesignSystemsCourse({
  catBySlug,
  db,
  instructor,
}: {
  catBySlug: Record<string, Category>;
  db: SeedDb;
  instructor: User;
}) {
  // ─── Course 3: Design Systems with Tailwind (Sarah Chen) ───
  // A second selling course for Sarah, so the per-instructor views have more
  // than one row and revenue splits across courses.

  const [course3] = db
    .insert(schema.courses)
    .values({
      title: "Design Systems with Tailwind",
      slug: "design-systems-with-tailwind",
      description:
        "Build a design system that survives contact with a real product team. Tokens, component APIs, theming, and the discipline that keeps a system from rotting into a component graveyard.",
      salesCopy: markdown(DESIGN_SYSTEMS_SALES_COPY),
      instructorId: instructor.id,
      categoryId: catBySlug["design"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-typescript.svg",
      price: 3999,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(14),
    })
    .returning()
    .all();

  const course3LessonIds = insertCourseContent(db, {
    courseId: course3.id,
    moduleSpecs: course3Modules,
    startDaysAgo: 195,
  });

  console.log(
    `Created course "${course3.title}" with 3 modules and ${course3LessonIds.length} lessons.`
  );

  return { course3, course3LessonIds };
}

function seedDataVisualisationCourse({
  catBySlug,
  db,
  instructor,
}: {
  catBySlug: Record<string, Category>;
  db: SeedDb;
  instructor: User;
}) {
  // ─── Course 4: Practical Data Visualisation (Marcus Johnson) ───
  // Published but has never sold. The analytics views must render a course with
  // zero revenue, zero enrolments and zero progress without dividing by it.

  const [course4] = db
    .insert(schema.courses)
    .values({
      title: "Practical Data Visualisation",
      slug: "practical-data-visualisation",
      description:
        "Turn data into charts people can actually read. Chart selection, scales, colour, and the accessibility rules most dashboards break.",
      salesCopy: markdown(DATA_VIS_SALES_COPY),
      instructorId: instructor.id,
      categoryId: catBySlug["data-science"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-nodejs.svg",
      price: 4499,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(6),
    })
    .returning()
    .all();

  const course4LessonIds = insertCourseContent(db, {
    courseId: course4.id,
    moduleSpecs: course4Modules,
    startDaysAgo: 35,
  });

  console.log(
    `Created course "${course4.title}" with 2 modules and ${course4LessonIds.length} lessons (published, no sales).`
  );
}

function seedDockerCourse({
  catBySlug,
  db,
  instructor,
}: {
  catBySlug: Record<string, Category>;
  db: SeedDb;
  instructor: User;
}) {
  // ─── Course 5: Shipping with Docker and Kubernetes (Marcus Johnson) ───
  // Draft — never appears in the catalogue, and must be excluded from published
  // course counts and revenue.

  const [course5] = db
    .insert(schema.courses)
    .values({
      title: "Shipping with Docker and Kubernetes",
      slug: "shipping-with-docker-and-kubernetes",
      description:
        "Containerise an application and run it on Kubernetes without cargo-culting a YAML file you do not understand.",
      salesCopy: markdown(DOCKER_SALES_COPY),
      instructorId: instructor.id,
      categoryId: catBySlug["devops"].id,
      status: CourseStatus.Draft,
      coverImageUrl: "/images/course-nodejs.svg",
      price: 5499,
      createdAt: daysAgo(18),
      updatedAt: daysAgo(2),
    })
    .returning()
    .all();

  const course5LessonIds = insertCourseContent(db, {
    courseId: course5.id,
    moduleSpecs: course5Modules,
    startDaysAgo: 15,
  });

  console.log(
    `Created course "${course5.title}" with 2 modules and ${course5LessonIds.length} lessons (draft).`
  );
}

export function seedMoreCourses({
  catBySlug,
  db,
  instructor1,
  instructor2,
}: {
  catBySlug: Record<string, Category>;
  db: SeedDb;
  instructor1: User;
  instructor2: User;
}) {
  const result = seedDesignSystemsCourse({
    catBySlug,
    db,
    instructor: instructor1,
  });
  seedDataVisualisationCourse({ catBySlug, db, instructor: instructor2 });
  seedDockerCourse({ catBySlug, db, instructor: instructor2 });
  return result;
}
