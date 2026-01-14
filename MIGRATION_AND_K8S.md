# 🏗️ Migration Monolithe → Microservices et Architecture Kubernetes

> Ce document détaille l'évolution architecturale de LifyTP, passant d'une API monolithique à une architecture microservices déployée sur Kubernetes.

---

## 📋 Table des Matières

- [Contexte et Objectifs](#-contexte-et-objectifs)
- [Architecture Avant/Après](#-architecture-avantaprès)
- [Découpage en Microservices](#-découpage-en-microservices)
- [Communication Inter-Services](#-communication-inter-services)
- [Dockerisation](#-dockerisation)
- [Architecture Kubernetes](#-architecture-kubernetes)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Démonstrations](#-démonstrations)
- [Difficultés et Solutions](#-difficultés-et-solutions)

---

## 🎯 Contexte et Objectifs

### Contexte Initial

LifyTP est une application sociale de gestion d'événements avec :
- Authentification utilisateurs
- Gestion d'événements et calendrier
- Messagerie temps réel
- Système de follow/followers
- Feed social

### Objectifs de la Migration

| Objectif | Bénéfice |
|----------|----------|
| **Scalabilité** | Scaling indépendant par service |
| **Haute Disponibilité** | Replicas + auto-healing |
| **Déploiement Continu** | Rolling updates sans downtime |
| **Isolation** | Défaillance d'un service n'impacte pas les autres |
| **Maintenabilité** | Code séparé par domaine métier |

---

## 🔄 Architecture Avant/Après

### AVANT : API Monolithique

```
┌─────────────────────────────────────────────────────────┐
│                    API MONOLITHIQUE                      │
│                      (Port 3000)                         │
├─────────────────────────────────────────────────────────┤
│  /auth/*     │  /events/*   │  /messages/*  │  /users/* │
├─────────────────────────────────────────────────────────┤
│                    Prisma Client                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     PostgreSQL        │
              └───────────────────────┘
```

**Caractéristiques :**
- Tous les endpoints dans un seul processus
- Scaling vertical uniquement
- Déploiement tout-ou-rien
- Single point of failure

### APRÈS : Architecture Microservices

```
                    ┌─────────────────┐
                    │   Mobile App    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Auth Service  │  │Events Service │  │Messages Svc   │
│   (4100)      │  │   (4101)      │  │   (4102)      │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      ┌───────────────┐        ┌───────────────┐
      │  PostgreSQL   │        │     Redis     │
      └───────────────┘        └───────────────┘
```

**Caractéristiques :**
- Services indépendants par domaine
- Scaling horizontal par service
- Déploiement indépendant
- Haute disponibilité (replicas)

---

## 🧩 Découpage en Microservices

### Principe de Découpage

Le découpage suit le **Domain-Driven Design (DDD)** :

| Service | Domaine Métier | Responsabilités |
|---------|----------------|-----------------|
| **Auth Service** | Identité & Accès | Login, Register, JWT, Profils, Follow |
| **Events Service** | Calendrier | CRUD événements, Participants, Médias |
| **Messages Service** | Communication | Conversations, Messages, Réactions |

### Auth Service (Port 4100)

```
services/auth-service/
├── src/
│   ├── index.ts           # Point d'entrée Fastify
│   ├── routes/
│   │   ├── auth.ts        # Login, register, refresh
│   │   ├── users.ts       # Profils, recherche
│   │   └── follow.ts      # Follow/unfollow
│   └── lib/
│       ├── prisma.ts      # Client DB
│       ├── auth.ts        # Middleware JWT
│       └── password.ts    # Hashing bcrypt
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Endpoints clés :**
- `POST /auth/login` - Authentification
- `POST /auth/register` - Inscription
- `GET /health` - Health check

### Events Service (Port 4101)

```
services/events-service/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── events.ts      # CRUD événements
│   │   ├── calendars.ts   # Import calendriers
│   │   ├── media.ts       # Upload médias
│   │   └── posts.ts       # Posts liés
│   └── lib/
│       ├── prisma.ts
│       └── auth.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Endpoints clés :**
- `GET /events` - Liste événements
- `POST /events` - Créer événement
- `GET /health` - Health check

### Messages Service (Port 4102)

```
services/messages-service/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── messages.ts     # Envoi, réception
│   │   └── notifications.ts
│   └── lib/
│       ├── prisma.ts
│       └── auth.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Endpoints clés :**
- `GET /messages/conversations` - Liste conversations
- `POST /messages` - Envoyer message
- `GET /health` - Health check

---

## 🔗 Communication Inter-Services

### Type de Communication

| Type | Utilisation | Technologie |
|------|-------------|-------------|
| **Synchrone** | Requêtes API | REST HTTP |
| **Asynchrone** | Notifications temps réel | Socket.io + Redis |

### Base de Données Partagée

Pour ce TP, les services partagent la même base PostgreSQL (simplification). En production :

```
✅ Actuel (TP) : BDD partagée (schéma Prisma unique)
🔮 Production  : BDD par service + Event Sourcing
```

### Schéma Prisma Partagé

```
services/shared/
└── prisma/
    └── schema.prisma   # Schéma unique, généré dans chaque service
```

Chaque service génère son propre Prisma Client au build :
```dockerfile
RUN npx prisma generate --schema=./shared/prisma/schema.prisma
```

---

## 🐳 Dockerisation

### Structure des Dockerfiles

Chaque microservice a le même pattern :

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Dépendances
COPY services/<service>/package*.json ./
RUN npm install

# Schéma Prisma partagé
COPY services/shared/prisma ./shared/prisma
RUN npx prisma generate --schema=./shared/prisma/schema.prisma

# Code source
COPY services/<service>/src ./src
COPY services/<service>/tsconfig.json ./

# Sécurité : user non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE <port>

CMD ["npx", "tsx", "src/index.ts"]
```

**Caractéristiques :**
- Image Alpine légère (~200MB)
- Exécution TypeScript directe (tsx)
- User non-root (sécurité)
- Multi-stage possible pour production

### Docker Compose Local

**Fichier :** `docker-compose.lifytp.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: lify
      POSTGRES_PASSWORD: lify
      POSTGRES_DB: lify_dev
    ports:
      - "5433:5432"  # Port LifyTP dédié
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"  # Port LifyTP dédié

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9100:9000"  # Port LifyTP dédié
      - "9101:9001"

volumes:
  pgdata:
  minio:

networks:
  lifytp-network:
    driver: bridge
```

**Isolation :** Ports différents de Lify original (5432→5433, 6379→6380, etc.)

---

## ☸️ Architecture Kubernetes

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    Namespace: lifytp                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Auth        │  │ Events      │  │ Messages    │              │
│  │ Deployment  │  │ Deployment  │  │ Deployment  │              │
│  │ (2 replicas)│  │ (2 replicas)│  │ (2 replicas)│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐              │
│  │ Auth        │  │ Events      │  │ Messages    │              │
│  │ Service     │  │ Service     │  │ Service     │              │
│  │ ClusterIP   │  │ ClusterIP   │  │ ClusterIP   │              │
│  │ :4100       │  │ :4101       │  │ :4102       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │                  PostgreSQL                          │        │
│  │                  StatefulSet                         │        │
│  │                  (1 replica + PVC)                   │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │ ConfigMaps   │   │   Secrets    │   │   PVC        │         │
│  │ (3)          │   │   (3)        │   │   (1)        │         │
│  └──────────────┘   └──────────────┘   └──────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Objets Kubernetes Utilisés

| Objet | Quantité | Rôle |
|-------|----------|------|
| **Namespace** | 1 | Isolation `lifytp` |
| **Deployment** | 5 | Auth, Events, Messages, Redis |
| **StatefulSet** | 1 | PostgreSQL (données persistantes) |
| **Service (ClusterIP)** | 5 | Exposition interne |
| **ConfigMap** | 3 | Configuration non-sensible |
| **Secret** | 3 | Credentials (DB, JWT, MinIO) |
| **PVC** | 1 | Stockage PostgreSQL |

### Fichiers Manifests

```
deploy/
├── namespace.yaml              # Namespace lifytp
├── configmaps/
│   ├── auth-config.yaml       # Config auth-service
│   ├── events-config.yaml     # Config events-service
│   └── messages-config.yaml   # Config messages-service
├── secrets/
│   ├── db-secret.yaml.example # Template secret DB
│   ├── jwt-secret.yaml.example
│   └── minio-secret.yaml.example
├── deployments/
│   ├── auth-deployment.yaml   # 2 replicas auth
│   ├── events-deployment.yaml # 2 replicas events
│   ├── messages-deployment.yaml
│   ├── postgres-statefulset.yaml
│   └── redis-deployment.yaml
├── services/
│   ├── auth-service.yaml      # ClusterIP :4100
│   ├── events-service.yaml    # ClusterIP :4101
│   ├── messages-service.yaml  # ClusterIP :4102
│   ├── postgres-service.yaml  # Headless
│   └── redis-service.yaml
└── volumes/
    └── postgres-pvc.yaml      # 5Gi storage
```

### Exemple : Deployment Auth Service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: lifytp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth
        image: lifytp-auth-service:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 4100
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: DATABASE_URL
        livenessProbe:
          httpGet:
            path: /health
            port: 4100
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4100
          initialDelaySeconds: 5
          periodSeconds: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

**Points clés :**
- `replicas: 2` → Haute disponibilité
- `livenessProbe` → Auto-restart si crash
- `readinessProbe` → Load balancing intelligent
- `RollingUpdate` → Déploiement sans downtime

### ConfigMaps et Secrets

**ConfigMap (non-sensible) :**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-config
  namespace: lifytp
data:
  NODE_ENV: "production"
  PORT: "4100"
  JWT_ACCESS_EXPIRES: "7d"
```

**Secret (sensible) :**
```bash
kubectl create secret generic db-secret \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=POSTGRES_PASSWORD="..." \
  --namespace=lifytp
```

### Persistance (PVC)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: lifytp
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

---

## 🔄 CI/CD Pipeline

### Architecture CI/CD

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Push     │────▶│   GitHub    │────▶│  Kubernetes │
│  develop    │     │   Actions   │     │   Cluster   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌─────────┐   ┌─────────┐
              │   CI    │   │   CD    │
              │ (lint,  │   │ (build, │
              │  build) │   │  push,  │
              └─────────┘   │ deploy) │
                            └─────────┘
```

### Workflow CI (develop)

**Trigger :** Push ou PR sur `develop`

```yaml
jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build  # Chaque microservice
```

### Workflow CD (production)

**Trigger :** Push d'un tag `v*`

```yaml
jobs:
  build-and-push:
    strategy:
      matrix:
        service: [auth, events, messages]
    steps:
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ owner }}/lifytp-${{ service }}:${{ version }}

  deploy-to-kubernetes:
    needs: build-and-push
    steps:
      - run: kubectl apply -f deploy/
      - run: kubectl rollout status deployment/auth-service -n lifytp
```

---

## 🎬 Démonstrations

### Démo Auto-Healing

**Objectif :** Prouver que Kubernetes recrée automatiquement les pods supprimés.

**Procédure :**

```bash
# Terminal 1 : Monitoring
kubectl get pods -n lifytp -l app=auth-service -w

# Terminal 2 : Supprimer un pod
kubectl delete pod auth-service-xxx -n lifytp
```

**Résultat attendu :**
1. Le pod passe en `Terminating`
2. Un nouveau pod est créé instantanément
3. Le nouveau pod passe `Running` en ~9 secondes
4. **Zero downtime** car le 2ème replica continue de servir

### Démo Rolling Update

**Objectif :** Mettre à jour sans interruption de service.

**Procédure :**

```bash
# Terminal 1 : Monitoring
kubectl get pods -n lifytp -l app=auth-service -w

# Terminal 2 : Déclencher update
kubectl patch deployment auth-service -n lifytp \
  -p '{"spec":{"template":{"metadata":{"annotations":{"version":"v2"}}}}}'
```

**Résultat attendu :**
1. Nouveaux pods créés progressivement
2. Anciens pods terminés un par un
3. Toujours ≥1 pod disponible
4. **~30 secondes** pour update complet

### Test Disponibilité Pendant Update

```bash
# Pendant le rolling update
while true; do curl -s http://localhost:4100/health && echo " OK"; sleep 1; done
```
Aucune requête ne doit échouer.

---

## ⚠️ Difficultés et Solutions

### 1. Images Docker Non Trouvées

**Problème :** `ImagePullBackOff` - images GHCR non disponibles en local

**Solution :**
```yaml
# Avant (production)
imagePullPolicy: Always

# Après (dev local)
imagePullPolicy: IfNotPresent  # ou Never
```

### 2. Imports Cassés dans Microservices

**Problème :** Routes copiées du monolithe avec imports relatifs invalides

**Solution :** Créer les fichiers `lib/` locaux dans chaque service :
- `prisma.ts` - Client Prisma
- `auth.ts` - Middleware JWT
- `password.ts` - Hashing

### 3. Secrets Non Créés

**Problème :** Pods en `CrashLoopBackOff` car secrets manquants

**Solution :** Créer les secrets AVANT les deployments :
```bash
kubectl create secret generic db-secret --from-literal=... -n lifytp
```

### 4. Espace dans Clé ConfigMap

**Problème :** `JWT_RE FRESH_EXPIRES` au lieu de `JWT_REFRESH_EXPIRES`

**Solution :** Vérifier les fichiers YAML avec un linter

### 5. Health Checks Échouent

**Problème :** `wget` non disponible dans image Alpine

**Solution :** Utiliser `curl` ou installer `wget` :
```dockerfile
RUN apk add --no-cache wget
```

---

## 📊 Récapitulatif

### État Final Kubernetes

| Ressource | Quantité | Status |
|-----------|----------|--------|
| **Pods** | 8 | ✅ Running |
| **Services** | 5 | ✅ ClusterIP |
| **Deployments** | 4 | ✅ Ready |
| **StatefulSet** | 1 | ✅ Ready |
| **ConfigMaps** | 3 | ✅ Created |
| **Secrets** | 3 | ✅ Created |
| **PVC** | 1 | ✅ Bound |

### Capacités Démontrées

| Capacité | Démo | Résultat |
|----------|------|----------|
| **Auto-healing** | Pod supprimé → recréé | ✅ ~9s |
| **Rolling update** | Update sans downtime | ✅ ~30s |
| **Load balancing** | 2 replicas actifs | ✅ |
| **Health probes** | Liveness + Readiness | ✅ |
| **Secrets management** | Credentials chiffrés | ✅ |
| **Configuration externe** | ConfigMaps | ✅ |

---

## 📚 Références

- **README principal :** [README.md](README.md)
- **Manifests K8s :** [deploy/](deploy/)
- **Microservices :** [services/](services/)
- **CI/CD Workflows :** [.github/workflows/](.github/workflows/)
