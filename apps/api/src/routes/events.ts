import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { randomUUID } from "node:crypto";

const VISIBILITIES = ["PRIVATE", "FRIENDS", "LINK", "PUBLIC"] as const;
type Visibility = typeof VISIBILITIES[number];

export default async function eventRoutes(app: FastifyInstance) {
  // 🟢 Créer un événement (+ host auto) - supports recurrence
  app.post("/events", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    try {
      const {
        title, description, startAt, endAt, isPrivate, themeId, colorHex,
        recurrenceType, recurrenceEndAt
      } = req.body as {
        title: string;
        description?: string;
        startAt: string;
        endAt?: string;
        isPrivate?: boolean;
        themeId?: string;
        colorHex?: string;
        recurrenceType?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        recurrenceEndAt?: string;
      };

      const startDate = new Date(startAt);
      const endDate = endAt ? new Date(endAt) : null;
      const duration = endDate ? endDate.getTime() - startDate.getTime() : 0;

      // Generate recurring instances if recurrence is enabled
      const isRecurring = recurrenceType && recurrenceType !== "NONE" && recurrenceEndAt;
      const recurrenceGroupId = isRecurring ? randomUUID() : null;
      const recurrenceEnd = recurrenceEndAt ? new Date(recurrenceEndAt) : null;

      const eventsToCreate: Array<{
        startAt: Date;
        endAt: Date | null;
      }> = [];

      if (isRecurring && recurrenceEnd) {
        let currentStart = new Date(startDate);
        const maxInstances = 52; // Safety limit: 1 year of weekly events

        while (currentStart <= recurrenceEnd && eventsToCreate.length < maxInstances) {
          eventsToCreate.push({
            startAt: new Date(currentStart),
            endAt: duration ? new Date(currentStart.getTime() + duration) : null,
          });

          // Advance to next occurrence
          switch (recurrenceType) {
            case "DAILY":
              currentStart.setDate(currentStart.getDate() + 1);
              break;
            case "WEEKLY":
              currentStart.setDate(currentStart.getDate() + 7);
              break;
            case "MONTHLY":
              currentStart.setMonth(currentStart.getMonth() + 1);
              break;
            case "YEARLY":
              currentStart.setFullYear(currentStart.getFullYear() + 1);
              break;
          }
        }
      } else {
        // Single event
        eventsToCreate.push({ startAt: startDate, endAt: endDate });
      }

      // Create all events
      const createdEvents = [];
      for (const eventData of eventsToCreate) {
        const event = await prisma.event.create({
          data: {
            title,
            description,
            startAt: eventData.startAt,
            endAt: eventData.endAt,
            isPrivate: isPrivate ?? true,
            ownerId: userId,
            themeId: themeId || null,
            colorHex: colorHex || null,
            recurrenceType: recurrenceType || "NONE",
            recurrenceEndAt: recurrenceEnd,
            recurrenceGroupId,
          },
        });

        // Host auto for each instance
        await prisma.participant.create({
          data: { eventId: event.id, userId, role: "HOST", status: "GOING" },
        });

        createdEvents.push(event);
      }

      // Return first event (or all if recurring)
      return reply.send(isRecurring ? createdEvents : createdEvents[0]);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: "Erreur lors de la création" });
    }
  });

  // 🟡 Lister les événements de l’utilisateur
  app.get("/events", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const events = await prisma.event.findMany({
      where: { ownerId: userId },
      orderBy: { startAt: "asc" },
    });
    return reply.send(events);
  });

  // 🟠 Supprimer un événement (supports ?deleteAll=true for recurring series)
  app.delete("/events/:id", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { id } = req.params as { id: string };
    const { deleteAll } = req.query as { deleteAll?: string };

    try {
      // Check if we need to delete all recurring instances
      if (deleteAll === "true") {
        const event = await prisma.event.findUnique({
          where: { id },
          select: { recurrenceGroupId: true }
        });

        if (event?.recurrenceGroupId) {
          await prisma.event.deleteMany({
            where: { recurrenceGroupId: event.recurrenceGroupId }
          });
          return reply.send({ success: true, deletedAll: true });
        }
      }

      // Delete single event
      await prisma.event.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.status(404).send({ error: "Événement non trouvé" });
    }
  });

  // 🟣 Mettre à jour un événement
  app.put("/events/:id", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;
    const { id } = req.params as { id: string };

    try {
      const { title, description, startAt, endAt, isPrivate, themeId, colorHex } = (req.body ?? {}) as {
        title?: string; description?: string; startAt?: string; endAt?: string | null; isPrivate?: boolean;
        themeId?: string | null; colorHex?: string | null;
      };

      const existing = await prisma.event.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
      if (!existing) return reply.code(404).send({ error: "Événement non trouvé" });

      const updated = await prisma.event.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(startAt !== undefined ? { startAt: new Date(startAt) } : {}),
          ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
          ...(isPrivate !== undefined ? { isPrivate } : {}),
          ...(themeId !== undefined ? { themeId } : {}),
          ...(colorHex !== undefined ? { colorHex } : {}),
        },
      });

      return reply.send(updated);
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Erreur lors de la mise à jour" });
    }
  });

  // 🔵 Timeline (groupée par date Europe/Paris)
  app.get("/events/timeline", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const { from, to } = (req.query ?? {}) as { from?: string; to?: string };
    const where: any = { ownerId: userId };
    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
      if (to) where.startAt.lte = new Date(to);
    }

    const events = await prisma.event.findMany({ where, orderBy: { startAt: "asc" } });

    const fmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
    const toYmd = (d: Date) => {
      const p = fmt.formatToParts(d);
      const y = p.find(t => t.type === "year")?.value;
      const m = p.find(t => t.type === "month")?.value;
      const dd = p.find(t => t.type === "day")?.value;
      return `${y}-${m}-${dd}`;
    };

    const grouped: Record<string, typeof events> = {};
    for (const e of events) {
      const k = toYmd(new Date(e.startAt));
      (grouped[k] ||= []).push(e);
    }
    return reply.send(grouped);
  });

  // === Lister les participants d'un événement
  app.get("/events/:id/participants", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;
    const { id } = req.params as { id: string };

    const event = await prisma.event.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
    if (!event) return reply.code(404).send({ error: "Événement non trouvé" });

    const participants = await prisma.participant.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, role: true, status: true, createdAt: true,
        user: { select: { id: true, email: true, username: true, avatarUrl: true } },
      },
    });
    return reply.send(participants);
  });

  // === Inviter un utilisateur par email à un événement (+ notif mock si opt-in)
  app.post("/events/:id/participants", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;
    const { id } = req.params as { id: string };

    const { email, role } = (req.body ?? {}) as { email?: string; role?: "HOST" | "GUEST" };
    if (!email) return reply.code(400).send({ error: "Email requis" });

    const event = await prisma.event.findFirst({ where: { id, ownerId: userId }, select: { id: true, title: true } });
    if (!event) return reply.code(404).send({ error: "Événement non trouvé" });

    let invited = await prisma.user.findUnique({ where: { email } });
    if (!invited) {
      invited = await prisma.user.create({
        data: { provider: "invite", providerId: "invite-" + randomUUID(), email, username: email.split("@")[0], avatarUrl: null },
      });
    }

    try {
      const participant = await prisma.participant.create({
        data: { eventId: id, userId: invited.id, role: role ?? "GUEST", status: "INVITED" },
        select: { id: true, role: true, status: true, user: { select: { id: true, email: true, username: true, avatarUrl: true } } },
      });

      // 🔔 Notification d'invitation (mock) — seulement si opt-in du destinataire
      const pref = await prisma.userPreference.findUnique({ where: { userId: invited.id } });

      let notification: any = null;
      if (pref?.notificationOptIn) {
        notification = await prisma.notification.create({
          data: {
            userId: invited.id,
            type: "INVITE",
            title: `Invitation: ${event.title}`,
            message: `Tu as été invité à "${event.title}"`,
            eventId: event.id,
          },
          select: { id: true, type: true, title: true, message: true, eventId: true, read: true, createdAt: true },
        });
      }

      return reply.code(201).send({ participant, notification });
    } catch (err: any) {
      if (err?.code === "P2002") return reply.code(409).send({ error: "Utilisateur déjà participant de cet événement" });
      req.log.error(err);
      return reply.code(500).send({ error: "Erreur lors de l'invitation" });
    }
  });

  // === Mettre à jour le statut d'un participant
  app.patch("/events/:id/participants/:participantId", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;
    const { id, participantId } = req.params as { id: string; participantId: string };

    const { status } = (req.body ?? {}) as { status?: "INVITED" | "GOING" | "DECLINED" };
    if (!status || !["INVITED", "GOING", "DECLINED"].includes(status)) {
      return reply.code(400).send({ error: "Status invalide (INVITED|GOING|DECLINED)" });
    }

    const event = await prisma.event.findFirst({ where: { id }, select: { id: true, ownerId: true } });
    if (!event) return reply.code(404).send({ error: "Événement non trouvé" });

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: { id: true, userId: true, eventId: true },
    });
    if (!participant || participant.eventId !== id) {
      return reply.code(404).send({ error: "Participant non trouvé" });
    }

    const isOwner = event.ownerId === userId;
    const isSelf = participant.userId === userId;
    if (!isOwner && !isSelf) {
      return reply.code(403).send({ error: "Non autorisé" });
    }

    const updated = await prisma.participant.update({
      where: { id: participantId },
      data: { status },
      select: {
        id: true, role: true, status: true,
        user: { select: { id: true, email: true, username: true, avatarUrl: true } },
      },
    });

    return reply.send(updated);
  });

  // ✏️ Changer la visibilité d'un event
  app.patch("/events/:id/visibility", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id } = req.params as any;
    const { visibility } = (req.body as any) || {};

    if (!VISIBILITIES.includes(visibility)) {
      return reply.code(400).send({ error: "Invalid visibility" });
    }

    const ev = await prisma.event.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
    if (!ev) return reply.code(404).send({ error: "Event not found" });

    // autorisé si owner OU host
    const isOwner = ev.ownerId === userId;
    const isHost = !!(await prisma.participant.findFirst({
      where: { eventId: id, userId, role: "HOST" },
      select: { id: true },
    }));
    if (!isOwner && !isHost) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.event.update({
      where: { id },
      data: { visibility },
      select: { id: true, visibility: true, shareCode: true },
    });

    return updated;
  });

  // 🔗 Générer/retourner le shareCode (pour mode LINK)
  app.post("/events/:id/share", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id } = req.params as any;

    const ev = await prisma.event.findUnique({
      where: { id },
      select: { id: true, ownerId: true, shareCode: true },
    });
    if (!ev) return reply.code(404).send({ error: "Event not found" });

    const isOwner = ev.ownerId === userId;
    const isHost = !!(await prisma.participant.findFirst({
      where: { eventId: id, userId, role: "HOST" },
      select: { id: true },
    }));
    if (!isOwner && !isHost) return reply.code(403).send({ error: "Forbidden" });

    const code = ev.shareCode ?? `lify_${randomUUID().slice(0, 8)}`;

    const updated = await prisma.event.update({
      where: { id },
      data: { shareCode: code },
      select: { shareCode: true },
    });

    return updated; // { shareCode: "..." }
  });

  // 🔎 Lire un événement (règles de visibilité + ?s=shareCode)
  app.get("/events/:id", async (req, reply) => {
    const { id } = req.params as any;
    const { s } = (req.query as any) || {};

    // Auth optionnelle (public/link sans token autorisés)
    let userId: string | null = null;
    const authHeader = req.headers["authorization"];
    if (authHeader) {
      await requireAuth(req, reply);
      if ((reply as any).sent) return; // si token invalide → 401 déjà renvoyé
      userId = (req as any).userId;
    }

    const ev = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        ownerId: true,
        visibility: true,
        shareCode: true,
        participants: userId
          ? { where: { userId }, select: { id: true, role: true } }
          : false,
      },
    });
    if (!ev) return reply.code(404).send({ error: "Event not found" });

    const isOwner = userId ? ev.ownerId === userId : false;
    const isParticipant = userId ? (ev.participants as any[] | undefined)?.length! > 0 : false;
    const hasValidShare = ev.visibility === "LINK" && typeof s === "string" && s === ev.shareCode;

    if (ev.visibility === "PUBLIC") return ev;

    if (ev.visibility === "LINK") {
      if (isOwner || isParticipant || hasValidShare) return ev;
      return reply.code(403).send({ error: "Forbidden" });
    }

    if (ev.visibility === "FRIENDS") {
      if (isOwner || isParticipant) return ev;
      if (!userId) return reply.code(401).send({ error: "UNAUTHORIZED" });

      const isFriend = await prisma.friendRequest.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { fromUserId: ev.ownerId, toUserId: userId },
            { fromUserId: userId, toUserId: ev.ownerId },
          ],
        },
        select: { id: true },
      });

      if (isFriend) return ev;
      return reply.code(403).send({ error: "Forbidden" });
    }

    // PRIVATE
    if (isOwner || isParticipant) return ev;
    return reply.code(403).send({ error: "Forbidden" });
  });

  // ➕ Inviter un utilisateur à un event (direct, par userId)
  app.post("/events/:id/invite", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId: currentUserId } = req as any;
    const { id } = req.params as any;
    const { userId } = (req.body as any) || {};

    if (!userId) return reply.code(400).send({ error: "userId required" });

    // Vérifie ownership basique (ownerId == currentUserId)
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return reply.code(404).send({ error: "Event not found" });
    if (event.ownerId !== currentUserId) {
      return reply.code(403).send({ error: "Only owner can invite (for now)" });
    }

    // Upsert participant INVITED
    const participant = await prisma.participant.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      update: { status: "INVITED" },
      create: { eventId: id, userId, role: "GUEST", status: "INVITED" },
    });

    return { participant };
  });

  // 🟡 Mettre à jour mon RSVP sur un event
  app.patch("/events/:id/rsvp", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id } = req.params as any;
    const { status } = (req.body as any) || {}; // "GOING" | "MAYBE" | "DECLINED"

    if (!["GOING", "MAYBE", "DECLINED"].includes(status)) {
      return reply.code(400).send({ error: "Invalid status" });
    }

    await prisma.participant.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      update: { status },
      create: { eventId: id, userId, role: "GUEST", status },
    });

    return { ok: true, status };
  });

  // 📰 Feed: Events from ME + followed users
  app.get("/feed/events", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { cursor, limit = "10" } = (req.query as any) ?? {};
    const take = Math.min(parseInt(String(limit) || "10"), 50);

    // 1. Get users I follow
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // 2. Build source user IDs: ME + followed users
    const sourceUserIds = [userId, ...followingIds];

    console.log(`[Feed] viewerId: ${userId}`);
    console.log(`[Feed] followingIds (${followingIds.length}): [${followingIds.slice(0, 5).join(", ")}${followingIds.length > 5 ? "..." : ""}]`);
    console.log(`[Feed] sourceUserIds (${sourceUserIds.length}): [${sourceUserIds.slice(0, 5).join(", ")}${sourceUserIds.length > 5 ? "..." : ""}]`);

    // 3. Fetch ALL events from sourceUserIds (no visibility filter for now)
    const events = await prisma.event.findMany({
      where: {
        ownerId: { in: sourceUserIds },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        colorHex: true,
        themeId: true,
        createdAt: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Debug log first 3 events
    console.log(`[Feed] Found ${events.length} events. First 3:`, events.slice(0, 3).map(e => ({
      id: e.id.substring(0, 8),
      ownerId: e.ownerId.substring(0, 8),
      title: e.title,
      themeId: e.themeId
    })));

    const hasMore = events.length > take;
    const items = hasMore ? events.slice(0, take) : events;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return reply.send({ items, nextCursor });
  });
}