# LifyTP Microservices - Diagnostic & Corrections

## État des Services au Démarrage

### 📊 Tableau de Diagnostic

| Service | Erreur Principale | Type | Action Correctrice | Priorité |
|---------|-------------------|------|-------------------|----------|
| **auth-service** | Cannot find package 'google-auth-library' | NPM Dependency | Ajouter au package.json OU désactiver Google Auth temporairement | P1 |
| **auth-service** | Module '../lib/password' not found | Missing File | Copier/créer password.ts dans src/lib/ | P1 |
| **events-service** | Cannot find '/shared/lib/prisma.js' | Wrong Import | Fix import to use './lib/prisma.js' | P1 |
| **events-service** | Missing minio package | NPM Dependency | Ajouter minio au package.json | P2 |
| **messages-service** | Cannot find '/shared/lib/prisma.js' | Wrong Import | Fix import to use './lib/prisma.js' | P1 |
| **messages-service** | Missing Socket.io/Redis | NPM Dependency | Déjà dans package.json, vérifier import | P2 |
| **ALL** | TypeScript top-level await | tsconfig | Module déjà ES2020, OK | ✅ |

## Stratégie de Correction

### Phase 1: Fix Import Paths (P1 - Bloquant)
1. ✅ Auth service: import prisma déjà fixé
2. ⏳ Events service: fixer import prisma dans index.ts
3. ⏳ Messages service: fixer import prisma dans index.ts

### Phase 2: Add Missing Local Files (P1 - Bloquant)
1. ✅ Auth/lib/prisma.ts - CRÉÉ
2. ✅ Auth/lib/auth.ts - CRÉÉ
3. ✅ Auth/lib/password.ts - CRÉÉ
4. ⏳ Events/lib/prisma.ts - À CRÉER
5. ⏳ Events/lib/auth.ts - À CRÉER (pour require Auth sur routes)
6. ⏳ Messages/lib/prisma.ts - À CRÉER
7. ⏳ Messages/lib/auth.ts - À CRÉER

### Phase 3: Add Missing NPM Packages (P2 - Features)
1. ⏳ Auth: google-auth-library (ou désactiver Google login temporairement)
2. ⏳ Events: minio (ou désactiver upload média temporairement)
3. ⏳ Events: google-auth-library (calendar sync)
4. ⏳ Events: node-ical (calendar import)

### Phase 4: Simplify Routes (P2 - Demo viable)
**Stratégie**: Garder routes essentielles, commenter/désactiver features complexes
- Auth: login/register/me (sans Google)
- Events: CRUD basique (sans upload MinIO)
- Messages: list/send basique (sans Socket.io temps réel dans un premier temps)

## Corrections En Cours
