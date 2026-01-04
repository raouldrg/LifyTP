# 🚀 LIFY — Plan d'Évolution Technique

> **Rôle** : Lead Architect / Tech Lead  
> **Date** : 3 janvier 2026  
> **Basé sur** : Analyse architecturale Sprint 0

---

## ÉTAPE 1 — DIAGNOSTIC CRITIQUE

### Scénario de stress analysés

| Scénario | Horizon | Impact |
|----------|---------|--------|
| 1000+ utilisateurs actifs | 3-6 mois | Moyen |
| Features sociales (posts/feed) activées | 1-2 mois | Fort |
| App utilisée quotidiennement 6+ mois | Long terme | Critique |

---

### 🔴 RISQUES CRITIQUES (Bloquants)

| # | Risque | Symptôme | Probabilité | Impact |
|---|--------|----------|-------------|--------|
| C1 | **Auth non persistée** | Déconnexion au restart app | 100% | Critique |
| C2 | **Pas de refresh token** | Token 7j expiré = re-login | 100% | Critique |
| C3 | **Socket sans reconnexion robuste** | Messages perdus après sleep/réseau | 80% | Critique |
| C4 | **Pas de tests automatisés** | Régressions à chaque PR | 100% | Critique |
| C5 | **JWT secret en .env non rotaté** | Compromission = tous les comptes | 20% | Catastrophique |

**Diagnostic** : L'app est **inutilisable en production** sans C1+C2. Un utilisateur devrait se reconnecter chaque fois qu'il ferme l'app.

---

### 🟠 RISQUES IMPORTANTS (Dégradation UX)

| # | Risque | Symptôme | Probabilité | Impact |
|---|--------|----------|-------------|--------|
| I1 | **ChatScreen 1200 lignes** | Bugs difficiles à tracer, freeze UI | 70% | Fort |
| I2 | **~60 `any` TypeScript** | Bugs runtime, pas d'autocompletion | 50% | Moyen |
| I3 | **Optimistic messages instables** | Clés dupliquées, messages fantômes | 40% | Moyen |
| I4 | **Pas de pagination messages scroll** | OOM sur longues conversations | 60% | Fort |
| I5 | **Redis optionnel (fallback memory)** | Multi-instance impossible | 30% en prod | Fort |
| I6 | **Pas de rate limiting API** | DDoS, spam messages | 50% | Fort |
| I7 | **MinIO local non configuré prod** | Uploads perdus/cassés | 100% en prod | Critique |

---

### 🟡 AMÉLIORATIONS (Nice to have)

| # | Amélioration | Bénéfice |
|---|--------------|----------|
| A1 | React Query pour data fetching | Cache, retry, optimistic native |
| A2 | Zod validation côté client | Erreurs typées avant envoi |
| A3 | Storybook composants | UI documentation |
| A4 | Sentry/Crashlytics | Monitoring erreurs |
| A5 | Analytics (Mixpanel/Amplitude) | Comportement utilisateurs |
| A6 | i18n (multi-langue) | Expansion internationale |
| A7 | Dark mode | UX moderne |
| A8 | E2E tests (Maestro/Detox) | Smoke tests flows critiques |

---

## ÉTAPE 2 — PRIORISATION STRATÉGIQUE

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1: SÉCURISATION          │  Durée: 1-2 semaines            │
│  "L'app ne casse plus"           │  Risques: C1, C2, C3, C5        │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 2: STRUCTURATION         │  Durée: 2-3 semaines            │
│  "Le code est maintenable"       │  Risques: I1, I2, I3, C4        │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 3: SCALABILITÉ           │  Durée: 2-4 semaines            │
│  "L'app tient la charge"         │  Risques: I4, I5, I6, I7        │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 4: PRODUIT               │  Durée: Ongoing                 │
│  "Features avancées"             │  Risques: A1-A8                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 📌 Phase 1 — SÉCURISATION

> **Objectif** : L'app ne perd plus l'utilisateur et reste connectée.

| Objectif | Détail | Justification |
|----------|--------|---------------|
| **Auth persistée** | AsyncStorage pour token + user | Restart app ≠ logout |
| **Refresh token** | JWT access 15min + refresh 30j | Sécurité + UX fluide |
| **Socket robuste** | Reconnexion auto + re-join room | Messages jamais perdus |
| **Rotation secrets** | Config pour JWT secret rotation | Préparation incident |

**Pourquoi c'est important** :  
- Sans ça, l'app est un **prototype**, pas un produit.
- Chaque test utilisateur sera frustrant (re-login constant).
- Le temps réel cassé détruit la value prop messagerie.

**Ce qui NE doit PAS être fait avant** :  
- ❌ Nouvelles features (posts, notifications push)
- ❌ Refactor ChatScreen (stabilité auth d'abord)
- ❌ Migration DB (risque sur fondations instables)

**Livrables Phase 1** :
1. `usePersistedAuth` hook avec AsyncStorage
2. Endpoints `/auth/refresh` + `/auth/logout`
3. Axios interceptor pour refresh automatique
4. Socket manager avec expo-task-manager ou reconnect strategy
5. Documentation rotation JWT_SECRET

---

### 📌 Phase 2 — STRUCTURATION

> **Objectif** : Le code est compréhensible, typé, testable.

| Objectif | Détail | Justification |
|----------|--------|---------------|
| **Split ChatScreen** | Extraire hooks + composants | Maintenabilité |
| **Types stricts** | Interfaces User, Message, Event, etc. | 0 bugs runtime type |
| **Tests critiques** | Auth flow, message send, socket handlers | Filet de sécurité |
| **Optimistic stabilisé** | Stratégie unique tempId → realId | Fin des messages fantômes |

**Pourquoi c'est important** :  
- Un fichier de 1200 lignes est **inmaintenable**.
- Sans types, chaque refactor casse quelque chose.
- Sans tests, on a peur de toucher au code.

**Ce qui NE doit PAS être fait avant** :  
- ❌ Scaling infra (pas de gain si code buggy)
- ❌ Features complexes (groupe chat, vidéo)
- ❌ Lib state management (valider besoin réel d'abord)

**Livrables Phase 2** :
1. `useChatMessages` hook extrait
2. `useChatInput` hook extrait
3. `useChatSocket` hook extrait
4. `types/index.ts` avec toutes les interfaces
5. Élimination des `any` critiques (API responses)
6. Tests Jest : auth.test.ts, messages.test.ts
7. CI GitHub Actions : lint + typecheck + test

---

### 📌 Phase 3 — SCALABILITÉ

> **Objectif** : L'app supporte 10K+ users sans tomber.

| Objectif | Détail | Justification |
|----------|--------|---------------|
| **Pagination infinie** | Cursor scroll bidirectionnel | Longues conversations |
| **Redis obligatoire** | Plus de fallback memory | Multi-instance API |
| **Rate limiting** | fastify-rate-limit | Anti-spam, DDoS |
| **Storage prod** | S3/R2 au lieu de MinIO local | Fiabilité uploads |
| **DB connection pool** | Prisma pool config | Charge DB |

**Pourquoi c'est important** :  
- À 1000+ users, in-memory socket = crash.
- Sans pagination, une conversation de 1000 messages = OOM mobile.
- Sans rate limit, un script spam = app down.

**Ce qui NE doit PAS être fait avant** :  
- ❌ Micro-optimisations (Hermes, lazy load)
- ❌ CDN assets (pas assez de contenu)
- ❌ Sharding DB (trop tôt)

**Livrables Phase 3** :
1. `FlatList` avec `onEndReached` + cursor bidirectionnel
2. Redis Adapter obligatoire (fail if not connected)
3. `@fastify/rate-limit` configuré par route
4. Migration S3 (Cloudflare R2, AWS S3, ou Supabase Storage)
5. Prisma `connection_limit` et `pool_timeout`
6. Health check endpoint robuste

---

### 📌 Phase 4 — PRODUIT

> **Objectif** : Features différenciantes et polish.

| Objectif | Détail | Priorité |
|----------|--------|----------|
| **Push notifications** | Expo Notifications + backend triggers | Haute |
| **UI Feed posts** | Activer routes posts existantes | Haute |
| **Typing indicators** | Socket event "typing" | Moyenne |
| **React Query** | Remplacer useEffect fetch | Moyenne |
| **Analytics** | Mixpanel ou Amplitude | Moyenne |
| **Dark mode** | Theme provider | Moyenne |
| **Groupe chat** | Nouveau model Conversation | Basse (v2) |
| **Appels audio/vidéo** | WebRTC | Basse (v2) |

**Ce qui NE doit PAS être fait avant** :  
- ❌ Rien de Phase 4 avant Phase 1-2 terminées
- ❌ Features cosmétiques avant stabilité

---

## ÉTAPE 3 — DETTES À TRAITER

### ✅ DETTES PRIORITAIRES (Phase 1-2)

| Dette | Fichier(s) | Action | Justification |
|-------|------------|--------|---------------|
| Auth non persistée | `AuthContext.tsx` | Implémenter AsyncStorage | **Bloquant UX** |
| Pas de refresh token | `auth.ts` (API) | Ajouter endpoint + flow | **Sécurité + UX** |
| Socket reconnect absent | `socket.ts` | Implémenter retry + re-join | **Messages perdus** |
| ChatScreen monolithique | `ChatScreen.tsx` | Extraire 5-6 hooks | **Maintenabilité** |
| Types `any` | 60+ fichiers | Créer interfaces, remplacer | **Bugs runtime** |
| Pas de tests | Projet entier | Tests auth + messages | **Régressions** |

### 🟡 DETTES REPORTABLES (Phase 3+)

| Dette | Raison du report |
|-------|------------------|
| Redis fallback | Fonctionne en single-instance, pas urgent |
| Double GestureHandlerRootView | Bug visuel rare, pas bloquant |
| Mock login en prod | Désactiver par env, pas critique |
| Fake splash 2s | Cosmétique, UX mineure |
| Variables unused | Auto-fixable par lint, bruit |

### ❌ DETTES À NE PAS TRAITER MAINTENANT

| Dette | Raison de l'exclusion |
|-------|----------------------|
| Migration React Query | Overhead sans bénéfice immédiat, validation besoin d'abord |
| Migration state management (Redux/Zustand) | Stores actuels suffisants, over-engineering |
| Refactor API vers GraphQL | Changement fondamental, pas de gain prouvé |
| Micro-services | Architecture monolith suffisante n a pas d'échelle |
| TypeORM au lieu de Prisma | Migration destructive, Prisma fonctionne |
| i18n | Marché FR prioritaire, complexité prématurée |

---

## ÉTAPE 4 — RECOMMANDATIONS D'ARCHITECTURE

### 📱 Réorganisation ChatScreen (1200 → ~300 lignes)

**Structure cible :**

```
screens/
  ChatScreen.tsx              # Orchestrateur (~300 lignes)
  
hooks/
  chat/
    useChatMessages.ts        # Fetch, pagination, cache local
    useChatSocket.ts          # Socket listeners, reconnect
    useChatInput.ts           # Input state, send logic
    useChatOptimistic.ts      # tempId → realId reconciliation
    useChatActions.ts         # Edit, delete, reply
    
components/
  chat/
    ChatMessageList.tsx       # FlatList wrapper optimisé
    ChatMessageItem.tsx       # (existe déjà)
    ChatInputBar.tsx          # (existe déjà)
    ChatHeader.tsx            # Nouveau, extrait du screen
    ChatTypingIndicator.tsx   # Futur
```

**Principe de découpage :**
- 1 hook = 1 responsabilité
- Screen = composition de hooks + layout
- Pas de logique dans le Screen, seulement orchestration

---

### 🧠 Stratégie de Gestion d'État

**État actuel :**
- `AuthContext` : User + token (React Context)
- `AudioPlayerStore` / `AudioRecordingStore` : Singletons manuels

**Recommandation :**

| Type d'état | Solution | Justification |
|-------------|----------|---------------|
| **Auth** | React Context + AsyncStorage | Global, persisté, simple |
| **Messages conversation** | Local state + useReducer | Scoped au screen, complexe |
| **Audio** | Singletons actuels | OK, hardware-bound |
| **Cache API** | React Query (Phase 4) | Quand complexité justifiée |

**Pourquoi pas Redux/Zustand maintenant :**
- État global limité (auth seulement)
- Messages = état local, pas global
- Overhead de migration non justifié
- Évaluer après Phase 2, si douleur réelle

---

### 🔐 Stratégie Auth Persistée + Refresh Token

**Flow cible :**

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOGIN / REGISTER                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  API retourne :               │
              │  - accessToken (15 min)       │
              │  - refreshToken (30 jours)    │
              └──────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Mobile stocke :              │
              │  - accessToken → SecureStore  │
              │  - refreshToken → SecureStore │
              │  - user → AsyncStorage        │
              └──────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        APP RESTART                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Lire tokens de SecureStore   │
              │  Si accessToken expiré :      │
              │    → POST /auth/refresh       │
              │    → Stocker nouveaux tokens  │
              │  Sinon :                      │
              │    → Injecter dans Axios      │
              └──────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Axios Interceptor :          │
              │  Si 401 reçu :                │
              │    → Tenter refresh           │
              │    → Retry requête originale  │
              │    → Si refresh fail → logout │
              └──────────────────────────────┘
```

**Endpoints API à créer :**

| Endpoint | Méthode | Payload | Response |
|----------|---------|---------|----------|
| `/auth/refresh` | POST | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `/auth/logout` | POST | `{ refreshToken }` | `{ success }` |

**Stockage sécurisé :**
- `expo-secure-store` pour tokens (chiffré)
- `AsyncStorage` pour user data (non sensible)

---

### 🔌 Stratégie Socket Reconnect Fiable

**Problèmes actuels :**
1. Pas de reconnexion automatique après sleep/réseau
2. Room join unique au login, pas au reconnect
3. Pas de queue de messages offline

**Solution proposée :**

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOCKET MANAGER                              │
├─────────────────────────────────────────────────────────────────┤
│  Responsabilités :                                              │
│  1. Connexion initiale avec retry exponentiel                   │
│  2. Détection disconnect (NetInfo ou socket event)              │
│  3. Auto-reconnect avec backoff                                 │
│  4. Re-join room(userId) après reconnect                        │
│  5. Sync messages manqués via API (GET since lastMessageId)     │
│  6. Queue locale pour messages envoyés offline                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implémentation suggérée :**

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Détection réseau | `@react-native-community/netinfo` | Savoir si online |
| Reconnexion | `socket.io-client` native (auto) | Géré par lib |
| Re-join room | Event `connect` listener | Re-emit "join" |
| Sync messages | API call | `GET /messages/with/:id?since=lastId` |
| Queue offline | AsyncStorage | Messages en attente |

**Événements à gérer :**

```typescript
socket.on("connect", () => {
  // Re-join user room
  socket.emit("join", userId);
  // Sync missed messages
  syncMissedMessages();
});

socket.on("disconnect", (reason) => {
  // Log reason, show UI indicator
  if (reason === "io server disconnect") {
    // Server kicked us, reconnect manually
    socket.connect();
  }
  // Else: auto-reconnect handled by socket.io
});
```

---

## RÉSUMÉ EXÉCUTIF

### Ordre d'exécution strict

```
SEMAINE 1-2 (Phase 1)
├── Auth persistée (AsyncStorage + SecureStore)
├── Refresh token (API + client interceptor)
├── Socket reconnect (manager + re-join)
└── Documentation secrets

SEMAINE 3-4 (Phase 2a)
├── Types stricts (interfaces globales)
├── Split ChatScreen (5 hooks)
└── Tests auth + messages

SEMAINE 5-6 (Phase 2b)
├── Élimination any restants
├── CI/CD (lint + typecheck + test)
└── Stabilisation optimistic

SEMAINE 7-10 (Phase 3)
├── Pagination infinie
├── Redis obligatoire
├── Rate limiting
└── Storage S3

APRÈS (Phase 4)
├── Push notifications
├── Feed posts UI
└── Analytics + monitoring
```

### Critères de passage entre phases

| Phase | Critère de sortie |
|-------|-------------------|
| 1 → 2 | App restart = toujours connecté, socket stable 24h |
| 2 → 3 | 0 any critiques, ChatScreen < 400 lignes, tests green |
| 3 → 4 | Load test 1000 users OK, 0 crash prod |

---

> **Ce document est la feuille de route officielle.**  
> Chaque tâche sera exécutée séquentiellement par un agent IA.  
> Aucune feature Phase 4 ne sera commencée avant Phase 2 terminée.
