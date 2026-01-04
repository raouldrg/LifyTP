import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export default async function followRequestsRoutes(app: FastifyInstance) {
    // Get pending follow requests for current user (as target)
    app.get("/follow/requests", { preHandler: requireAuth }, async (req: any, reply) => {
        const currentUserId = req.userId;

        const requests = await prisma.followRequest.findMany({
            where: {
                targetId: currentUserId,
                status: "PENDING"
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                        bio: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return requests.map(r => ({
            id: r.id,
            status: r.status,
            createdAt: r.createdAt,
            requester: r.requester
        }));
    });

    // Get count of pending follow requests (for badge)
    app.get("/follow/requests/count", { preHandler: requireAuth }, async (req: any, reply) => {
        const currentUserId = req.userId;

        const count = await prisma.followRequest.count({
            where: {
                targetId: currentUserId,
                status: "PENDING"
            }
        });

        return { count };
    });

    // Accept a follow request
    app.post("/follow/requests/:requestId/accept", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({
            requestId: z.string()
        });
        const { requestId } = paramsSchema.parse(req.params);
        const currentUserId = req.userId;

        // Find the request and verify ownership
        const request = await prisma.followRequest.findUnique({
            where: { id: requestId }
        });

        if (!request) {
            return (app as any).httpErrors.notFound("Request not found");
        }

        if (request.targetId !== currentUserId) {
            return (app as any).httpErrors.forbidden("Not your request to accept");
        }

        if (request.status !== "PENDING") {
            return (app as any).httpErrors.badRequest("Request already processed");
        }

        // Transaction: update request + create follow
        await prisma.$transaction(async (tx) => {
            // Update request status
            await tx.followRequest.update({
                where: { id: requestId },
                data: { status: "ACCEPTED" }
            });

            // Create follow relationship (ignore if already exists)
            try {
                await tx.follow.create({
                    data: {
                        followerId: request.requesterId,
                        followingId: request.targetId
                    }
                });
            } catch (e: any) {
                if (e.code !== 'P2002') throw e; // Ignore unique constraint
            }
        });

        return { state: "following" };
    });

    // Reject a follow request
    app.post("/follow/requests/:requestId/reject", { preHandler: requireAuth }, async (req: any, reply) => {
        const paramsSchema = z.object({
            requestId: z.string()
        });
        const { requestId } = paramsSchema.parse(req.params);
        const currentUserId = req.userId;

        // Find the request and verify ownership
        const request = await prisma.followRequest.findUnique({
            where: { id: requestId }
        });

        if (!request) {
            return (app as any).httpErrors.notFound("Request not found");
        }

        if (request.targetId !== currentUserId) {
            return (app as any).httpErrors.forbidden("Not your request to reject");
        }

        if (request.status !== "PENDING") {
            return (app as any).httpErrors.badRequest("Request already processed");
        }

        // Delete the request (or set to REJECTED)
        await prisma.followRequest.delete({
            where: { id: requestId }
        });

        return { state: "none" };
    });
}
