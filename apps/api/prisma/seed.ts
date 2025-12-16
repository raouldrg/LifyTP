// prisma/seed.ts (apps/api/prisma/seed.ts)
import { PrismaClient, BadgeType } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const baseBadges = [
    {
      type: BadgeType.FIRST_EVENT,
      name: "Premier événement 🎉",
      description: "Crée ton tout premier événement sur Lify",
      icon: "badge-first-event",
    },
    {
      type: BadgeType.FIVE_SHARES,
      name: "Ambassadeur 📣",
      description: "Partage Lify 5 fois avec tes amis",
      icon: "badge-5-shares",
    },
    {
      type: BadgeType.THREE_ACTIVE_WEEKS,
      name: "Habitué 🔥",
      description: "Reste actif 3 semaines d'affilée",
      icon: "badge-3-weeks",
    },
    {
      type: BadgeType.ONBOARDING_COMPLETE,
      name: "Bienvenue 👋",
      description: "Termine ton tutoriel et autorise les permissions",
      icon: "badge-onboarding",
    },
  ];

  for (const badge of baseBadges) {
    await prisma.badge.upsert({
      where: { type: badge.type },
      update: { name: badge.name, description: badge.description, icon: badge.icon },
      create: badge,
    });
  }

  console.log("✅ Badges de base insérés !");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });