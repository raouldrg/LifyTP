import { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return reply.code(401).send({ error: 'Missing token' })
  try {
    const token = h.slice('Bearer '.length)
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any
    ;(req as any).userId = decoded.sub
  } catch {
    return reply.code(401).send({ error: 'Invalid token' })
  }
}
