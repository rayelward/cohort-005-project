import { eq } from "drizzle-orm";
import * as schema from "../../app/db/schema";
import { TeamMemberRole } from "../../app/db/schema";
import { daysAgo, type SeedDb, type User, type Course } from "./helpers";

// ─── Further team purchases ───
// Two more seat purchases so team revenue is not a single row, in mixed
// redemption states: one team most of the way through its seats, one that has
// bought and redeemed nothing yet.

type TeamLicence = {
  adminEmail: string;
  course: Course;
  seats: number;
  codePrefix: string;
  purchasedDaysAgo: number;
  redeemerEmails: string[];
};

type TeamDeps = {
  db: SeedDb;
  studentByEmail: (email: string) => User;
};

function buyTeamLicence(
  { db, studentByEmail }: TeamDeps,
  licence: TeamLicence
) {
  const { adminEmail, course, seats, codePrefix, purchasedDaysAgo } = licence;
  const teamAdmin = studentByEmail(adminEmail);

  const [team] = db
    .insert(schema.teams)
    .values({ createdAt: daysAgo(purchasedDaysAgo) })
    .returning()
    .all();

  db.insert(schema.teamMembers)
    .values({
      teamId: team.id,
      userId: teamAdmin.id,
      role: TeamMemberRole.Admin,
      createdAt: daysAgo(purchasedDaysAgo),
    })
    .run();

  const [purchase] = db
    .insert(schema.purchases)
    .values({
      userId: teamAdmin.id,
      courseId: course.id,
      amountPaid: course.price * seats,
      country: "US",
      createdAt: daysAgo(purchasedDaysAgo),
    })
    .returning()
    .all();

  const teamCoupons = db
    .insert(schema.coupons)
    .values(
      Array.from({ length: seats }, (_, i) => ({
        teamId: team.id,
        courseId: course.id,
        code: `${codePrefix}-${String(i + 1).padStart(2, "0")}`,
        purchaseId: purchase.id,
        createdAt: daysAgo(purchasedDaysAgo),
      }))
    )
    .returning()
    .all();

  return { team, purchase, coupons: teamCoupons };
}

function redeemSeats(
  { db, studentByEmail }: TeamDeps,
  licence: TeamLicence,
  bought: ReturnType<typeof buyTeamLicence>
) {
  const { course, purchasedDaysAgo, redeemerEmails } = licence;
  const { team, coupons: teamCoupons } = bought;
  // Redeemers named by email, for the reason given at the first team above.
  redeemerEmails.forEach((email, i) => {
    const redeemer = studentByEmail(email);
    const redeemedDaysAgo = Math.max(0, purchasedDaysAgo - (i + 1) * 2);

    db.update(schema.coupons)
      .set({
        redeemedByUserId: redeemer.id,
        redeemedAt: daysAgo(redeemedDaysAgo),
      })
      .where(eq(schema.coupons.id, teamCoupons[i].id))
      .run();

    db.insert(schema.teamMembers)
      .values({
        teamId: team.id,
        userId: redeemer.id,
        role: TeamMemberRole.Member,
        createdAt: daysAgo(redeemedDaysAgo),
      })
      .run();

    db.insert(schema.enrollments)
      .values({
        userId: redeemer.id,
        courseId: course.id,
        enrolledAt: daysAgo(redeemedDaysAgo),
      })
      .run();
  });
}

function createTeamPurchase(deps: TeamDeps, licence: TeamLicence) {
  const bought = buyTeamLicence(deps, licence);
  redeemSeats(deps, licence, bought);
  return bought;
}

export function seedTeamLicences(
  deps: TeamDeps & { course1: Course; course3: Course }
) {
  const { course1, course3 } = deps;
  // Eight seats on TypeScript, six redeemed.
  createTeamPurchase(deps, {
    adminEmail: "ava.nakamura@student.dev",
    course: course1,
    seats: 8,
    codePrefix: "TEAM-TS-NAKAMURA",
    purchasedDaysAgo: 120,
    redeemerEmails: [
      "noah.blackwood@student.dev",
      "isla.fernandes@student.dev",
      "ethan.okafor@student.dev",
      "mia.lindqvist@student.dev",
      "lucas.moreau@student.dev",
      "zara.haddad@student.dev",
    ],
  });

  // Four seats on Design Systems, bought during launch week, none redeemed yet.
  const novakLicence = createTeamPurchase(deps, {
    adminEmail: "marta.novak@student.dev",
    course: course3,
    seats: 4,
    codePrefix: "TEAM-DS-NOVAK",
    purchasedDaysAgo: 4,
    redeemerEmails: [],
  });

  return { novakLicence };
}
