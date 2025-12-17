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
    const { content, mediaUrl, type, duration, replyToId } = (req.body as any) || {};

    try {
      if ((!content || !String(content).trim()) && !mediaUrl) {
        return reply.code(400).send({ error: "Message content or media is required" });
      }

      // Validate User and Get Conversation
      const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
      if (!otherUser) return reply.code(404).send({ error: "User not found" });

      const convo = await getOrCreateConversation(me, otherUserId);

      const message = await prisma.message.create({
        data: {
          conversation: { connect: { id: convo.id } },
          sender: { connect: { id: me } },
          content: content ? String(content).trim() : null,
          mediaUrl: mediaUrl || null,
          duration: duration ? Number(duration) : null,
          type: type || "TEXT",
          read: false,
          ...(replyToId ? { replyTo: { connect: { id: replyToId } } } : {}),
        },
        include: {
          sender: true,
          replyTo: { include: { sender: true } }
        }
      });

      // Émission temps réel privée
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io) {
        const payload = {
          id: message.id,
          conversationId: convo.id,
          senderId: me,
          recipientId: otherUser.id,
          content: message.content,
          mediaUrl: message.mediaUrl,
          duration: message.duration,
          type: message.type,
          replyTo: message.replyTo, // Include reply context
          createdAt: message.createdAt,
        };

        // Send to recipient
        io.to(otherUserId).emit("message:new", payload);
        // Send to self (for multi-device sync)
        io.to(me).emit("message:new", payload);
      }

      return reply.code(201).send({ conversation: convo, message });
    } catch (e) {
      console.error("FAILED TO SEND MESSAGE:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
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
      include: {
        replyTo: { include: { sender: true } }
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const next = messages.pop();
      nextCursor = next?.id ?? null;
    }

    return reply.send({
      conversationId: convo.id,
      messages: messages,
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
      data: { read: true, delivered: true } // Read implies delivered
    });

    // Notify sender that messages are read
    const io = (app as any).io as import("socket.io").Server | undefined;
    if (io) {
      // Find the other user ID (sender of the unread messages)
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userAId: true, userBId: true }
      });
      if (convo) {
        const otherId = convo.userAId === me ? convo.userBId : convo.userAId;
        io.to(otherId).emit("message:read", { conversationId, readerId: me });
      }
    }

    return { success: true };
  });

  // Heal Duration (Update duration for existing zero-duration messages)
  app.patch("/messages/:id/duration", { preHandler: requireAuth }, async (req: any, reply) => {
    const { id } = req.params;
    const { duration } = req.body as any;

    if (!duration) return reply.code(400).send({ error: "Duration required" });

    await prisma.message.update({
      where: { id },
      data: { duration: Number(duration) }
    });

    return { success: true };
  });
}