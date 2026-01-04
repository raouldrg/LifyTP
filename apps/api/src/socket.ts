import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";

interface AuthPayload {
  sub: string;
}

export async function setupSocketIO(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: { origin: "*" },
  });

  (app as any).io = io;

  try {
    const pubClient = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => app.log.warn(`Redis Pub Error: ${err.message}`));
    subClient.on("error", (err) => app.log.warn(`Redis Sub Error: ${err.message}`));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient as any, subClient as any));
    app.log.info("✅ Redis Adapter connected");
  } catch (e) {
    app.log.warn("⚠️ Redis not available, falling back to in-memory Socket.io");
    app.log.warn("⚠️ Redis not available, falling back to in-memory Socket.io");
  }

  // === MIDDLEWARE: AUTHENTICATION ===
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Unauthorized: No token provided"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AuthPayload;
      // Attach userId to socket for easy access
      (socket as any).userId = payload.sub;
      next();
    } catch (err) {
      return next(new Error("Unauthorized: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    // Auto-join user room on connection
    if (userId) {
      socket.join(userId);
      // app.log.info(`Socket authenticated & auto-joined: ${userId}`);
    }

    socket.on("join", (requestedId) => {
      // Redundant if we auto-join, but kept for compatibility or specific room logic?
      // Ideally we restrict joining OTHER user rooms. 
      // For now, allow compatibility but we rely on auto-join.
      if (requestedId === userId) {
        socket.join(requestedId);
      } else {
        // Optional: warn or block joining other user's room
      }
    });

    socket.on("message", (data) => {
      io.emit("message", data);
    });

    socket.on("message:ack", async ({ messageId, userId }) => {
      // userId is senderId (who needs to know it's delivered)
      try {
        // Note: In real app, we'd use prisma here directly or via event bus
        // Since we don't have prisma import easily here, we'll assume the API does it?
        // Wait, I can import prisma. 
        // However, socket.ts usually shouldn't depend on Prisma directly if separate.
        // But this is a monolith. Let's assume we can emit to sender.

        // We need to update DB. Let's rely on client to call an API? 
        // Better: socket handles it if we import prisma.
        const { prisma } = require("./lib/prisma"); // Lazy require to avoid circular deps if any

        await prisma.message.update({
          where: { id: messageId },
          data: { delivered: true }
        });

        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (msg) {
          io.to(msg.senderId).emit("message:updated", {
            id: msg.id,
            delivered: true,
            read: msg.read
          });
        }

      } catch (e) {
        console.error("Ack error", e);
      }
    });
  });

  app.log.info("✅ Socket.io initialized");
}