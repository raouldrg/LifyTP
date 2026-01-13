# Configuration des ports LifyTP pour l'API Monolithique

## ⚠️ IMPORTANT

L'API monolithique (`apps/api`) doit être configurée pour utiliser les **ports LifyTP isolés**, pas les ports Lify originaux.

## Configuration requise

Créez ou modifiez le fichier `apps/api/.env` avec les ports suivants :

```env
# Base de données Postgres - Port LifyTP : 5433 (PAS 5432)
DATABASE_URL="postgresql://lify:lify@localhost:5433/lify_dev?schema=public"

# Redis - Port LifyTP : 6380 (PAS 6379)  
REDIS_URL="redis://localhost:6380"

# MinIO - Ports LifyTP : 9100/9101 (PAS 9000/9001)
MINIO_ENDPOINT="localhost"
MINIO_PORT=9100
MINIO_ACCESS_KEY="lify"
MINIO_SECRET_KEY="lifypassword"
MINIO_USE_SSL=false

# JWT Secrets
JWT_ACCESS_SECRET="your-jwt-access-secret-change-in-production"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-change-in-production"

# API Port (optionnel, défaut 3000)
API_PORT=3000

# Node Environment
NODE_ENV=development
```

## Ports LifyTP vs Lify Original

| Service | Port Lify Original | Port LifyTP | Configuration |
|---------|-------------------|-------------|---------------|
| **Postgres** | 5432 | **5433** | `DATABASE_URL=...5433...` |
| **Redis** | 6379 | **6380** | `REDIS_URL=...6380` |
| **MinIO** | 9000/9001 | **9100/9101** | `MINIO_PORT=9100` |

## Commande rapide

```bash
# Créer/mettre à jour le fichier .env
cat > apps/api/.env << 'EOF'
DATABASE_URL="postgresql://lify:lify@localhost:5433/lify_dev?schema=public"
REDIS_URL="redis://localhost:6380"
MINIO_ENDPOINT="localhost"
MINIO_PORT=9100
MINIO_ACCESS_KEY="lify"
MINIO_SECRET_KEY="lifypassword"
MINIO_USE_SSL=false
JWT_ACCESS_SECRET="your-jwt-access-secret-change-in-production"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-change-in-production"
API_PORT=3000
NODE_ENV=development
EOF
```

## Vérification

Après avoir configuré le `.env`, vérifiez :

```bash
# 1. Infrastructure LifyTP démarrée
npm run lifytp:start

# 2. Postgres accessible sur port 5433
psql -h localhost -p 5433 -U lify -d lify_dev

# 3. Redis accessible sur port 6380
redis-cli -p 6380 PING

# 4. Démarrer l'API
npm run dev:api
```

## Références

- [LIFYTP_ISOLATION.md](LIFYTP_ISOLATION.md) - Documentation de l'isolation LifyTP
- [FRONTEND_BACKEND_CONFIG.md](FRONTEND_BACKEND_CONFIG.md) - Configuration frontend-backend
