
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import 'dotenv/config';
import { prisma } from './lib/prisma'
import { requireAuth } from './lib/auth'
import eventRoutes from './routes/events'
import friendRoutes from "./routes/friends";
import postRoutes from "./routes/posts";
import { ensureBucket } from "./lib/minio";
import uploadRoutes from "./routes/uploads";
import { setupSocketIO } from "./socket";
import messageRoutes from "./routes/messages";
import linkedCalendarsRoutes from "./routes/linkedCalendars";
import preferencesRoutes from "./routes/preferences";
import notificationsRoutes from "./routes/notifications";
import gamificationRoutes from "./routes/gamification";
import authRoutes from "./routes/auth";
import multipart from "@fastify/multipart";
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import usersRoutes from "./routes/users";
import followRequestsRoutes from "./routes/follow-requests";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const ORIGIN = process.env.API_ORIGIN ?? '*'

export async function buildApp() {
    const app = Fastify({ logger: true })

    app.register(fastifyStatic, {
        root: path.join(__dirname, '..', 'uploads'),
        prefix: '/uploads/',
    })

    app.register(multipart, {
        limits: {
            fileSize: 5 * 1024 * 1024,
        }
    });

    await app.register(cors, { origin: ORIGIN === '*' ? true : ORIGIN })

    // Explicit Logging Middleware for Debugging
    app.addHook('onRequest', async (req, reply) => {
        console.log(`[REQ] ${req.method} ${req.url} from ${req.ip}`);
    });

    // Health Check - FIRST to be registered for max reliability
    app.get('/health', async () => ({ ok: true, ts: Date.now() }))

    function httpError(statusCode: number, message: string) {
        const err = new Error(message) as any
        err.statusCode = statusCode
        return err
    }
    app.decorate('httpErrors', {
        unauthorized: () => httpError(401, 'Unauthorized'),
        badRequest: (msg: string) => httpError(400, msg),
        notFound: (msg: string) => httpError(404, msg),
        forbidden: (msg: string) => httpError(403, msg),
    })

    app.register(friendRoutes)
    app.register(postRoutes)
    app.register(uploadRoutes)
    await setupSocketIO(app)
    app.register(messageRoutes)
    app.register(preferencesRoutes);
    app.register(notificationsRoutes);
    await app.register(gamificationRoutes);
    app.register(authRoutes);
    app.register(linkedCalendarsRoutes)
    app.register(usersRoutes);
    app.register(followRequestsRoutes);

    // app.get('/health') removed (moved to top)

    await app.register(eventRoutes)

    try {
        if (process.env.NODE_ENV !== 'test') {
            await ensureBucket(process.env.MINIO_BUCKET!)
        }
    } catch (e) {
        app.log.warn("⚠️ Minio seems down, uploads might fail.")
    }

    return app
}
