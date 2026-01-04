
import { PrismaClient } from './generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.user.count();
    const events = await prisma.event.count();
    const messages = await prisma.message.count();
    console.log('Users:', users);
    console.log('Events:', events);
    console.log('Messages:', messages);
  } catch(e) { console.error(e); }
}
main().finally(() => prisma.$disconnect());

