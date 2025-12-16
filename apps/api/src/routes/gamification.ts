import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function gamificationRoutes(app: FastifyInstance) {
  // Get Badges & Streak
  app.get("/me/gamification", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    const [streak, userBadges] = await Promise.all([
      prisma.streak.findUnique({ where: { userId } }),
      prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { unlockedAt: "desc" },
      }),
    ]);

    return {
      streak: streak ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
      badges: userBadges.map((ub) => ({
        id: ub.badgeId,
        type: ub.badge.type,
        name: ub.badge.name,
        description: ub.badge.description,
        icon: ub.badge.icon,
        unlockedAt: ub.unlockedAt,
      })),
    };
  });

  // Unlock Badge (Dev/Test)
  app.post("/gamification/unlock", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { type } = (req.body as any) || {};
    if (!type) return reply.code(400).send({ error: "Missing 'type'" });

    // On cast en Any pour éviter les soucis de type ESM côté API
    const badge = await prisma.badge.findUnique({ where: { type: type as any } });
    if (!badge) return reply.code(404).send({ error: "Badge not found" });

    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: {},
      create: { userId, badgeId: badge.id },
    });

    return { ok: true, unlocked: type };
  });

  // Daily Activity (Streak)
  app.post("/gamification/activity", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const s = await prisma.streak.findUnique({ where: { userId } });

    if (!s) {
      const created = await prisma.streak.create({
        data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
      });
      return { ok: true, streak: created, delta: +1 };
    }

    // Déjà compté aujourd’hui → rien à faire
    if (s.lastActiveDate && sameDay(s.lastActiveDate, today)) {
      return { ok: true, streak: s, delta: 0 };
    }

    // Si hier → on continue la série, sinon on repart à 1
    const yesterday = addDays(today, -1);
    const continued = s.lastActiveDate && sameDay(s.lastActiveDate, yesterday);

    const nextCurrent = continued ? s.currentStreak + 1 : 1;
    const nextLongest = Math.max(s.longestStreak, nextCurrent);

    const updated = await prisma.streak.update({
      where: { userId },
      data: { currentStreak: nextCurrent, longestStreak: nextLongest, lastActiveDate: today },
    });

    return { ok: true, streak: updated, delta: continued ? +1 : 1 - s.currentStreak };
  });

  // Complete Onboarding
  app.post("/onboarding/complete", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    const onboarding = await prisma.badge.findUnique({ where: { type: "ONBOARDING_COMPLETE" as any } });
    if (!onboarding) return reply.code(500).send({ error: "Badge ONBOARDING_COMPLETE missing in DB" });

    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: onboarding.id } },
      update: {},
      create: { userId, badgeId: onboarding.id },
    });

    return { ok: true };
  });
}

// Helpers
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}