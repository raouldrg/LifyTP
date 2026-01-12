import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({
    logger: process.env.NODE_ENV === 'production' ? true : {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
});

// CORS
await app.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
});

// Health check
app.get('/health', async () => {
    return { status: 'ok', service: 'events-service', port: 4101 };
});

// Minimal events endpoint for testing
app.get('/events', async (request, reply) => {
    return { message: 'Events service is running', events: [] };
});

app.post('/events', async (request, reply) => {
    return { message: 'Event creation endpoint', received: request.body };
});

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
    process.on(signal, async () => {
        console.log(`Received ${signal}, closing server...`);
        await app.close();
        process.exit(0);
    });
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '4101', 10);

try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Events Service running on http://${HOST}:${PORT}`);
    console.log(`   - GET /health - Health check`);
    console.log(`   - GET /events - List events`);
    console.log(`   - POST /events - Create event`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
