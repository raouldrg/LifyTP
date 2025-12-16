import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

async function main() {
    const usersToCreate = [
        { username: "User1", email: "user1@lify.me", password: "user1lify" },
        { username: "User2", email: "user2@lify.me", password: "user2lify" },
    ];

    for (const u of usersToCreate) {
        const hashed = await hashPassword(u.password);

        // Upsert to ensure password is updated if user exists
        await prisma.user.upsert({
            where: { username: u.username },
            update: {
                passwordHash: hashed,
            },
            create: {
                username: u.username,
                email: u.email,
                passwordHash: hashed,
                provider: "EMAIL",
                providerId: `email-${u.email}`,
            },
        });
        console.log(`✅ Updated/Created user: ${u.username} with password '${u.password}'`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
