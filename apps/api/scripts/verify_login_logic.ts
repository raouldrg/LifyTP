import { prisma } from "../src/lib/prisma";
import { comparePassword } from "../src/lib/password";

async function verifyLogin(identifier: string, password: string) {
    console.log(`Testing login for: ${identifier} with password '${password}'`);

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: identifier },
                { username: identifier }
            ]
        }
    });

    if (!user) {
        console.log(`❌ User not found for identifier: ${identifier}`);
        return;
    }

    const valid = await comparePassword(password, user.passwordHash || "");
    if (valid) {
        console.log(`✅ Login SUCCESS for ${identifier}`);
    } else {
        console.log(`❌ Password mismatch for ${identifier}`);
    }
}

async function main() {
    await verifyLogin("User1", "user1lify");
    await verifyLogin("User2", "user2lify");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
