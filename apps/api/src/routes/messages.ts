import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function messageRoutes(app: FastifyInstance) {

  // ==============================
  // HELPER: Find or create conversation with participants (LAZY - only on message send)
  // ==============================
  const findOrCreateConversationWithParticipants = async (senderId: string, recipientId: string) => {
    const [userAId, userBId] = [senderId, recipientId].sort();

    // Try to find existing conversation
    let convo = await prisma.conversation.findUnique({
      where: { unique_pair: { userAId, userBId } },
      include: { participants: true }
    });

    if (convo) {
      // Ensure participants exist (migration safety)
      const existingParticipantUserIds = convo.participants.map(p => p.userId);
      const missingUserIds = [userAId, userBId].filter(id => !existingParticipantUserIds.includes(id));

      for (const userId of missingUserIds) {
        await prisma.conversationParticipant.create({
          data: { conversationId: convo.id, userId }
        });
      }

      // "Unhide" conversation for both users (reset lastDeletedAt)
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: convo.id },
        data: { lastDeletedAt: null }
      });

      return convo;
    }

    // Create new conversation - check if it should be a REQUEST
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { isPrivate: true }
    });

    const isFollowing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: senderId, followingId: recipientId } }
    });

    const isRequest = recipient?.isPrivate && !isFollowing;
    console.log(`[Conversation] Creating ${isRequest ? 'REQUEST' : 'NORMAL'} conversation: ${senderId} -> ${recipientId}`);

    convo = await prisma.conversation.create({
      data: {
        userAId,
        userBId,
        status: isRequest ? 'REQUEST' : 'NORMAL',
        // Request tracking fields
        requestSenderId: isRequest ? senderId : null,
        requestReceiverId: isRequest ? recipientId : null,
        requestCreatedAt: isRequest ? new Date() : null,
        initiatedByUserId: isRequest ? senderId : null,  // Legacy compatibility
        participants: {
          create: [
            { userId: userAId },
            { userId: userBId }
          ]
        }
      },
      include: { participants: true }
    });

    return convo;
  };

  // ==============================
  // POST /messages/to/:otherUserId - Send message (CREATES conversation lazily)
  // ==============================
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

      const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
      if (!otherUser) return reply.code(404).send({ error: "User not found" });

      // Check if conversation exists and has blocking status
      const [userAId, userBId] = [me, otherUserId].sort();
      const existingConvo = await prisma.conversation.findUnique({
        where: { unique_pair: { userAId, userBId } }
      });

      if (existingConvo) {
        // Block if REJECTED
        if (existingConvo.status === 'REJECTED') {
          console.log(`[Message] BLOCKED: Conversation ${existingConvo.id} is REJECTED`);
          return reply.code(403).send({ error: "Cette demande a été refusée" });
        }

        // Block if REQUEST and sender is the receiver (must accept first)
        if (existingConvo.status === 'REQUEST' && existingConvo.requestReceiverId === me) {
          console.log(`[Message] BLOCKED: Receiver ${me} must accept request first`);
          return reply.code(403).send({ error: "Acceptez d'abord la demande de message" });
        }
      }

      // LAZY CREATION: Only create conversation when sending first message
      const convo = await findOrCreateConversationWithParticipants(me, otherUserId);

      const messageContent = content ? String(content).trim() : null;
      const message = await prisma.message.create({
        data: {
          conversation: { connect: { id: convo.id } },
          sender: { connect: { id: me } },
          content: messageContent,
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

      // Update conversation metadata
      const preview = messageContent?.substring(0, 50) || (mediaUrl ? "[Media]" : "");
      await prisma.conversation.update({
        where: { id: convo.id },
        data: {
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          lastMessagePreview: preview
        }
      });

      // Emit via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io) {
        const payload = {
          id: message.id,
          conversationId: convo.id,
          conversationStatus: convo.status,
          senderId: me,
          recipientId: otherUser.id,
          content: message.content,
          mediaUrl: message.mediaUrl,
          duration: message.duration,
          type: message.type,
          replyTo: message.replyTo,
          createdAt: message.createdAt,
        };

        if (convo.status === 'REQUEST') {
          // Notify recipient as a request
          io.to(otherUserId).emit("conversation:request:new", payload);
        } else {
          io.to(otherUserId).emit("message:new", payload);
        }
        io.to(me).emit("message:new", payload);
      }

      return reply.code(201).send({
        conversation: convo,
        message,
        conversationStatus: convo.status,
        isRequest: convo.status === 'REQUEST',
        isInitiator: convo.initiatedByUserId === me
      });
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
    const since = (req.query as any)?.since as string | undefined;

    const [userAId, userBId] = [me, otherUserId].sort();
    const convo = await prisma.conversation.findUnique({
      where: { unique_pair: { userAId, userBId } },
      select: { id: true },
    });
    if (!convo) return reply.send({ conversationId: null, messages: [], nextCursor: null });

    const messages = await prisma.message.findMany({
      where: {
        conversationId: convo.id,
        ...(since ? { createdAt: { gt: new Date(since) } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        replyTo: { include: { sender: true } },
        reactions: {
          select: { id: true, userId: true, emoji: true }
        }
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

  // ==============================
  // LIST CONVERSATIONS (role-based filtering for REQUEST/REJECTED)
  // ==============================
  app.get("/conversations", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId: me } = req as any;

    // Get all conversations where user is participant with at least one message
    const allConvos = await prisma.conversation.findMany({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
        lastMessageAt: { not: null }
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        userA: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        userB: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        participants: { where: { userId: me }, select: { lastDeletedAt: true } }
      },
    });

    // Role-based filtering:
    // - If user is requestReceiverId -> EXCLUDE REQUEST and REJECTED (they go to Demandes)
    // - If user is requestSenderId -> INCLUDE REQUEST and REJECTED (show En attente / Refusé)
    // - NORMAL status -> always include
    const filtered = allConvos.filter(c => {
      // Always exclude if soft-deleted and no new messages
      const myParticipant = c.participants[0];
      if (myParticipant?.lastDeletedAt && c.lastMessageAt && c.lastMessageAt <= myParticipant.lastDeletedAt) {
        return false;
      }

      // NORMAL status: always include
      if (c.status === 'NORMAL') return true;

      // REQUEST or REJECTED: include only if user is the sender
      if (c.status === 'REQUEST' || c.status === 'REJECTED') {
        return c.requestSenderId === me;
      }

      return true;
    });

    const convosWithUnread = await Promise.all(filtered.map(async (c) => {
      const unread = await prisma.message.count({
        where: { conversationId: c.id, read: false, senderId: { not: me } }
      });

      // Add request info for UI
      const isSender = c.requestSenderId === me;
      const isReceiver = c.requestReceiverId === me;

      return {
        ...c,
        unreadCount: unread,
        requestInfo: {
          isSender,
          isReceiver,
          isPending: c.status === 'REQUEST' && isSender,
          isRejected: c.status === 'REJECTED' && isSender
        }
      };
    }));

    return reply.send(convosWithUnread);
  });

  // ==============================
  // MESSAGE REQUESTS (Private Profiles)
  // ==============================

  // GET /conversations/with/:userId - Get existing conversation (NO CREATION)
  app.get("/conversations/with/:userId", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { userId: otherUserId } = req.params as any;

    if (me === otherUserId) {
      return reply.code(400).send({ error: "Cannot get conversation with yourself" });
    }

    try {
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { id: true, username: true, displayName: true, avatarUrl: true, isPrivate: true }
      });

      if (!otherUser) {
        return reply.code(404).send({ error: "User not found" });
      }

      // Find existing conversation (DO NOT CREATE)
      const [userAId, userBId] = [me, otherUserId].sort();
      const convo = await prisma.conversation.findUnique({
        where: { unique_pair: { userAId, userBId } }
      });

      if (!convo) {
        // No conversation exists - return null (mobile will handle draft mode)
        return reply.send({
          conversation: null,
          otherUser,
          isRequest: otherUser.isPrivate,
          isInitiator: true
        });
      }

      // Conversation exists
      return reply.send({
        conversation: convo,
        otherUser,
        isRequest: convo.status === 'REQUEST',
        isInitiator: convo.initiatedByUserId === me
      });
    } catch (e) {
      console.error("FAILED TO GET CONVERSATION:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // ==============================
  // MESSAGE REQUESTS LIST
  // ==============================

  // GET /conversations/requests/inbox - Requests received (user is NOT the initiator)
  app.get("/conversations/requests/inbox", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;

    try {
      const requests = await prisma.conversation.findMany({
        where: {
          OR: [{ userAId: me }, { userBId: me }],
          status: 'REQUEST',
          // Received requests: user is NOT the initiator
          NOT: { initiatedByUserId: me },
          lastMessageAt: { not: null }
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          userA: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          userB: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      const requestsWithUnread = await Promise.all(requests.map(async (c) => {
        const unread = await prisma.message.count({
          where: { conversationId: c.id, read: false, senderId: { not: me } }
        });
        return { ...c, unreadCount: unread };
      }));

      return reply.send(requestsWithUnread);
    } catch (e) {
      console.error("FAILED TO GET MESSAGE REQUESTS INBOX:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // GET /conversations/requests/sent - Requests sent (user IS the initiator)
  app.get("/conversations/requests/sent", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;

    try {
      const requests = await prisma.conversation.findMany({
        where: {
          OR: [{ userAId: me }, { userBId: me }],
          status: 'REQUEST',
          // Sent requests: user IS the initiator
          initiatedByUserId: me,
          lastMessageAt: { not: null }
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          userA: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          userB: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      const requestsWithData = await Promise.all(requests.map(async (c) => {
        return { ...c, status: 'pending' }; // Outgoing requests are "pending"
      }));

      return reply.send(requestsWithData);
    } catch (e) {
      console.error("FAILED TO GET MESSAGE REQUESTS SENT:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // Legacy: /requests still works (alias for inbox)
  app.get("/conversations/requests", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;

    try {
      const requests = await prisma.conversation.findMany({
        where: {
          OR: [{ userAId: me }, { userBId: me }],
          status: 'REQUEST',
          NOT: { initiatedByUserId: me },
          lastMessageAt: { not: null }
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          userA: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          userB: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      const requestsWithUnread = await Promise.all(requests.map(async (c) => {
        const unread = await prisma.message.count({
          where: { conversationId: c.id, read: false, senderId: { not: me } }
        });
        return { ...c, unreadCount: unread };
      }));

      return reply.send(requestsWithUnread);
    } catch (e) {
      console.error("FAILED TO GET MESSAGE REQUESTS:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // GET /conversations/requests/count - Count of inbox requests (for badge)
  app.get("/conversations/requests/count", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;

    const count = await prisma.conversation.count({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
        status: 'REQUEST',
        NOT: { initiatedByUserId: me },
        lastMessageAt: { not: null }
      }
    });

    return { count };
  });

  // Accept a message request
  app.post("/conversations/:conversationId/accept", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { conversationId } = req.params as any;

    try {
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, userAId: true, userBId: true, status: true, initiatedByUserId: true }
      });

      if (!convo) {
        return reply.code(404).send({ error: "Conversation not found" });
      }

      // Verify user is a participant
      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.code(403).send({ error: "Not a participant of this conversation" });
      }

      // Verify user is the receiver (not initiator)
      if (convo.initiatedByUserId === me) {
        return reply.code(403).send({ error: "Cannot accept your own request" });
      }

      // Verify it's actually a request (can also re-accept after rejection)
      if (convo.status !== 'REQUEST' && convo.status !== 'REJECTED') {
        return reply.code(400).send({ error: "Conversation is not a request" });
      }

      // Accept the request
      console.log(`[Accept] Accepting message request ${conversationId}`);
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'NORMAL',
          requestAcceptedAt: new Date(),
          requestRejectedAt: null  // Clear any previous rejection
        }
      });

      // Notify initiator via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io && convo.initiatedByUserId) {
        io.to(convo.initiatedByUserId).emit("conversation:request:accepted", {
          conversationId,
          acceptedBy: me
        });
      }

      return { success: true };
    } catch (e) {
      console.error("FAILED TO ACCEPT MESSAGE REQUEST:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // Decline/delete a message request
  app.delete("/conversations/:conversationId/request", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { conversationId } = req.params as any;

    try {
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, userAId: true, userBId: true, status: true, initiatedByUserId: true }
      });

      if (!convo) {
        return reply.code(404).send({ error: "Conversation not found" });
      }

      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.code(403).send({ error: "Not a participant of this conversation" });
      }

      // Verify user is the receiver
      if (convo.initiatedByUserId === me) {
        return reply.code(403).send({ error: "Cannot reject your own request" });
      }

      if (convo.status !== 'REQUEST') {
        return reply.code(400).send({ error: "Conversation is not a request" });
      }

      // Reject the request (DO NOT DELETE - just set REJECTED status)
      console.log(`[Reject] Rejecting message request ${conversationId}`);
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'REJECTED',
          requestRejectedAt: new Date()
        }
      });

      // Notify sender via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io && convo.initiatedByUserId) {
        io.to(convo.initiatedByUserId).emit("conversation:request:rejected", {
          conversationId,
          rejectedBy: me
        });
      }

      return { success: true };
    } catch (e) {
      console.error("FAILED TO REJECT MESSAGE REQUEST:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
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

  // ==============================
  // DELETE CONVERSATION (soft-delete via participant)
  // ==============================
  app.delete("/conversations/:conversationId", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { conversationId } = req.params as any;

    try {
      // Verify the conversation exists and user is a participant
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, userAId: true, userBId: true }
      });

      if (!convo) {
        return reply.code(404).send({ error: "Conversation not found" });
      }

      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.code(403).send({ error: "Not a participant of this conversation" });
      }

      // Soft-delete: set lastDeletedAt on participant record
      await prisma.conversationParticipant.updateMany({
        where: { conversationId, userId: me },
        data: { lastDeletedAt: new Date() }
      });

      return { success: true };
    } catch (e) {
      console.error("FAILED TO DELETE CONVERSATION:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // ==============================
  // MESSAGE REACTIONS
  // ==============================

  // Add or replace reaction
  app.post("/messages/:messageId/reactions", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { messageId } = req.params as any;
    const { emoji } = req.body as any;

    if (!emoji || typeof emoji !== 'string') {
      return reply.code(400).send({ error: "Emoji is required" });
    }

    try {
      // Verify message exists and user can react
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: { select: { userAId: true, userBId: true } } }
      });

      if (!message) {
        return reply.code(404).send({ error: "Message not found" });
      }

      const convo = message.conversation;
      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.code(403).send({ error: "Not a participant of this conversation" });
      }

      // Upsert reaction (one per user per message)
      const reaction = await prisma.messageReaction.upsert({
        where: { messageId_userId: { messageId, userId: me } },
        update: { emoji },
        create: { messageId, userId: me, emoji }
      });

      // Broadcast via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io) {
        const otherId = convo.userAId === me ? convo.userBId : convo.userAId;
        const payload = { messageId, reaction: { id: reaction.id, userId: me, emoji } };
        io.to(otherId).emit("reaction:added", payload);
        io.to(me).emit("reaction:added", payload);
      }

      return { reaction };
    } catch (e) {
      console.error("FAILED TO ADD REACTION:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // Remove my reaction
  app.delete("/messages/:messageId/reactions", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { messageId } = req.params as any;

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: { select: { userAId: true, userBId: true } } }
      });

      if (!message) {
        return reply.code(404).send({ error: "Message not found" });
      }

      const convo = message.conversation;
      if (convo.userAId !== me && convo.userBId !== me) {
        return reply.code(403).send({ error: "Not a participant of this conversation" });
      }

      await prisma.messageReaction.deleteMany({
        where: { messageId, userId: me }
      });

      // Broadcast via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io) {
        const otherId = convo.userAId === me ? convo.userBId : convo.userAId;
        const payload = { messageId, userId: me };
        io.to(otherId).emit("reaction:removed", payload);
        io.to(me).emit("reaction:removed", payload);
      }

      return { success: true };
    } catch (e) {
      console.error("FAILED TO REMOVE REACTION:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // ==============================
  // EDIT MESSAGE
  // ==============================

  // Edit message content (text only, sender only)
  app.patch("/messages/:messageId", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { messageId } = req.params as any;
    const { content } = req.body as any;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return reply.code(400).send({ error: "Content is required" });
    }

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: { select: { userAId: true, userBId: true } } }
      });

      if (!message) {
        return reply.code(404).send({ error: "Message not found" });
      }

      if (message.senderId !== me) {
        return reply.code(403).send({ error: "Cannot edit messages you didn't send" });
      }

      if (message.type !== 'TEXT') {
        return reply.code(400).send({ error: "Only text messages can be edited" });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content: content.trim(), editedAt: new Date() }
      });

      // Broadcast via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io) {
        const convo = message.conversation;
        const otherId = convo.userAId === me ? convo.userBId : convo.userAId;
        const payload = { messageId, content: updated.content, editedAt: updated.editedAt };
        io.to(otherId).emit("message:edited", payload);
        io.to(me).emit("message:edited", payload);
      }

      return { message: updated };
    } catch (e) {
      console.error("FAILED TO EDIT MESSAGE:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });

  // ==============================
  // DELETE MESSAGE (SOFT DELETE)
  // ==============================

  // DELETE /messages/:messageId - Soft delete message
  app.delete("/messages/:messageId", { preHandler: requireAuth }, async (req: any, reply) => {
    const { userId: me } = req as any;
    const { messageId } = req.params as any;

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: { select: { userAId: true, userBId: true } } }
      });

      if (!message) {
        return reply.code(404).send({ error: "Message not found" });
      }

      if (message.senderId !== me) {
        return reply.code(403).send({ error: "Cannot delete messages you didn't send" });
      }

      // Soft delete: set deletedAt and clear content
      await prisma.message.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          content: null // Clear content for privacy
        }
      });

      // Broadcast via socket
      const io = (app as any).io as import("socket.io").Server | undefined;
      if (io) {
        const convo = message.conversation;
        const otherId = convo.userAId === me ? convo.userBId : convo.userAId;
        const payload = { messageId };
        io.to(otherId).emit("message:deleted", payload);
        io.to(me).emit("message:deleted", payload);
      }

      return { success: true };
    } catch (e) {
      console.error("FAILED TO DELETE MESSAGE:", e);
      return reply.code(500).send({ error: "Internal Server Error", details: String(e) });
    }
  });
}