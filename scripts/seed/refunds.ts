import * as schema from "../../app/db/schema";
import { LessonProgressStatus, RefundStatus } from "../../app/db/schema";
import { daysAgo, type SeedDb, type User, type Course } from "./helpers";

type SeedRefundsDeps = {
  course1: Course;
  course1LessonIds: number[];
  db: SeedDb;
  novakLicence: { purchase: { id: number } };
  studentByEmail: (email: string) => User;
};

// ─── Liam's Refund Request ───
// One learner with an Open Refund Request. The dates count back from
// today, so the fourteen-day refund window is still open whenever you seed.

function enrolLiam({ course1, db }: SeedRefundsDeps, liam: User) {
  const [liamPurchase] = db
    .insert(schema.purchases)
    .values({
      userId: liam.id,
      courseId: course1.id,
      amountPaid: 7900,
      country: null,
      createdAt: daysAgo(9),
    })
    .returning()
    .all();
  db.insert(schema.enrollments)
    .values({
      userId: liam.id,
      courseId: course1.id,
      enrolledAt: daysAgo(9),
    })
    .run();

  return liamPurchase;
}

function seedLiamsRefund(deps: SeedRefundsDeps) {
  const { course1, course1LessonIds, db, studentByEmail } = deps;
  const liam = studentByEmail("liam@example.com");
  const liamPurchase = enrolLiam(deps, liam);
  db.insert(schema.lessonProgress)
    .values([
      ...course1LessonIds.slice(0, 3).map((lessonId, i) => ({
        userId: liam.id,
        lessonId,
        status: LessonProgressStatus.Completed,
        completedAt: daysAgo(8 - i),
      })),
      {
        userId: liam.id,
        lessonId: course1LessonIds[3],
        status: LessonProgressStatus.InProgress,
        completedAt: null,
      },
    ])
    .run();
  db.insert(schema.courseRatings)
    .values({
      userId: liam.id,
      courseId: course1.id,
      rating: 4,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    })
    .run();
  db.insert(schema.refunds)
    .values({
      purchaseId: liamPurchase.id,
      status: RefundStatus.Open,
      reason: "Bought the wrong one, I meant the advanced course.",
      requestedAt: daysAgo(4),
    })
    .run();

  console.log("Created Liam's Refund Request.");
}

function seedMartasRefund({ db, novakLicence }: SeedRefundsDeps) {
  // ─── Marta's Refund Request ───
  // A Team Licence with no Claimed Seats, so a Platform Admin can approve it.
  // Its Seats are on hold while the request is open.

  db.insert(schema.refunds)
    .values({
      purchaseId: novakLicence.purchase.id,
      status: RefundStatus.Open,
      reason:
        "Our design team was reorganised and nobody needs these seats now.",
      requestedAt: daysAgo(1),
    })
    .run();

  console.log("Created Marta's Refund Request on her Team Licence.");
}

export function seedRefunds(deps: SeedRefundsDeps) {
  seedLiamsRefund(deps);
  seedMartasRefund(deps);
}
