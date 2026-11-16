import { eq, isNotNull, isNull } from "drizzle-orm";
import * as schema from "../../app/db/schema";
import { TeamMemberRole } from "../../app/db/schema";
import {
  daysAgo,
  type SeedDb,
  type CountRows,
  type User,
  type Course,
} from "./helpers";

type SeedPurchasesDeps = {
  bossy: User;
  countRows: CountRows;
  course1: Course;
  course2: Course;
  db: SeedDb;
  studentByEmail: (email: string) => User;
  students: User[];
};

function individualPurchases({
  course1,
  course2,
  students,
}: SeedPurchasesDeps) {
  return [
    // Emma — bought course 1 individually
    {
      student: students[0],
      course: course1,
      amountPaid: 7900,
      country: "US",
      daysAgo: 50,
    },
    // Emma — bought course 2 individually
    {
      student: students[0],
      course: course2,
      amountPaid: 5999,
      country: "US",
      daysAgo: 40,
    },
    // James — bought course 1 with PPP discount (India)
    {
      student: students[1],
      course: course1,
      amountPaid: 2500,
      country: "IN",
      daysAgo: 45,
    },
    // Olivia — bought course 1 individually
    {
      student: students[2],
      course: course1,
      amountPaid: 7900,
      country: "US",
      daysAgo: 35,
    },
    // Sophia — bought course 1 individually
    {
      student: students[4],
      course: course1,
      amountPaid: 7900,
      country: "US",
      daysAgo: 15,
    },
  ];
}

function seedIndividualPurchases(deps: SeedPurchasesDeps) {
  const { countRows, db } = deps;
  // ─── Purchases ───
  // Individual purchases for enrolled students

  const purchases = individualPurchases(deps);

  for (const purchase of purchases) {
    db.insert(schema.purchases)
      .values({
        userId: purchase.student.id,
        courseId: purchase.course.id,
        amountPaid: purchase.amountPaid,
        country: purchase.country,
        createdAt: daysAgo(purchase.daysAgo),
      })
      .run();
  }

  console.log(`Created ${countRows(schema.purchases)} individual purchases.`);
}

function seedTeam({ bossy, course2, db }: SeedPurchasesDeps) {
  // ─── Teams, Team Members, and Coupons ───
  // Bossy McBossface bought 5 team seats for course 2; Olivia and Liam redeemed coupons

  const [team1] = db
    .insert(schema.teams)
    .values({ createdAt: daysAgo(30) })
    .returning()
    .all();

  db.insert(schema.teamMembers)
    .values({
      teamId: team1.id,
      userId: bossy.id,
      role: TeamMemberRole.Admin,
      createdAt: daysAgo(30),
    })
    .run();

  // Team purchase by Bossy McBossface for course 2 (5 seats)
  const [teamPurchase] = db
    .insert(schema.purchases)
    .values({
      userId: bossy.id,
      courseId: course2.id,
      amountPaid: 5999 * 5,
      country: "US",
      createdAt: daysAgo(30),
    })
    .returning()
    .all();

  // Generate 5 coupons for the team purchase
  const couponCodes = [
    "TEAM-NODEJS-A1B2C3",
    "TEAM-NODEJS-D4E5F6",
    "TEAM-NODEJS-G7H8I9",
    "TEAM-NODEJS-J0K1L2",
    "TEAM-NODEJS-M3N4O5",
  ];

  const seededCoupons = db
    .insert(schema.coupons)
    .values(
      couponCodes.map((code) => ({
        teamId: team1.id,
        courseId: course2.id,
        code,
        purchaseId: teamPurchase.id,
        createdAt: daysAgo(30),
      }))
    )
    .returning()
    .all();

  return seededCoupons;
}

function redeemTeamCoupons(
  { countRows, db, studentByEmail }: SeedPurchasesDeps,
  seededCoupons: (typeof schema.coupons.$inferSelect)[]
) {
  // Redeem 2 of the 5 coupons. Redeemers are named by email, not by position in
  // the students array — position would silently re-point these redemptions at
  // different people the moment a student is inserted rather than appended.
  // Both already have an enrolment for course 2 from the enrolments section.
  db.update(schema.coupons)
    .set({
      redeemedByUserId: studentByEmail("olivia.martinez@student.dev").id,
      redeemedAt: daysAgo(30),
    })
    .where(eq(schema.coupons.id, seededCoupons[0].id))
    .run();

  db.update(schema.coupons)
    .set({
      redeemedByUserId: studentByEmail("liam@example.com").id,
      redeemedAt: daysAgo(25),
    })
    .where(eq(schema.coupons.id, seededCoupons[1].id))
    .run();

  console.log(
    `Created 1 team with Bossy McBossface as admin, 1 team purchase, and ${seededCoupons.length} coupons (${countRows(schema.coupons, isNotNull(schema.coupons.redeemedByUserId))} redeemed, ${countRows(schema.coupons, isNull(schema.coupons.redeemedByUserId))} available).`
  );
}

export function seedPurchasesAndTeams(deps: SeedPurchasesDeps) {
  seedIndividualPurchases(deps);
  redeemTeamCoupons(deps, seedTeam(deps));
}
