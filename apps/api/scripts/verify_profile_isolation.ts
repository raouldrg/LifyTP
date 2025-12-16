import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

async function main() {
    console.log("--- Verifying Profile Isolation ---");

    // 1. Create User3
    const user3Email = "user3@lify.me";
    const user3Start = await prisma.user.upsert({
        where: { email: user3Email },
        update: {},
        create: {
            username: "User3",
            email: user3Email,
            provider: "EMAIL",
            providerId: `email-${user3Email}`,
            passwordHash: await hashPassword("user3lify"),
            bio: "Original Bio",
        }
    });
    console.log(`User3 created/found. ID: ${user3Start.id}. Bio: ${user3Start.bio}`);

    // 2. Update User3 Bio
    const newBio = "I am User 3 and I love Lify! 🚀";
    const updatedUser3 = await prisma.user.update({
        where: { id: user3Start.id },
        data: { bio: newBio }
    });
    console.log(`User3 updated. New Bio: ${updatedUser3.bio}`);

    // 3. Check User1 (should be null or different)
    const user1 = await prisma.user.findFirst({ where: { username: "User1" } });
    if (user1) {
        console.log(`User1 Bio: ${user1.bio} (Should be null or distinct)`);
        if (user1.bio === newBio) {
            console.error("❌ ERROR: User1 bio matches User3 bio! Isolation failed.");
        } else {
            console.log("✅ User1 bio is distinct.");
        }
    } else {
        console.log("User1 not found (unexpected but okay for isolation check)");
    }

    // 4. Verify Stats (Event count)
    // Create an event for User3
    const event = await prisma.event.create({
        data: {
            title: "User3 Event",
            startAt: new Date(),
            ownerId: updatedUser3.id
        }
    });
    console.log("Created event for User3");

    const user3WithStats = await prisma.user.findUnique({
        where: { id: updatedUser3.id },
        include: {
            _count: {
                select: { Event: true }
            }
        }
    });

    console.log(`User3 Event Count: ${user3WithStats?._count.Event}`);

    if (user3WithStats?._count.Event === 1) {
        console.log("✅ Stats (Event count) working correctly.");
    } else {
        console.error("❌ Stats count incorrect.");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
