import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

const VISIBILITIES = ["PRIVATE", "FRIENDS", "LINK", "PUBLIC"] as const;
type Visibility = typeof VISIBILITIES[number];

export default async function preferencesRoutes(app: FastifyInstance) {
  // Get Preferences
  app.get("/me/preferences", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        notificationOptIn: true,
        defaultEventVisibility: "PRIVATE",
      },
      update: {}, // ne modifie rien s'il existe déjà
    });

    return pref;
  });

  // Update Preferences
  app.patch("/me/preferences", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const body = (req.body as any) || {};
    const { notificationOptIn, defaultEventVisibility } = body;

    // Validation légère
    if (typeof notificationOptIn !== "undefined" && typeof notificationOptIn !== "boolean") {
      return reply.code(400).send({ error: "notificationOptIn must be boolean" });
    }
    if (
      typeof defaultEventVisibility !== "undefined" &&
      !VISIBILITIES.includes(defaultEventVisibility)
    ) {
      return reply.code(400).send({ error: "defaultEventVisibility invalid" });
    }

    // S'assurer que la row existe puis appliquer les updates demandés
    await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        notificationOptIn: typeof notificationOptIn === "boolean" ? notificationOptIn : true,
        defaultEventVisibility:
          ((defaultEventVisibility as Visibility) ?? "PRIVATE"),
      },
      update: {
        ...(typeof notificationOptIn === "boolean" ? { notificationOptIn } : {}),
        ...(typeof defaultEventVisibility !== "undefined"
          ? { defaultEventVisibility: defaultEventVisibility as Visibility }
          : {}),
      },
    });

    const updated = await prisma.userPreference.findUnique({ where: { userId } });
    return updated;
  });
}