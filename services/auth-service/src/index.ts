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
    return { status: 'ok', service: 'auth-service', port: 4100 };
});

// Minimal auth endpoint for testing
app.post('/auth/test', async (request, reply) => {
    return { message: 'Auth service is running', received: request.body };
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
const PORT = parseInt(process.env.PORT || '4100', 10);

try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Auth Service running on http://${HOST}:${PORT}`);
    console.log(`   - GET /health - Health check`);
    console.log(`   - POST /auth/test - Test endpoint`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
