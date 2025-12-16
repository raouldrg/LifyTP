// apps/api/scripts/sprint8_backfill.ts
import { PrismaClient } from '../generated/prisma';
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting Database Maintenance...');

  // 1. Fix NULL Visibilities (Legacy Data Fix)
  try {
    const patched = await prisma.$executeRawUnsafe(
      'UPDATE "Event" SET "visibility" = $1::"Visibility" WHERE "visibility" IS NULL;',
      'PRIVATE'
    );
    if (Number(patched) > 0) {
      console.log(`✅ Fixed ${Number(patched)} Events with NULL visibility -> PRIVATE`);
    } else {
      console.log('✅ No Events with NULL visibility found.');
    }
  } catch (e) {
    console.warn('⚠️ Could not patch Event visibility (Check if table exists).');
  }

  // 2. Ensure User Preferences exist
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(`🔍 Checking preferences for ${users.length} users...`);

  let upsertedCount = 0;
  for (const u of users) {
    await prisma.userPreference.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id,
        notificationOptIn: true,
        defaultEventVisibility: 'PRIVATE',
      },
      update: {}, // Only create if missing
    });
    upsertedCount++;
  }

  console.log(`✅ User Preferences verified.`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });