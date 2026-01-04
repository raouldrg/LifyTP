import { PrismaClient } from '../generated/prisma';
import { addDays, setHours, setMinutes, startOfWeek } from 'date-fns';

const prisma = new PrismaClient();

// Configuration
const START_DATE = new Date('2026-01-05T00:00:00.000Z'); // Lundi 5 Janvier 2026

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Fetch Users
    const raoul = await prisma.user.findUnique({ where: { username: 'raouldrg' } });
    const user1 = await prisma.user.findUnique({ where: { username: 'user1' } });
    const user2 = await prisma.user.findUnique({ where: { username: 'user2' } });
    const user3 = await prisma.user.findUnique({ where: { username: 'user3' } });

    if (!raoul || !user1) {
        console.error('❌ Critical users missing (raouldrg or user1). Please ensure they exist.');
        return;
    }

    console.log(`✅ Found users: ${raoul.username}, ${user1.username}`);

    // 2. Clear existing events... (skipped)

    const eventsToCreate: any[] = [];

    // --- Helpers ---
    const createDate = (dayOffset: number, hour: number, minute: number = 0) => {
        const d = addDays(START_DATE, dayOffset); // 0 = Lundi, 1 = Mardi...
        return setMinutes(setHours(d, hour), minute);
    };

    // --- RAOULDRG EVENTS (Semaine chargée) ---
    eventsToCreate.push({
        title: 'Cours à l’ESILV',
        description: 'Cours de Big Data et IA toute la matinée. Lieu: La Défense',
        startAt: createDate(0, 9, 30),
        endAt: createDate(0, 12, 30),
        ownerId: raoul.id,
        isPrivate: false,
    });
    eventsToCreate.push({
        title: 'Déjeuner équipe',
        description: 'Lieu: Vapiano',
        startAt: createDate(0, 13, 0),
        endAt: createDate(0, 14, 0),
        ownerId: raoul.id,
        isPrivate: false,
    });
    eventsToCreate.push({
        title: 'Séance sport',
        description: 'Muscu bras / dos. Lieu: Fitness Park',
        startAt: createDate(0, 18, 0),
        endAt: createDate(0, 19, 30),
        ownerId: raoul.id,
        isPrivate: true,
    });

    // Mardi
    eventsToCreate.push({
        title: 'Point projet Lify',
        description: 'Revue des tickets et roadmap de la semaine.',
        startAt: createDate(1, 10, 0),
        endAt: createDate(1, 11, 30),
        ownerId: raoul.id,
        isPrivate: true,
    });
    eventsToCreate.push({
        title: 'Cinéma - Avatar 5',
        description: 'Lieu: UGC Ciné Cité',
        startAt: createDate(1, 20, 0),
        endAt: createDate(1, 23, 0),
        ownerId: raoul.id,
        isPrivate: false,
    });

    // Mercredi
    eventsToCreate.push({
        title: 'Révisions partiels',
        startAt: createDate(2, 14, 0),
        endAt: createDate(2, 17, 0),
        ownerId: raoul.id,
        isPrivate: true,
    });

    // Jeudi
    eventsToCreate.push({
        title: 'Afterwork BDE',
        description: 'Soirée au bar pour fêter la fin des partiels. Lieu: Le Meltdown',
        startAt: createDate(3, 19, 0),
        endAt: createDate(3, 23, 0),
        ownerId: raoul.id,
        isPrivate: false,
    });

    // Vendredi
    eventsToCreate.push({
        title: 'Présentation Projet',
        description: 'Démo finale devant le jury. Lieu: Amphi A',
        startAt: createDate(4, 9, 0),
        endAt: createDate(4, 11, 0),
        ownerId: raoul.id,
        isPrivate: false,
    });
    eventsToCreate.push({
        title: 'Départ week-end',
        startAt: createDate(4, 17, 0),
        endAt: createDate(4, 18, 0),
        ownerId: raoul.id,
        isPrivate: true,
    });

    // Samedi
    eventsToCreate.push({
        title: 'Match de Tennis',
        description: 'Lieu: Club de Tennis',
        startAt: createDate(5, 10, 30),
        endAt: createDate(5, 12, 0),
        ownerId: raoul.id,
        isPrivate: false,
    });
    eventsToCreate.push({
        title: 'Dîner Anniv Thomas',
        startAt: createDate(5, 20, 0),
        endAt: createDate(5, 23, 30),
        ownerId: raoul.id,
        isPrivate: false,
    });

    // Dimanche
    eventsToCreate.push({
        title: 'Brunch',
        description: 'Lieu: Kozy Bosquet',
        startAt: createDate(6, 11, 30),
        endAt: createDate(6, 13, 30),
        ownerId: raoul.id,
        isPrivate: false,
    });

    // --- USER1 EVENTS ---
    // Lundi
    eventsToCreate.push({
        title: 'Bibliothèque',
        startAt: createDate(0, 14, 0),
        endAt: createDate(0, 18, 0),
        ownerId: user1.id,
        isPrivate: false,
    });

    // Mercredi
    eventsToCreate.push({
        title: 'Cours de Piano',
        startAt: createDate(2, 17, 30),
        endAt: createDate(2, 18, 30),
        ownerId: user1.id,
        isPrivate: true,
    });

    // Jeudi
    eventsToCreate.push({
        title: 'Conférence Tech',
        description: 'Lieu: Station F',
        startAt: createDate(3, 18, 0),
        endAt: createDate(3, 20, 0),
        ownerId: user1.id,
        isPrivate: false,
    });

    // Vendredi
    eventsToCreate.push({
        title: 'Sortie',
        startAt: createDate(4, 21, 0),
        endAt: createDate(4, 23, 59),
        ownerId: user1.id,
        isPrivate: false,
    });

    // Dimanche
    eventsToCreate.push({
        title: 'Rando forêt',
        description: 'Lieu: Fontainebleau',
        startAt: createDate(6, 10, 0),
        endAt: createDate(6, 14, 0),
        ownerId: user1.id,
        isPrivate: false,
    });


    // 3. Batch insert
    console.log(`📝 Creating ${eventsToCreate.length} events...`);

    const result = await prisma.event.createMany({
        data: eventsToCreate,
    });

    console.log(`✅ Success! Created ${result.count} events.`);
    console.log('📅 Schedule summary:');
    console.log(`   - Raouldrg: ~10 events`);
    console.log(`   - User1: ~5 events`);
    console.log(`   - User2: 0 events`);
    console.log(`   - User3: 0 events`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
