import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function usersRoutes(app: FastifyInstance) {
    // Search users
    app.get("/users/search", { preHandler: requireAuth }, async (req: any, reply) => {
        const schema = z.object({
            q: z.string().min(1),
        });

        const { q } = schema.parse(req.query);

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } }, // Optional: search by email
                ],
            },
            take: 20,
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                bio: true,
            },
        });

        return users;
    });

    // Get user profile
    app.get("/users/:id", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({
            id: z.string(),
        });
        const { id } = paramsSchema.parse(req.params);
        const currentUserId = (req as any).userId;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                bio: true,
                _count: {
                    select: {
                        followedBy: true,
                        following: true,
                        posts: true, // Maybe useful
                        Event: true, // Maybe useful
                    }
                }
            },
        });

        if (!user) {
            return (app as any).httpErrors.notFound("User not found");
        }

        // Check if current user is following this user
        const isFollowing = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUserId,
                    followingId: id,
                },
            },
        });

        return {
            ...user,
            isFollowing: !!isFollowing,
            metrics: user._count,
        };
    });

    // Follow user
    app.post("/users/:id/follow", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({
            id: z.string(),
        });
        const { id: targetUserId } = paramsSchema.parse(req.params);
        const currentUserId = (req as any).userId;

        if (currentUserId === targetUserId) {
            return (app as any).httpErrors.badRequest("You cannot follow yourself");
        }

        // Check if user exists
        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) return (app as any).httpErrors.notFound("User not found");

        try {
            await prisma.follow.create({
                data: {
                    followerId: currentUserId,
                    followingId: targetUserId
                }
            });
        } catch (e: any) {
            // Ignore if already following (unique constraint)
            if (e.code !== 'P2002') throw e;
        }

        return { success: true };
    });

    // Unfollow user
    app.delete("/users/:id/follow", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({
            id: z.string(),
        });
        const { id: targetUserId } = paramsSchema.parse(req.params);
        const currentUserId = (req as any).userId;

        try {
            await prisma.follow.delete({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: targetUserId
                    }
                }
            });
        } catch (e: any) {
            if (e.code === 'P2025') {
                // Record to delete does not exist, ignore
                return { success: true };
            }
            throw e;
        }

        return { success: true };
    });

    // Get Followers
    app.get("/users/:id/followers", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({ id: z.string() });
        const { id } = paramsSchema.parse(req.params);

        const followers = await prisma.follow.findMany({
            where: { followingId: id },
            include: {
                follower: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        bio: true
                    }
                }
            }
        });

        return followers.map(f => f.follower);
    });

    // Get Following
    app.get("/users/:id/following", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({ id: z.string() });
        const { id } = paramsSchema.parse(req.params);

        const following = await prisma.follow.findMany({
            where: { followerId: id },
            include: {
                following: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        bio: true
                    }
                }
            }
        });

        return following.map(f => f.following);
    });

    // Get Friends (Mutual Follows)
    app.get("/friends", { preHandler: requireAuth }, async (req: any, reply) => {
        const { userId: me } = req as any;

        // Find users I follow
        const following = await prisma.follow.findMany({
            where: { followerId: me },
            select: { followingId: true }
        });
        const followingIds = following.map(f => f.followingId);

        // Find users who follow me AND are in followingIds
        const friends = await prisma.follow.findMany({
            where: {
                followerId: { in: followingIds },
                followingId: me
            },
            include: {
                follower: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        bio: true
                    }
                }
            }
        });

        return friends.map(f => f.follower);
    });
}
