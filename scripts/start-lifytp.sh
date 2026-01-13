#!/bin/bash

echo "🚀 Démarrage de LifyTP..."
echo ""

# Démarrer les containers avec le nom de projet dédié
docker compose -p lifytp -f docker-compose.lifytp.yml up -d

echo ""
echo "✅ LifyTP démarré avec succès!"
echo ""
echo "📊 Services disponibles:"
echo "  - Postgres : localhost:5433"
echo "  - Redis    : localhost:6380"
echo "  - MinIO    : http://localhost:9100 (API) / http://localhost:9101 (Console)"
echo "  - MailHog  : http://localhost:8026 (UI) / localhost:1026 (SMTP)"
echo ""
echo "📝 Commandes utiles:"
echo "  - Voir les logs : npm run lifytp:logs"
echo "  - Arrêter      : npm run lifytp:stop"
echo "  - Nettoyer     : npm run lifytp:clean"
echo ""
