import { FastifyInstance } from "fastify";
import { minio } from "../lib/minio";
import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth"; // garde le bon chemin selon ton projet

function parseCSV(csv?: string) {
  return (csv || "").split(",").map(s => s.trim()).filter(Boolean);
}

export default async function uploadRoutes(app: FastifyInstance) {
  const BUCKET = process.env.MINIO_BUCKET!;
  const TTL = Number(process.env.PRESIGNED_URL_TTL_SEC || 600);
  const MAX_IMAGE = Number(process.env.MEDIA_MAX_IMAGE_BYTES || 5 * 1024 * 1024);
  const MAX_VIDEO = Number(process.env.MEDIA_MAX_VIDEO_BYTES || 25 * 1024 * 1024);
  const ALLOWED_IMG = new Set(parseCSV(process.env.MEDIA_ALLOWED_IMAGE_MIME));
  const ALLOWED_VID = new Set(parseCSV(process.env.MEDIA_ALLOWED_VIDEO_MIME));
  const MAX_VIDEO_SEC = Number(process.env.MEDIA_MAX_VIDEO_DURATION_SEC || 15);

  // Presign URL
  app.post("/uploads/presign", { preValidation: [requireAuth] }, async (req, reply) => {
    const userId = (req as any).userId; // ✅ fixé pour être cohérent avec requireAuth
    const { kind, mimeType, sizeBytes, eventId, width, height, durationSec } = req.body as any;

    if (kind !== "IMAGE" && kind !== "VIDEO") {
      return reply.code(400).send({ error: "Invalid kind" });
    }

    if (kind === "IMAGE") {
      if (!ALLOWED_IMG.has(mimeType)) return reply.code(415).send({ error: "Unsupported image type" });
      if (sizeBytes > MAX_IMAGE) return reply.code(413).send({ error: "Image too large" });
    } else {
      if (!ALLOWED_VID.has(mimeType)) return reply.code(415).send({ error: "Unsupported video type" });
      if (sizeBytes > MAX_VIDEO) return reply.code(413).send({ error: "Video too large" });
      if (durationSec && durationSec > MAX_VIDEO_SEC) {
        return reply.code(413).send({ error: "Video too long" });
      }
    }

    if (eventId) {
      const ev = await prisma.event.findUnique({ where: { id: eventId } });
      if (!ev) return reply.code(404).send({ error: "Event not found" });
      // TODO: permissions userId sur l'event
    }

    const ext = (mimeType.split("/")[1] || "bin").replace("+", "-");
    const folder = kind === "IMAGE" ? "images" : "videos";
    const objectKey = `${folder}/${userId}/${Date.now()}-${randomUUID()}.${ext}`;

    const presignedUrl = await minio.presignedPutObject(BUCKET, objectKey, TTL);

    return { presignedUrl, objectKey, bucket: BUCKET };
  });

  // Commit Upload
  app.post("/uploads/commit", { preValidation: [requireAuth] }, async (req, reply) => {
    const userId = (req as any).userId; // ✅ corrigé ici aussi
    const { objectKey, kind, mimeType, eventId, width, height, durationSec } = req.body as any;

    const stat = await minio.statObject(BUCKET, objectKey).catch(() => null);
    if (!stat) return reply.code(400).send({ error: "Object not found in storage" });

    const finalSize = stat.size;
    if (kind === "IMAGE" && finalSize > MAX_IMAGE) return reply.code(413).send({ error: "Image too large" });
    if (kind === "VIDEO" && finalSize > MAX_VIDEO) return reply.code(413).send({ error: "Video too large" });

    const media = await prisma.media.create({
      data: {
        ownerId: userId,
        eventId: eventId ?? null,
        kind,
        bucket: BUCKET,
        objectKey,
        mimeType,
        sizeBytes: finalSize,
        width: width ?? null,
        height: height ?? null,
        durationSec: durationSec ?? null,
      },
    });

    return { media };
  });

  // Set Event Cover
  app.post("/events/:id/cover", { preValidation: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const { mediaId } = req.body as any;

    const ev = await prisma.event.findUnique({ where: { id } });
    if (!ev) return reply.code(404).send({ error: "Event not found" });

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media || media.kind !== "IMAGE") {
      return reply.code(400).send({ error: "Media not found or not an image" });
    }

    await prisma.event.update({
      where: { id },
      data: { coverMediaId: mediaId },
    });

    return { ok: true };
  });

  // Get Media URL
  app.get("/media/:id/url", { preValidation: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const m = await prisma.media.findUnique({ where: { id } });
    if (!m) return reply.code(404).send({ error: "Not found" });

    const url = await minio.presignedGetObject(m.bucket, m.objectKey, 60 * 5);
    return { url };
  });
  // Direct Avatar Upload
  app.post("/uploads/avatar", { preValidation: [requireAuth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();
    const userId = (req as any).userId;
    const ext = data.filename.split(".").pop() || "jpg";
    const objectKey = `avatars/${userId}/${Date.now()}.${ext}`;

    await minio.putObject(BUCKET, objectKey, buffer, data.file.bytesRead, {
      'Content-Type': data.mimetype
    });

    const url = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${objectKey}`;
    // Or presigned if private, but usually avatars are public. 
    // If local minio, we might return a localhost URL which emulators can't reach.
    // Better to return relative or handle domain.
    // For now, let's construct a reachable URL or just return the objectKey and let frontend resolve?
    // Let's return the full URL assuming the backend knows its public address.

    // Hack for local dev: replace localhost with machine IP if needed, or just rely on MINIO_ENDPOINT
    // If running in docker/sim, localhost refers to device.

    // To keep it simple: Return the objectKey, and let the frontend ask for a presigned URL or public URL?
    // Actually, minio presignedGetObject is safer.

    // But user wants "direct" usage. Public bucket policy is best for avatars.
    // Assuming bucket is public:
    // const publicUrl = `http://localhost:9000/${BUCKET}/${objectKey}`;

    // Let's save the URL in the user profile directly?
    // Yes, update user avatarUrl

    // We need a way to serve this. Since it's Minio, we can use presigned GET.
    // OR we can proxy it.

    // Let's assume public bucket for now or generate long-lived presigned.
    const publicUrl = await minio.presignedGetObject(BUCKET, objectKey, 7 * 24 * 60 * 60); // 7 days

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl }
    });

    return { url: publicUrl };
  });
}