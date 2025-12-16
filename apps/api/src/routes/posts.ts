import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function postRoutes(app: FastifyInstance) {
  // Create Post
  app.post("/posts", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { content, eventId } = (req.body as any) ?? {};

    if (!content || typeof content !== "string") {
      return reply.code(400).send({ error: "content is required" });
    }

    if (eventId) {
      const ev = await prisma.event.findUnique({ where: { id: eventId } });
      if (!ev) return reply.code(404).send({ error: "event not found" });
    }

    const post = await prisma.post.create({
      data: { content, eventId, authorId: userId },
      include: { author: true, event: true },
    });

    return reply.code(201).send({ post });
  });

  // Toggle Like
  app.post("/posts/:id/like", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id: postId } = req.params as any;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: "post not found" });

    const existing = await prisma.like.findFirst({
      where: { postId, userId },
      select: { id: true },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      return reply.send({ liked: false });
    } else {
      await prisma.like.create({ data: { postId, userId } });
      return reply.send({ liked: true });
    }
  });

  // Create Comment
  app.post("/posts/:id/comments", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id: postId } = req.params as any;
    const { content } = (req.body as any) ?? {};

    if (!content || typeof content !== "string") {
      return reply.code(400).send({ error: "content is required" });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: "post not found" });

    const comment = await prisma.comment.create({
      data: { content, postId, authorId: userId },
      include: { author: true },
    });

    return reply.code(201).send({ comment });
  });

  // List Comments
  app.get("/posts/:id/comments", async (req, reply) => {
    const { id: postId } = req.params as any;
    const { cursor, limit = "20" } = (req.query as any) ?? {};
    const take = Math.min(parseInt(String(limit) || "20"), 50);

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      include: { author: true },
    });

    const hasMore = comments.length > take;
    const items = hasMore ? comments.slice(0, take) : comments;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return reply.send({ items, nextCursor });
  });

  // Feed v2
  app.get("/feed", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;

    // Logic: My events + Friends/Nearby (simplified for clarity)
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const { cursor, limit = "10" } = (req.query as any) ?? {};
    const take = Math.min(parseInt(String(limit) || "10"), 50);

    // 1. My active events
    const myRecentEventRows = await prisma.participant.findMany({
      where: {
        userId,
        status: "GOING",
        event: { startAt: { gte: since } },
      },
      select: { eventId: true },
      distinct: ["eventId"],
    });
    const eventIds = myRecentEventRows.map(r => r.eventId);

    // 2. People going to same events
    let nearbyUserIds: string[] = [];
    if (eventIds.length > 0) {
      const others = await prisma.participant.findMany({
        where: {
          eventId: { in: eventIds },
          status: "GOING",
          userId: { not: userId },
        },
        select: { userId: true },
        distinct: ["userId"],
      });
      nearbyUserIds = others.map(o => o.userId);
    }

    const authorIds = [userId, ...nearbyUserIds];

    const posts = await prisma.post.findMany({
      where: { authorId: { in: authorIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      include: {
        author: true,
        event: true,
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = posts.length > take;
    const items = hasMore ? posts.slice(0, take) : posts;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Check likes
    const postIds = items.map(p => p.id);
    const myLikes = postIds.length
      ? await prisma.like.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      })
      : [];
    const likedSet = new Set(myLikes.map(l => l.postId));

    const result = items.map(p => ({
      ...p,
      likedByMe: likedSet.has(p.id),
      likesCount: p._count?.likes ?? 0,
    }));

    return reply.send({ items: result, nextCursor });
  });

  // Get Single Post
  app.get("/posts/:id", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { id } = req.params as any;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
        event: true,
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!post) return reply.code(404).send({ error: "post not found" });

    const liked = await prisma.like.findFirst({
      where: { postId: id, userId },
      select: { id: true },
    });

    return reply.send({
      ...post,
      likedByMe: !!liked,
      likesCount: post._count.likes,
    });
  });

  // My Posts
  app.get("/me/posts", async (req, reply) => {
    await requireAuth(req, reply);
    if ((reply as any).sent) return;

    const { userId } = req as any;
    const { cursor, limit = "10" } = (req.query as any) ?? {};
    const take = Math.min(parseInt(String(limit) || "10"), 50);

    const posts = await prisma.post.findMany({
      where: { authorId: userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      include: {
        author: true,
        event: true,
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = posts.length > take;
    const items = hasMore ? posts.slice(0, take) : posts;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return reply.send({ items, nextCursor });
  });
}