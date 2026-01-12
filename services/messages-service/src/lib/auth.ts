import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing token' });
    }

    try {
        const token = authHeader.slice('Bearer '.length);
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

        // Attach userId to request object
        (req as any).userId = decoded.sub;
    } catch (error) {
        return reply.code(401).send({ error: 'Invalid token' });
    }
}
