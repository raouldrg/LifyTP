import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { FastifyInstance } from "fastify";

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
  }

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      socket.join(userId);
      // app.log.info(`Socket joined room: ${userId}`);
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