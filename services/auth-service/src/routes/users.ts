import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { hashPassword, comparePassword } from "../lib/password";

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
                    { username: { startsWith: q, mode: "insensitive" } },
                    { email: { startsWith: q, mode: "insensitive" } }, // Optional: search by email
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

    // Change Password
    app.patch("/users/me/password", { preHandler: requireAuth }, async (req: any, reply) => {
        const schema = z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
        });

        const validation = schema.safeParse(req.body);
        if (!validation.success) {
            return (app as any).httpErrors.badRequest(validation.error.issues[0].message);
        }

        const { currentPassword, newPassword } = validation.data;
        const userId = req.userId;

        // Fetch user with password hash
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return (app as any).httpErrors.notFound("User not found");

        // If user has no password (e.g. Google auth only), they cannot change it via this endpoint
        // Or we might allow setting it if we verify other things, but for now strict check:
        if (!user.passwordHash) {
            return (app as any).httpErrors.badRequest("Ce compte n'a pas de mot de passe défini (connexion social).");
        }

        // Verify current password
        const valid = await comparePassword(currentPassword, user.passwordHash);
        if (!valid) return (app as any).httpErrors.unauthorized("Mot de passe actuel incorrect");

        // Hash new password
        const newHash = await hashPassword(newPassword);

        // Update user
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash }
        });

        // Revoke all refresh tokens (Logout all sessions)
        await prisma.refreshToken.updateMany({
            where: { userId: userId },
            data: { revoked: true }
        });

        return { success: true };
    });

    // PATCH /users/me moved to auth.ts to avoid duplicates

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
                displayName: true,
                avatarUrl: true,
                avatarColor: true,
                bio: true,
                isPrivate: true,
                _count: {
                    select: {
                        followedBy: true,
                        following: true,
                        posts: true,
                        Event: true,
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

        // Check for pending follow request (only if not already following)
        let followRequestStatus: string | null = null;
        if (!isFollowing && currentUserId !== id) {
            const pendingRequest = await prisma.followRequest.findUnique({
                where: {
                    requesterId_targetId: {
                        requesterId: currentUserId,
                        targetId: id,
                    },
                },
            });
            if (pendingRequest) {
                followRequestStatus = pendingRequest.status;
            }
        }

        return {
            ...user,
            isFollowing: !!isFollowing,
            followRequestStatus,
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

        // Check if user exists and get privacy setting
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, isPrivate: true }
        });
        if (!targetUser) return (app as any).httpErrors.notFound("User not found");

        // Check if already following
        const existingFollow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUserId,
                    followingId: targetUserId
                }
            }
        });
        if (existingFollow) {
            return { state: "following" };
        }

        // If private profile, create follow request instead
        if (targetUser.isPrivate) {
            // Check for existing request
            const existingRequest = await prisma.followRequest.findUnique({
                where: {
                    requesterId_targetId: {
                        requesterId: currentUserId,
                        targetId: targetUserId
                    }
                }
            });

            if (existingRequest) {
                if (existingRequest.status === "PENDING") {
                    return { state: "requested" };
                }
                // If rejected, allow re-requesting by updating status
                await prisma.followRequest.update({
                    where: { id: existingRequest.id },
                    data: { status: "PENDING", updatedAt: new Date() }
                });
                return { state: "requested" };
            }

            // Create new request
            await prisma.followRequest.create({
                data: {
                    requesterId: currentUserId,
                    targetId: targetUserId,
                    status: "PENDING"
                }
            });
            return { state: "requested" };
        }

        // Public profile: direct follow
        try {
            await prisma.follow.create({
                data: {
                    followerId: currentUserId,
                    followingId: targetUserId
                }
            });
        } catch (e: any) {
            if (e.code !== 'P2002') throw e;
        }

        return { state: "following" };
    });

    // Unfollow user (also cancels pending request)
    app.delete("/users/:id/follow", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({
            id: z.string(),
        });
        const { id: targetUserId } = paramsSchema.parse(req.params);
        const currentUserId = (req as any).userId;

        // Delete follow if exists
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
            if (e.code !== 'P2025') throw e; // Ignore if not found
        }

        // Also delete any pending follow request
        try {
            await prisma.followRequest.delete({
                where: {
                    requesterId_targetId: {
                        requesterId: currentUserId,
                        targetId: targetUserId
                    }
                }
            });
        } catch (e: any) {
            if (e.code !== 'P2025') throw e; // Ignore if not found
        }

        return { state: "none" };
    });

    // Remove a follower (force remove someone from your followers)
    app.delete("/followers/:followerUserId", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({ followerUserId: z.string() });
        const { followerUserId } = paramsSchema.parse(req.params);
        const currentUserId = req.userId;

        // Cannot remove yourself
        if (currentUserId === followerUserId) {
            return (app as any).httpErrors.badRequest("Cannot remove yourself");
        }

        // Delete the follow relationship where followerUserId follows currentUser
        try {
            await prisma.follow.delete({
                where: {
                    followerId_followingId: {
                        followerId: followerUserId,
                        followingId: currentUserId
                    }
                }
            });
        } catch (e: any) {
            if (e.code === 'P2025') {
                return (app as any).httpErrors.notFound("User is not following you");
            }
            throw e;
        }

        // Also cleanup any pending follow request from that user
        try {
            await prisma.followRequest.deleteMany({
                where: {
                    requesterId: followerUserId,
                    targetId: currentUserId
                }
            });
        } catch (e) {
            // Ignore errors - cleanup is best effort
        }

        return { ok: true };
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

    // Get user's events (for profile view)
    // Protected: private profiles require active follow
    app.get("/users/:id/events", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({ id: z.string() });
        const { id: targetUserId } = paramsSchema.parse(req.params);
        const currentUserId = (req as any).userId;

        // Get target user's privacy setting
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { isPrivate: true }
        });

        if (!targetUser) {
            return (app as any).httpErrors.notFound("User not found");
        }

        // If not viewing own profile and target is private, check follow status
        if (currentUserId !== targetUserId && targetUser.isPrivate) {
            const isFollowing = await prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: targetUserId
                    }
                }
            });

            if (!isFollowing) {
                return (app as any).httpErrors.forbidden("Private profile");
            }
        }

        const { from, to } = (req.query ?? {}) as { from?: string; to?: string };

        // Build date filter
        const dateFilter: any = {};
        if (from) dateFilter.gte = new Date(from);
        if (to) dateFilter.lte = new Date(to);

        // Fetch events owned by the target user
        const events = await prisma.event.findMany({
            where: {
                ownerId: targetUserId,
                ...(Object.keys(dateFilter).length > 0 ? { startAt: dateFilter } : {}),
            },
            orderBy: { startAt: "asc" },
            select: {
                id: true,
                title: true,
                description: true,
                startAt: true,
                endAt: true,
                colorHex: true,
                visibility: true,
            },
        });

        return events;
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
