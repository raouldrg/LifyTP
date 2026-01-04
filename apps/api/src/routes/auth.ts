import { FastifyInstance } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { hashPassword, comparePassword } from "../lib/password";
import crypto from 'crypto';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TOKEN_EXPIRY = "15m";

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  // Simple random token for refresh
  const refreshToken = jwt.sign({ sub: userId, type: "refresh", jti: crypto.randomUUID() }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "30d" });
  const tokenHash = hashToken(refreshToken);
  return { accessToken, refreshToken, tokenHash };
}

export default async function authRoutes(app: FastifyInstance) {

  // === SEED ADMIN ACCOUNT (Run on startup logic or lazily here) ===
  // === SEED ADMIN REMOVED (User request: No auto-create) ===


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

    // Generate Tokens
    const { accessToken, refreshToken, tokenHash } = generateTokens(user.id);

    // Persist Refresh Token
    await prisma.refreshToken.create({
      data: {
        tokenHash: tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
      }
    });

    return { accessToken, refreshToken, user, needsOnboarding: true };
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

    const { accessToken, refreshToken, tokenHash } = generateTokens(user.id);

    await prisma.refreshToken.create({
      data: {
        tokenHash: tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
      }
    });

    return { accessToken, refreshToken, user };
  });

  // === REFRESH TOKEN ===
  app.post("/auth/refresh", async (req, reply) => {
    const { refreshToken } = (req as any).body;
    if (!refreshToken) return reply.code(400).send({ error: "Refresh token requis" });

    const tokenHash = hashToken(refreshToken);

    // 1. Check if token exists in DB
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: tokenHash },
      include: { user: true } // Need user for re-generation
    });

    // 2. Security: REUSE DETECTION or Invalid token
    if (!storedToken) {
      // If it was a valid JWT but not in DB, it might be a reused token (if we kept history of revoked)
      // For MVP, if not found, just 401. 
      // Improvement: keep revoked tokens for a while to detect reuse.
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    // 3. Check if revoked
    if (storedToken.revoked) {
      // SECURITY ALERT: Reused revoked token!
      // Invalidate ALL tokens for this user family
      console.warn(`[Security] Revoked token reuse attempt for user ${storedToken.userId}. Revoking all sessions.`);
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { revoked: true }
      });
      return reply.code(403).send({ error: "Security alert: Session compromised" });
    }

    // 4. Check expiration
    if (new Date() > storedToken.expiresAt) {
      return reply.code(401).send({ error: "Refresh token expired" });
    }

    // 5. Verify signature (just in case)
    try {
      jwt.verify(refreshToken, process.env.JWT_ACCESS_SECRET!);
    } catch {
      return reply.code(401).send({ error: "Invalid token signature" });
    }

    // 6. ROTATION: Revoke used token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true }
    });

    // 7. Issue new pair
    const { accessToken: newAccess, refreshToken: newRefresh, tokenHash: newHash } = generateTokens(storedToken.userId);

    await prisma.refreshToken.create({
      data: {
        tokenHash: newHash,
        userId: storedToken.userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
      }
    });

    return { accessToken: newAccess, refreshToken: newRefresh };
  });

  // === LOGOUT ===
  app.post("/auth/logout", async (req, reply) => {
    const { refreshToken } = (req as any).body;
    if (refreshToken) {
      // Best effort revocation
      try {
        const tokenHash = hashToken(refreshToken);
        await prisma.refreshToken.updateMany({
          where: { tokenHash: tokenHash },
          data: { revoked: true }
        });
      } catch { }
    }
    return { success: true };
  });


  // === CHECK USERNAME ===
  app.get("/auth/check-username", async (req, reply) => {
    const { username } = (req.query as any);
    if (!username || username.length < 3) {
      return { available: false, error: "Trop court" };
    }

    // Check if taken
    const user = await prisma.user.findUnique({
      where: { username }
    });

    // Also check if it's the current user's username?
    // If auth is provided, we could check. But simple availability check:
    return { available: !user };
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
      avatarUrl: z.string().optional(), // Allow relative paths
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
    // 1. Guard: Only in development
    if (process.env.NODE_ENV !== "development") {
      return reply.code(404).send({ error: "Not Found" });
    }

    try {
      const { email = "test@lify.app" } = ((req as any).body ?? {}) as any;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return reply.code(401).send({ error: "User not found. Auto-create is disabled." });
      }
      const { accessToken, refreshToken, tokenHash } = generateTokens(user.id);

      // Upsert mock token for dev ease
      await prisma.refreshToken.create({
        data: {
          tokenHash: tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
        }
      });

      return { accessToken, refreshToken, user };
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
      const { accessToken, refreshToken, tokenHash } = generateTokens(user.id);

      await prisma.refreshToken.create({
        data: {
          tokenHash: tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
        }
      });

      return { accessToken, refreshToken, user };
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
        displayName: true,
        avatarUrl: true,
        avatarColor: true,
        bio: true,
        isPrivate: true,
        lastUsernameChange: true,
        lastDisplayNameChange: true,
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

  // === UPDATE PROFILE (displayName, username, bio) ===
  app.patch("/users/me", async (req, reply) => {
    const guard = await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const schema = z.object({
      displayName: z.string().min(1).max(50).optional(),
      username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_.]+$/).optional(),
      bio: z.string().max(250).optional(),
      isPrivate: z.boolean().optional(),
      avatarUrl: z.string().nullable().optional(),
      avatarColor: z.string().nullable().optional(),
    });

    try {
      const { displayName, username, bio, isPrivate, avatarUrl, avatarColor } = schema.parse((req as any).body);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const now = new Date();
      const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      // Check username (handle) cooldown - 6 months
      if (username && username !== user.username) {
        if (user.lastUsernameChange) {
          const diff = now.getTime() - new Date(user.lastUsernameChange).getTime();
          if (diff < SIX_MONTHS_MS) {
            const daysLeft = Math.ceil((SIX_MONTHS_MS - diff) / (1000 * 60 * 60 * 24));
            return reply.code(403).send({
              error: `Vous devez attendre ${daysLeft} jours avant de changer votre @.`
            });
          }
        }
        // Check if username is taken
        const taken = await prisma.user.findUnique({ where: { username } });
        if (taken && taken.id !== userId) {
          return reply.code(409).send({ error: "Ce @ est déjà pris." });
        }
      }

      // Check displayName (pseudo) cooldown - 1 day
      if (displayName && displayName !== user.displayName) {
        if (user.lastDisplayNameChange) {
          const diff = now.getTime() - new Date(user.lastDisplayNameChange).getTime();
          if (diff < ONE_DAY_MS) {
            const hoursLeft = Math.ceil((ONE_DAY_MS - diff) / (1000 * 60 * 60));
            return reply.code(403).send({
              error: `Vous devez attendre ${hoursLeft}h avant de changer votre pseudo.`
            });
          }
        }
      }

      // Build update data
      const updateData: any = {};
      if (bio !== undefined) updateData.bio = bio;
      if (isPrivate !== undefined) {
        updateData.isPrivate = isPrivate;
      }
      if (avatarColor !== undefined) updateData.avatarColor = avatarColor;

      // Avatar URL logic
      if (avatarUrl === null) {
        updateData.avatarUrl = null;
      } else if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      if (username && username !== user.username) {
        updateData.username = username;
        updateData.lastUsernameChange = now;
      }
      if (displayName && displayName !== user.displayName) {
        updateData.displayName = displayName;
        updateData.lastDisplayNameChange = now;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          isPrivate: true,
          lastUsernameChange: true,
          lastDisplayNameChange: true,
        }
      });

      return { user: updated };
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.code(400).send({ error: "Données invalides." });
      }
      throw err;
    }
  });
}
