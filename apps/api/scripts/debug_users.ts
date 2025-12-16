import { prisma } from "../src/lib/prisma";

async function main() {
    const users = await prisma.user.findMany();
    console.log("Found users:", users.length);
    users.forEach(u => {
        console.log(`- ID: ${u.id}`);
        console.log(`  Email: ${u.email}`);
        console.log(`  Username: ${u.username}`);
        console.log(`  Provider: ${u.provider}`);
        console.log(`  ProviderId: ${u.providerId}`);
        console.log(`  PasswordHash Present: ${!!u.passwordHash}`);
        console.log("--------------------------------------------------");
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
