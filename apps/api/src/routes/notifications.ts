import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function notificationsRoutes(app: FastifyInstance) {
  // List Notifications
  app.get("/notifications", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    const notifs = await prisma.notification.findMany({
      where: { userId },
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        eventId: true,
        read: true,
        createdAt: true,
      },
    });

    return notifs;
  });

  // Mark Read
  app.patch("/notifications/:id/read", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id } = req.params as any;

    // sécurité: ne mettre à jour que si la notif appartient au user
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      return reply.code(404).send({ error: "Notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
      select: {
        id: true, type: true, title: true, message: true,
        eventId: true, read: true, createdAt: true
      },
    });

    return updated;
  });
}