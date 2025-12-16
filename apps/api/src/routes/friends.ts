import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function friendRoutes(app: FastifyInstance) {
  // Send Friend Request
  app.post("/friends/requests", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId: currentUserId } = req as any;
    const { toUserId } = (req.body as any) || {};

    if (!toUserId || toUserId === currentUserId) {
      return reply.code(400).send({ error: "Invalid toUserId" });
    }

    const fr = await prisma.friendRequest.upsert({
      where: { fromUserId_toUserId: { fromUserId: currentUserId, toUserId } },
      update: { status: "PENDING" },
      create: { fromUserId: currentUserId, toUserId, status: "PENDING" },
    });

    return { request: fr };
  });

  // List Requests
  app.get("/friends/requests", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    const incoming = await prisma.friendRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { fromUser: true },
      orderBy: { createdAt: "desc" },
    });

    const outgoing = await prisma.friendRequest.findMany({
      where: { fromUserId: userId, status: "PENDING" },
      include: { toUser: true },
      orderBy: { createdAt: "desc" },
    });

    return { incoming, outgoing };
  });

  // Accept Request
  app.post("/friends/requests/:id/accept", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id } = req.params as any;

    const fr = await prisma.friendRequest.findUnique({ where: { id } });
    if (!fr) return reply.code(404).send({ error: "Request not found" });
    if (fr.toUserId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const accepted = await prisma.friendRequest.update({
      where: { id },
      data: { status: "ACCEPTED", decidedAt: new Date() },
    });

    return { request: accepted };
  });
}