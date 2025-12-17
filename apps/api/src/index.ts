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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = Number(process.env.API_PORT ?? 3000)
const ORIGIN = process.env.API_ORIGIN ?? '*'
const app = Fastify({ logger: true })

app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/', // optional: default '/'
})

app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// --- Plugins globaux
await app.register(cors, { origin: ORIGIN === '*' ? true : ORIGIN })

// ⚙️ Retire temporairement @fastify/sensible (incompatible Fastify 4)
function httpError(statusCode: number, message: string) {
  const err = new Error(message) as any
  err.statusCode = statusCode
  return err
}
app.decorate('httpErrors', {
  unauthorized: () => httpError(401, 'Unauthorized'),
  badRequest: (msg: string) => httpError(400, msg),
})

// --- Routes principales
app.register(friendRoutes)
app.register(postRoutes)
app.register(uploadRoutes)
await setupSocketIO(app)
app.register(messageRoutes)
app.register(preferencesRoutes);
app.register(notificationsRoutes);
await app.register(gamificationRoutes);
app.register(authRoutes);

// ✅ Calendriers (Sprint 7)
app.register(linkedCalendarsRoutes)

import usersRoutes from "./routes/users";
app.register(usersRoutes);

// --- Healthcheck
app.get('/health', async () => ({ ok: true }))

await app.register(eventRoutes)
try {
  await ensureBucket(process.env.MINIO_BUCKET!)
} catch (e) {
  app.log.warn("⚠️ Minio seems down, uploads might fail.")
}

// --- DEBUG : affiche toutes les routes connues
app.ready().then(() => {
  console.log(app.printRoutes())
})

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`API running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}