#!/bin/bash

# Configuration automatique de l'API pour LifyTP
echo "🔧 Configuration de l'API pour LifyTP..."

cd "$(dirname "$0")/../apps/api"

# Création du fichier .env avec les ports LifyTP
cat > .env << 'EOF'
# ========================================
# Configuration LifyTP - Ports isolés
# ========================================

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

# API Port
API_PORT=3000

# Node Environment
NODE_ENV=development
EOF

echo "✅ Fichier .env créé avec les ports LifyTP"
echo ""
echo "Configuration appliquée :"
echo "  - Postgres : localhost:5433"
echo "  - Redis    : localhost:6380"
echo "  - MinIO    : localhost:9100"
echo ""
echo "⚠️  Redémarrez l'API pour appliquer les changements :"
echo "    Ctrl+C dans le terminal de l'API, puis :"
echo "    npm run lifytp:start"
