import { FastifyInstance } from "fastify";
import * as ical from "node-ical";
import { addMinutes } from "date-fns";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function linkedCalendarsRoutes(app: FastifyInstance) {
  // Connect Google (Mock)
  app.post("/linked-calendars/google/connect", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const body = (req.body ?? {}) as {
      accessToken?: string;
      scopes?: string[];
      email?: string;
      displayName?: string;
      timezone?: string;
    };

    const cal = await prisma.linkedCalendar.create({
      data: {
        userId,
        provider: "GOOGLE",
        displayName: body.displayName ?? "Google Calendar",
        email: body.email ?? "mock@googleuser.test",
        timezone: body.timezone ?? "Europe/Paris",
        status: "CONNECTED",
      },
    });
    return cal;
  });

  // Add ICS Calendar
  app.post("/linked-calendars/ics", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const body = (req.body ?? {}) as { url?: string; displayName?: string; timezone?: string };
    if (!body.url) return reply.code(400).send({ error: "url is required" });

    const cal = await prisma.linkedCalendar.create({
      data: {
        userId,
        provider: "ICS",
        url: body.url,
        displayName: body.displayName ?? "ICS calendar",
        timezone: body.timezone ?? "Europe/Paris",
        status: "CONNECTED",
      },
    });
    return cal;
  });

  // List Linked Calendars
  app.get("/linked-calendars", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const list = await prisma.linkedCalendar.findMany({ where: { userId } });
    return list;
  });

  // Sync ICS
  app.post("/linked-calendars/:id/sync", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const { id } = (req.params ?? {}) as { id: string };
    const from = (req.query as any)?.from ? new Date((req.query as any).from) : null;
    const to = (req.query as any)?.to ? new Date((req.query as any).to) : null;

    const cal = await prisma.linkedCalendar.findFirst({ where: { id, userId } });
    if (!cal) return reply.code(404).send({ error: "calendar not found" });

    let fetched = 0,
      upserted = 0,
      skipped = 0;

    if (cal.provider === "ICS") {
      if (!cal.url) return reply.code(400).send({ error: "ICS url missing" });

      // --- Fetch + normalisation + parse robuste
      let data: Record<string, any>;
      try {
        const res = await fetch(cal.url);
        if (!res.ok) {
          return reply
            .code(400)
            .send({ error: `Failed to download ICS: ${res.status} ${res.statusText}` });
        }

        let icsText = await res.text();
        icsText = normalizeICS(icsText);

        // Compatibilité multi-versions de node-ical
        data = parseICSCompat(icsText);

        if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
          req.log.error({ msg: "ICS parsed empty", url: cal.url, sample: icsText.slice(0, 200) });
          return reply.code(400).send({ error: "ICS parsed empty" });
        }
      } catch (e: any) {
        req.log.error({ err: e, url: cal.url, message: e?.message });
        return reply
          .code(400)
          .send({ error: "Unable to fetch/parse ICS", detail: e?.message ?? String(e) });
      }

      for (const k of Object.keys(data)) {
        const ev: any = data[k];
        if (ev?.type !== "VEVENT") continue;

        const start = new Date(ev.start);
        const endAt = new Date(ev.end ?? ev.start);

        if (from && endAt < from) continue;
        if (to && start > to) continue;

        fetched++;
        const externalId = ev.uid || `${start.toISOString()}_${ev.summary}`;
        const title = ev.summary || "(sans titre)";

        const payload = {
          linkedCalendarId: cal.id,
          externalId,
          title,
          description: ev.description ?? null,
          start,
          endAt,
          locationName: ev.location ?? null,
          sourceUID: ev.uid ?? null,
          hash: ev.uid ?? null,
        };

        try {
          await prisma.linkedEvent.upsert({
            where: {
              linkedCalendarId_externalId: {
                linkedCalendarId: cal.id,
                externalId,
              },
            },
            create: payload,
            update: {
              title: payload.title,
              description: payload.description,
              start: payload.start,
              endAt: payload.endAt,
              locationName: payload.locationName,
              hash: payload.hash,
            },
          });
          upserted++;
        } catch {
          skipped++;
        }
      }
    }

    return { fetched, upserted, skipped };
  });

  // Get Linked Events
  app.get("/linked-events", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const from = (req.query as any)?.from ? new Date((req.query as any).from) : null;
    const to = (req.query as any)?.to ? new Date((req.query as any).to) : null;
    const limit = Number((req.query as any)?.limit ?? 100);

    const list = await prisma.linkedEvent.findMany({
      where: {
        calendar: { userId },
        AND: [
          from ? { endAt: { gte: from } } : {},
          to ? { start: { lte: to } } : {},
        ],
      },
      orderBy: { start: "asc" },
      take: limit,
    });
    return list;
  });

  // --- 6) Déduplication (preview)
  app.post("/linked-events/deduplicate/preview", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;
    const { userId } = req as any;

    const body = (req.body ?? {}) as {
      windowMinutes?: number;
      fuzzyTitle?: boolean;
      comparePlace?: boolean;
    };
    const windowMins = body.windowMinutes ?? 120;

    const now = new Date();
    const linked = await prisma.linkedEvent.findMany({
      where: { calendar: { userId }, endAt: { gte: addMinutes(now, -windowMins) } },
    });

    const lify = await prisma.event.findMany({
      where: { ownerId: userId, endAt: { gte: addMinutes(now, -windowMins) } },
      select: { id: true, title: true, startAt: true, endAt: true, description: true },
    });

    const matches: Array<{ linkedEventId: string; lifyEventId: string; reason: string }> = [];

    for (const le of linked) {
      for (const ev of lify) {
        // endAt peut être null sur Event → fallback sur startAt
        const evEnd = ev.endAt ?? ev.startAt;
        const overlap = !(le.endAt < ev.startAt || le.start > evEnd);
        if (!overlap) continue;

        const titleClose = body.fuzzyTitle
          ? (le.title || "").toLowerCase().includes((ev.title || "").toLowerCase()) ||
          (ev.title || "").toLowerCase().includes((le.title || "").toLowerCase())
          : (le.title || "") === (ev.title || "");

        if (titleClose) {
          matches.push({ linkedEventId: le.id, lifyEventId: ev.id, reason: "title" });
        }
      }
    }
    return { matches };
  });

  // --- 7) Déduplication (apply)
  app.post("/linked-events/deduplicate/apply", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const body = (req.body ?? {}) as {
      windowMinutes?: number;
      fuzzyTitle?: boolean;
      comparePlace?: boolean;
      dryRun?: boolean;
    };

    // ⚠️ Ne propage que l’Authorization, surtout pas Content-Length/Type
    const headers: Record<string, string> = {};
    if (typeof req.headers.authorization === "string") {
      headers.authorization = req.headers.authorization;
    }

    const injected = await app.inject({
      method: "POST",
      url: "/linked-events/deduplicate/preview",
      payload: {
        windowMinutes: body.windowMinutes,
        fuzzyTitle: body.fuzzyTitle,
        comparePlace: body.comparePlace,
      },
      headers,
    });

    let parsed: any = null;
    try {
      parsed = injected.json();
    } catch {
      // ignore
    }

    if (injected.statusCode >= 400 || !parsed || typeof parsed !== "object") {
      return reply.code(injected.statusCode || 500).send({
        error: "Preview failed",
        detail: injected.body?.toString?.() ?? "invalid preview response",
        statusCode: injected.statusCode || 500,
      });
    }

    const matches = Array.isArray(parsed.matches)
      ? (parsed.matches as Array<{ linkedEventId: string; lifyEventId: string }>)
      : [];

    if (body.dryRun === true) {
      return { merged: 0, keptExternal: 0, keptLify: 0, matches };
    }

    let merged = 0;
    for (const m of matches) {
      try {
        await prisma.linkedEvent.update({
          where: { id: m.linkedEventId },
          data: { lifyEventId: m.lifyEventId },
        });
        merged++;
      } catch (e) {
        req.log.error({ err: e, m }, "failed to link linkedEvent -> lifyEvent");
      }
    }
    return { merged, keptExternal: 0, keptLify: merged };
  });
}

// === Helpers ===

function normalizeICS(src: string): string {
  // retire un éventuel BOM
  let s = src.replace(/^\uFEFF/, "");
  // unifie les fins de lignes
  s = s.replace(/\r\n/g, "\n");
  // "unfold" des lignes (RFC5545: lignes continuées commencent par espace ou tab)
  s = s.replace(/\n[ \t]/g, "");
  return s;
}

// Gère toutes les variantes d'export de node-ical (parseICS à différents endroits)
function parseICSCompat(text: string): Record<string, any> {
  const m: any = ical as any;
  if (m && typeof m.parseICS === "function") return m.parseICS(text);
  if (m?.sync && typeof m.sync.parseICS === "function") return m.sync.parseICS(text);
  if (m?.default && typeof m.default.parseICS === "function") return m.default.parseICS(text);
  throw new Error("parseICS not available in installed node-ical");
}