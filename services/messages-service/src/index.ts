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
    return { status: 'ok', service: 'messages-service', port: 4102 };
});

// Minimal messages endpoints for testing
app.get('/messages/conversations', async (request, reply) => {
    return { message: 'Messages service is running', conversations: [] };
});

app.post('/messages', async (request, reply) => {
    return { message: 'Message send endpoint', received: request.body };
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
const PORT = parseInt(process.env.PORT || '4102', 10);

try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Messages Service running on http://${HOST}:${PORT}`);
    console.log(`   - GET /health - Health check`);
    console.log(`   - GET /messages/conversations - List conversations`);
    console.log(`   - POST /messages - Send message`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
