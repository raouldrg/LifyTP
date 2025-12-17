import { FastifyInstance } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { hashPassword, comparePassword } from "../lib/password";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function authRoutes(app: FastifyInstance) {

  // === SEED ADMIN ACCOUNT (Run on startup logic or lazily here) ===
  const ensureAdmin = async () => {
    try {
      const adminEmail = "raouldrg@lify.me";
      const existingAdmin = await prisma.user.findFirst({
        where: { email: adminEmail }
      });

      if (!existingAdmin) {
        console.log("🌱 Seeding Admin Account: raouldrg@lify.me");
        const hashedPassword = await hashPassword("lify");
        await prisma.user.create({
          data: {
            email: adminEmail,
            username: "raouldrg",
            passwordHash: hashedPassword,
            provider: "EMAIL",
            providerId: `email-${adminEmail}`,
            avatarUrl: "https://ui-avatars.com/api/?name=Raoul+Drg&background=random",
            role: "ADMIN",
          }
        });
        console.log("✅ Admin seeded.");
      }
    } catch (error) {
      console.error("❌ Admin seed failed:", error);
    }
  };
  // Run it once
  ensureAdmin().catch(console.error);


  // === REGISTER (Email/Password) ===
  app.post("/auth/register", async (req, reply) => {
    const { email, password } = (req as any).body;

    if (!email || !password) {
      return reply.code(400).send({ error: "Email et mot de passe requis." });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      return reply.code(400).send({ error: "Email déjà utilisé." });
    }

    const hashedPassword = await hashPassword(password);
    // Temp username
    const tempUsername = `user_${Date.now()}`;

    const user = await prisma.user.create({
      data: {
        email,
        username: tempUsername,
        passwordHash: hashedPassword,
        provider: "EMAIL",
        providerId: `email-${email}`,
        avatarUrl: `https://ui-avatars.com/api/?name=${tempUsername}&background=random`
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "7d" }
    );

    return { accessToken: token, user, needsOnboarding: true };
  });

  // === LOGIN (Email OR Username) ===
  app.post("/auth/login", async (req, reply) => {
    const { email, password } = (req as any).body;

    if (!email || !password) {
      return reply.code(400).send({ error: "Identifiant et mot de passe requis." });
    }

    // Look for user by email OR username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: email }
        ]
      }
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: "Identifiants incorrects." });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Identifiants incorrects." });
    }

    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "7d" }
    );

    return { accessToken: token, user };
  });

  // === ONBOARDING: SET PSEUDO ===
  app.post("/auth/onboarding/pseudo", async (req, reply) => {
    const guard = await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const schema = z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_.]+$/),
    });

    try {
      const { username } = schema.parse((req as any).body);

      // Check collision
      const taken = await prisma.user.findUnique({ where: { username } });
      if (taken) return reply.code(409).send({ error: "Ce pseudo est déjà pris." });

      // Check last change limit (3 months)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.lastUsernameChange) {
        const diffTime = Math.abs(new Date().getTime() - new Date(user.lastUsernameChange).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 90) {
          return reply.code(403).send({ error: `Vous devez attendre ${90 - diffDays} jours avant de changer à nouveau.` });
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          username,
          lastUsernameChange: new Date()
        }
      });

      return { user: updated };
    } catch (err) {
      return reply.code(400).send({ error: "Pseudo invalide." });
    }
  });

  // === ONBOARDING: UPDATE PROFILE (BIO, AVATAR) ===
  app.post("/auth/onboarding/update", async (req, reply) => {
    const guard = await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const schema = z.object({
      bio: z.string().max(160).optional(),
      avatarUrl: z.string().url().optional(),
    });

    try {
      const { bio, avatarUrl } = schema.parse((req as any).body);

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(bio !== undefined && { bio }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        }
      });

      return { user: updated };
    } catch (err) {
      return reply.code(400).send({ error: "Données invalides." });
    }
  });

  // === EXISTING ROUTES (Google, Me, Dev Mock) ===

  app.post("/dev/mock-login", async (req, reply) => {
    try {
      const { email = "test@lify.app" } = ((req as any).body ?? {}) as any;
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Create mock user
        user = await prisma.user.create({
          data: {
            provider: "GOOGLE", // Mocking google
            providerId: "mock-" + Math.random().toString(36).slice(2),
            email,
            username: email.split("@")[0],
          }
        });
      }
      const token = jwt.sign({ sub: user.id }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "1h" });
      return { accessToken: token, user };
    } catch (e) {
      return reply.code(500).send({ error: "Mock failed" });
    }
  });

  app.post("/auth/google", async (req, reply) => {
    try {
      const { idToken } = ((req as any).body ?? {}) as any;
      if (!idToken) return reply.code(400).send({ error: "Missing idToken" });
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) return reply.code(401).send({ error: "Invalid token" });

      let user = await prisma.user.findUnique({ where: { providerId: payload.sub } });
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
      const token = jwt.sign({ sub: user.id }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "7d" });
      return { accessToken: token, user };
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Auth failed" });
    }
  });

  app.get("/me", async (req, reply) => {
    const guard = await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        _count: {
          select: {
            posts: true,
            Event: true,
            followedBy: true,
            following: true,
          }
        }
      },
    });

    if (!user) return reply.code(404).send({ error: "User not found" });

    return {
      user: {
        ...user,
        stats: {
          events: user._count.Event,
          followers: user._count.followedBy,
          following: user._count.following,
        }
      }
    };
  });
}
