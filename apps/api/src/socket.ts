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
  });

  app.log.info("✅ Socket.io initialized");
}