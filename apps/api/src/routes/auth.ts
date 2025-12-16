import { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function authRoutes(app: FastifyInstance) {
  // --- Fake login (Sprint 0 placeholder)
  app.post("/auth/login", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(3),
    });
    const body = bodySchema.parse((req as any).body);
    const token = randomUUID();
    const userId = randomUUID();
    return { token, userId, displayName: body.email.split("@")[0] };
  });

  // === Sprint 1: DEV mock login
  app.post("/dev/mock-login", async (req, reply) => {
    try {
      const { email = "test@lify.app" } = ((req as any).body ?? {}) as any;
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const base =
          ((req as any).body?.username as string) ||
          email.split("@")[0] ||
          "user";
        // Simple sanitization
        const sanitizedBase = base.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";

        let username = sanitizedBase;
        let suffix = 1;

        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${sanitizedBase}${suffix++}`;
        }

        user = await prisma.user.create({
          data: {
            provider: "GOOGLE",
            providerId: "mock-" + Math.random().toString(36).slice(2),
            email,
            username,
            avatarUrl: null,
          },
        });
      }
      const token = jwt.sign(
        { sub: user.id },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "1h" }
      );
      return { accessToken: token, user };
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Mock login failed" });
    }
  });

  // === Sprint 1: Auth Google
  app.post("/auth/google", async (req, reply) => {
    try {
      const { idToken } = ((req as any).body ?? {}) as any;
      if (!idToken) return reply.code(400).send({ error: "Missing idToken" });
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub)
        return reply.code(401).send({ error: "Invalid token" });

      let user = await prisma.user.findUnique({
        where: { providerId: payload.sub },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            provider: "GOOGLE",
            providerId: payload.sub,
            email: payload.email ?? null,
            username: payload.name ?? null,
            avatarUrl: payload.picture ?? null,
          },
        });
      }
      const token = jwt.sign(
        { sub: user.id },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "1h" }
      );
      return { accessToken: token, user };
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Auth failed" });
    }
  });

  // === Route protégée /me
  app.get("/me", async (req, reply) => {
    const guard = await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, avatarUrl: true },
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    return { user };
  });
}
