import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/**
 * Fastify middleware to require authentication
 */
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

/**
 * Generate JWT access token
 */
export function generateAccessToken(userId: string): string {
    return jwt.sign(
        { sub: userId },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
    );
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
    return jwt.sign(
        { sub: userId },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
    );
}

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token: string, secret: string): any {
    return jwt.verify(token, secret);
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
