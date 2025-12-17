import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function messageRoutes(app: FastifyInstance) {
  // Helper: crée/trouve la conversation 1-to-1 en triant les IDs
  const getOrCreateConversation = async (me: string, other: string) => {
    const [userAId, userBId] = [me, other].sort();
    let convo = await prisma.conversation.findUnique({
      where: { unique_pair: { userAId, userBId } },
    });
    if (!convo) {
      convo = await prisma.conversation.create({ data: { userAId, userBId } });
    }
    return convo;
  };

  // Send Message
  app.post("/messages/to/:otherUserId", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId: me } = req as any;
    const { otherUserId } = req.params as any;
    const { content, mediaUrl, type } = (req.body as any) || {};

    if ((!content || !String(content).trim()) && !mediaUrl) {
      return reply.code(400).send({ error: "Message content or media is required" });
    }
    if (otherUserId === me) {
      return reply.code(400).send({ error: "Cannot message yourself" });
    }

    const other = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other) return reply.code(404).send({ error: "User not found" });

    // Check mutual follow
    const myFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me, followingId: otherUserId } }
    });
    const theyFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: otherUserId, followingId: me } }
    });

    if (!myFollow || !theyFollow) {
      return reply.code(403).send({ error: "You can only message users where you mutually follow each other." });
    }

    const convo = await getOrCreateConversation(me, otherUserId);

    const message = await prisma.message.create({
      data: {
        conversationId: convo.id,
        senderId: me,
        content: content ? String(content).trim() : null,
        mediaUrl: mediaUrl || null,
        type: type || "TEXT",
      },
    });

    await prisma.conversation.update({
      where: { id: convo.id },
      data: { updatedAt: new Date() },
    });

    // Émission temps réel privée
    const io = (app as any).io as import("socket.io").Server | undefined;
    if (io) {
      const payload = {
        id: message.id,
        conversationId: convo.id,
        senderId: me,
        recipientId: otherUserId,
        content: message.content,
        mediaUrl: message.mediaUrl,
        type: message.type,
        createdAt: message.createdAt,
      };

      // Send to recipient
      io.to(otherUserId).emit("message:new", payload);
      // Send to self (for multi-device sync)
      io.to(me).emit("message:new", payload);
    }

    return reply.code(201).send({ conversation: convo, message });
  });

  // Get Messages
  app.get("/messages/with/:otherUserId", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId: me } = req as any;
    const { otherUserId } = req.params as any;
    const limit = Math.min(Number((req.query as any)?.limit ?? 20), 100);
    const cursor = (req.query as any)?.cursor as string | undefined;

    const [userAId, userBId] = [me, otherUserId].sort();
    const convo = await prisma.conversation.findUnique({
      where: { unique_pair: { userAId, userBId } },
      select: { id: true },
    });
    if (!convo) return reply.send({ conversationId: null, messages: [], nextCursor: null });

    const messages = await prisma.message.findMany({
      where: { conversationId: convo.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const next = messages.pop();
      nextCursor = next?.id ?? null;
    }

    return reply.send({
      conversationId: convo.id,
      messages: messages, // Removed reverse()
      nextCursor,
    });
  });

  // List Conversations
  app.get("/conversations", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId: me } = req as any;

    const convos = await prisma.conversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        userA: { select: { id: true, username: true, avatarUrl: true } },
        userB: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Calculate unread count for each conversation
    const convosWithUnread = await Promise.all(convos.map(async (c) => {
      const unread = await prisma.message.count({
        where: {
          conversationId: c.id,
          read: false,
          senderId: { not: me } // Messages sent by others
        }
      });
      return { ...c, unreadCount: unread };
    }));

    return reply.send(convosWithUnread);
  });

  // Get Total Unread Count
  app.get("/messages/unread", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const count = await prisma.message.count({
      where: {
        conversation: {
          OR: [{ userAId: me }, { userBId: me }]
        },
        read: false,
        senderId: { not: me }
      }
    });
    return { count };
  });

  // Mark all messages in conversation as read
  app.post("/messages/read/:conversationId", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { conversationId } = req.params as any;

    await prisma.message.updateMany({
      where: {
        conversationId,
        read: false,
        senderId: { not: me }
      },
      data: { read: true }
    });

    return { success: true };
  });
}