import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { pipeline } from "stream/promises";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VISIBILITIES = ["PRIVATE", "FRIENDS", "LINK", "PUBLIC"] as const;
type Visibility = typeof VISIBILITIES[number];

export default async function eventRoutes(app: FastifyInstance) {
    // 🖼️ Upload média pour un événement
    app.post("/events/:eventId/media", async (req, reply) => {
        await requireAuth(req, reply);
        if ((reply as any).sent) return;
        const { userId } = req as any;
        const { eventId } = req.params as { eventId: string };

        try {
            // Verify event ownership
            const event = await prisma.event.findFirst({
                where: { id: eventId, ownerId: userId },
                select: { id: true },
            });

            if (!event) {
                return reply.status(404).send({ error: "Event not found or not authorized" });
            }

            // Get uploaded file
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ error: "No file uploaded" });
            }

            // Validate file type
            const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
            if (!allowedMimeTypes.includes(data.mimetype)) {
                return reply.status(400).send({
                    error: "Invalid file type. Allowed: JPEG, PNG, WEBP, MP4"
                });
            }

            // Generate unique filename
            const ext = path.extname(data.filename) || ".jpg";
            const objectKey = `events/${eventId}/${randomUUID()}${ext}`;
            const savePath = path.join(__dirname, "..", "..", "uploads", "events", eventId);

            // Ensure directory exists
            if (!fs.existsSync(savePath)) {
                fs.mkdirSync(savePath, { recursive: true });
            }

            const fullPath = path.join(savePath, path.basename(objectKey));

            // Save file
            await pipeline(data.file, fs.createWriteStream(fullPath));

            // Determine media kind
            const kind = data.mimetype.startsWith("image/") ? "IMAGE" : "VIDEO";

            // Create Media record
            const media = await prisma.media.create({
                data: {
                    ownerId: userId,
                    eventId: eventId,
                    kind: kind,
                    bucket: "local", // or 'minio' if using MinIO
                    objectKey: objectKey,
                    mimeType: data.mimetype,
                    sizeBytes: 0, // TODO: get actual size
                },
                select: {
                    id: true,
                    objectKey: true,
                    kind: true,
                    mimeType: true,
                },
            });

            // Construct public URL
            const fileUrl = `/uploads/${objectKey}`;

            return reply.send({
                id: media.id,
                url: fileUrl,
                kind: media.kind,
                mimeType: media.mimeType,
            });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ error: "Upload failed" });
        }
    });

    // 🗑️ Delete média d'un événement
    app.delete("/events/:eventId/media/:mediaId", async (req, reply) => {
        await requireAuth(req, reply);
        if ((reply as any).sent) return;
        const { userId } = req as any;
        const { eventId, mediaId } = req.params as { eventId: string; mediaId: string };

        try {
            // Verify event ownership
            const event = await prisma.event.findFirst({
                where: { id: eventId, ownerId: userId },
                select: { id: true },
            });

            if (!event) {
                return reply.status(404).send({ error: "Event not found or not authorized" });
            }

            // Get media
            const media = await prisma.media.findFirst({
                where: { id: mediaId, eventId: eventId },
            });

            if (!media) {
                return reply.status(404).send({ error: "Media not found" });
            }

            // Delete file from disk
            const filePath = path.join(__dirname, "..", "..", "uploads", media.objectKey);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Delete from database
            await prisma.media.delete({ where: { id: mediaId } });

            return reply.send({ success: true });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ error: "Delete failed" });
        }
    });
}
