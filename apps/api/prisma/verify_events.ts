import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();
const START_DATE = new Date('2026-01-05T00:00:00.000Z');

async function main() {
    console.log('🔍 Verifying event distribution...');

    const users = ['raouldrg', 'user1', 'user2', 'user3'];

    for (const username of users) {
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                Event: {
                    where: {
                        startAt: { gte: START_DATE }
                    }
                }
            }
        });

        if (!user) {
            console.log(`❌ User ${username} not found!`);
            continue;
        }

        const eventCount = user.Event.length;
        console.log(`User: ${username.padEnd(10)} | Events: ${eventCount}`);

        // Check specific days
        if (eventCount > 0) {
            const perDay = new Map<number, number>();
            user.Event.forEach(e => {
                const day = e.startAt.getDay();
                perDay.set(day, (perDay.get(day) || 0) + 1);
            });
            console.log(`    dist: ${Array.from(perDay.entries()).map(([d, c]) => `Day${d}=${c}`).join(', ')}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
