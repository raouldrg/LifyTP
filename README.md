# 🚀 LifyTP - Application Sociale de Calendrier

> Application mobile sociale de gestion d'événements avec messagerie temps réel, déployable en architecture microservices sur Kubernetes.

---

## 📋 Table des Matières

- [Prérequis](#-prérequis)
- [Structure du Projet](#-structure-du-projet)
- [Démarrage Rapide](#-démarrage-rapide)
- [Configuration](#-configuration)
- [Déploiement Kubernetes](#-déploiement-kubernetes)
- [CI/CD](#-cicd)
- [Stack Technique](#-stack-technique)
- [Développement](#-développement)

---

## 🔧 Prérequis

| Outil | Version | Vérification |
|-------|---------|--------------|
| **Node.js** | v18+ | `node -v` |
| **Docker** | Latest | `docker -v` |
| **npm** | v9+ | `npm -v` |
| **kubectl** | Latest (optionnel) | `kubectl version` |

---

## 📂 Structure du Projet

```
LifyTP/
├── apps/
│   ├── api/                    # Backend monolithique (Fastify + Prisma)
│   │   ├── prisma/             # Schéma DB et migrations
│   │   └── src/                # Code source API
│   └── mobile/                 # App React Native (Expo)
│       └── src/                # Screens, components, services
├── services/                   # Microservices (pour K8s)
│   ├── auth-service/           # Authentification (port 4100)
│   ├── events-service/         # Événements (port 4101)
│   ├── messages-service/       # Messagerie (port 4102)
│   └── shared/                 # Code partagé (Prisma schema)
├── deploy/                     # Manifests Kubernetes
│   ├── configmaps/             # ConfigMaps
│   ├── deployments/            # Deployments
│   ├── services/               # Services K8s
│   ├── secrets/                # Templates secrets
│   └── volumes/                # PVC
├── scripts/                    # Scripts de démarrage
├── .github/workflows/          # CI/CD GitHub Actions
├── docker-compose.lifytp.yml   # Docker Compose (infra locale)
└── MIGRATION_AND_K8S.md        # Doc architecture microservices + K8s
```

---

## 🚀 Démarrage Rapide

### Option 1 : Tout en Une Commande (Recommandé)

```bash
npm run lifytp:dev
```

Lance automatiquement :
- ✅ Infrastructure Docker (Postgres, Redis, MinIO, MailHog)
- ✅ API Backend (port 3000)
- ✅ App Mobile (Expo)

### Option 2 : Démarrage Séparé

**Terminal 1 - Backend :**
```bash
npm run lifytp:start
```

**Terminal 2 - Mobile :**
```bash
npm run dev:mobile
```

### Arrêt

```bash
# Arrêter (conserver les données)
npm run lifytp:stop

# Nettoyer tout (⚠️ supprime les données)
npm run lifytp:clean
```

---

## ⚙️ Configuration

### Ports LifyTP (Isolation Complète)

LifyTP utilise des ports dédiés pour éviter tout conflit avec d'autres projets :

| Service | Port LifyTP | Usage |
|---------|-------------|-------|
| **Postgres** | 5433 | Base de données |
| **Redis** | 6380 | Cache/Sessions |
| **MinIO API** | 9100 | Stockage objets |
| **MinIO Console** | 9101 | Console MinIO |
| **MailHog SMTP** | 1026 | Email dev |
| **MailHog UI** | 8026 | Interface email |
| **API Monolithique** | 3000 | Backend unifié |
| **Auth Service** | 4100 | Microservice Auth |
| **Events Service** | 4101 | Microservice Events |
| **Messages Service** | 4102 | Microservice Messages |

### Configuration API (.env)

Créer `apps/api/.env` :

```env
# Database
DATABASE_URL="postgresql://lify:lify@localhost:5433/lify_dev?schema=public"

# Redis
REDIS_URL="redis://localhost:6380"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9100
MINIO_ACCESS_KEY="lify"
MINIO_SECRET_KEY="lifypassword"
MINIO_USE_SSL=false

# JWT
JWT_ACCESS_SECRET="your-jwt-access-secret-change-in-production"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-change-in-production"

# Server
API_PORT=3000
NODE_ENV=development
```

### Mode Backend (Mobile)

L'app mobile peut basculer entre 2 modes :

| Mode | Utilisation | Configuration |
|------|-------------|---------------|
| **Monolith** (défaut) | Développement local | 1 seul endpoint (port 3000) |
| **Microservices** | Démo Kubernetes | 3 endpoints (ports 4100-4102) |

Pour changer de mode, créer `apps/mobile/.env` :

```env
# Mode Monolith (défaut)
EXPO_PUBLIC_BACKEND_MODE=monolith

# OU Mode Microservices
EXPO_PUBLIC_BACKEND_MODE=microservices
```

---

## ☸️ Déploiement Kubernetes

### Prérequis

- Cluster Kubernetes actif (Docker Desktop K8s ou Minikube)
- kubectl configuré

### Déploiement Complet

```bash
# 1. Créer le namespace
kubectl apply -f deploy/namespace.yaml

# 2. Créer les secrets (adapter les valeurs)
kubectl create secret generic db-secret \
  --from-literal=DATABASE_URL="postgresql://lify:lify@postgres-service:5432/lifytp_dev" \
  --from-literal=POSTGRES_PASSWORD="lify" \
  --namespace=lifytp

kubectl create secret generic jwt-secret \
  --from-literal=JWT_ACCESS_SECRET="your-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-refresh-secret" \
  --namespace=lifytp

kubectl create secret generic minio-secret \
  --from-literal=MINIO_ACCESS_KEY="lify" \
  --from-literal=MINIO_SECRET_KEY="lifypassword" \
  --namespace=lifytp

# 3. Déployer l'infrastructure
kubectl apply -f deploy/configmaps/
kubectl apply -f deploy/volumes/
kubectl apply -f deploy/deployments/
kubectl apply -f deploy/services/

# 4. Vérifier le déploiement
kubectl get pods -n lifytp
kubectl get svc -n lifytp
```

### Accès Local aux Services (port-forward)

```bash
kubectl port-forward -n lifytp service/auth-service 4100:4100 &
kubectl port-forward -n lifytp service/events-service 4101:4101 &
kubectl port-forward -n lifytp service/messages-service 4102:4102 &
```

### Commandes Utiles

```bash
# Voir tous les objets
kubectl get all -n lifytp

# Logs d'un service
kubectl logs -f deployment/auth-service -n lifytp

# Décrire un pod
kubectl describe pod <pod-name> -n lifytp

# Supprimer tout
kubectl delete namespace lifytp
```

> 📖 **Documentation complète K8s :** Voir [MIGRATION_AND_K8S.md](MIGRATION_AND_K8S.md)

---

## 🔄 CI/CD

### Workflow CI (develop)

**Trigger :** Push/PR sur `develop`

**Étapes :**
1. Lint code
2. Type check TypeScript
3. Build des 3 microservices

**Fichier :** [`.github/workflows/ci-develop.yml`](.github/workflows/ci-develop.yml)

### Workflow CD (production)

**Trigger :** Push d'un tag `v*` (ex: `v1.0.0`)

**Étapes :**
1. Build des images Docker
2. Push vers GitHub Container Registry (GHCR)
3. Déploiement sur Kubernetes

**Fichier :** [`.github/workflows/cd-main.yml`](.github/workflows/cd-main.yml)

### Créer une Release

```bash
# Créer et pousser un tag
git tag v1.0.0
git push origin v1.0.0

# Le CD se déclenche automatiquement
```

---

## 🛠 Stack Technique

### Backend

| Composant | Technologie |
|-----------|-------------|
| Framework | Fastify |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Auth | JWT + bcrypt |
| Realtime | Socket.io |

### Frontend Mobile

| Composant | Technologie |
|-----------|-------------|
| Framework | React Native (Expo) |
| Navigation | React Navigation |
| HTTP | Axios |
| Realtime | Socket.io-client |
| Animations | Reanimated |

### DevOps

| Composant | Technologie |
|-----------|-------------|
| Containers | Docker |
| Orchestration | Kubernetes |
| CI/CD | GitHub Actions |
| Registry | GHCR |

---

## 💻 Développement

### Commandes Disponibles

| Commande | Description |
|----------|-------------|
| `npm run lifytp:start` | Démarre infra + API |
| `npm run lifytp:dev` | Démarre tout (infra + API + mobile) |
| `npm run lifytp:stop` | Arrête Docker |
| `npm run lifytp:clean` | Nettoie tout (données incluses) |
| `npm run lifytp:logs` | Logs Docker |
| `npm run dev:api` | API seule |
| `npm run dev:mobile` | Mobile seul |
| `npm run lint` | Lint du projet |
| `npm run typecheck` | Vérification TypeScript |

### Identifiants de Développement

| Service | User | Password |
|---------|------|----------|
| **PostgreSQL** | lify | lify |
| **MinIO** | lify | lifypassword |
| **App (mock login)** | test@lify.app | (aucun) |

### Base de Données (Prisma)

```bash
# Ouvrir Prisma Studio
cd apps/api
npx prisma studio

# Appliquer les migrations
npx prisma migrate dev

# Générer le client
npx prisma generate
```

---

## 📚 Documentation Additionnelle

- **[MIGRATION_AND_K8S.md](MIGRATION_AND_K8S.md)** - Architecture microservices et déploiement Kubernetes détaillé
- **[archive/docs/](archive/docs/)** - Documentation archivée (analyses, roadmaps, rapports)

---

## 📝 Licence

Projet académique - LifyTP
