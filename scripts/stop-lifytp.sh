#!/bin/bash

echo "⏹️  Arrêt de LifyTP..."
echo ""

# Arrêter les containers sans toucher aux volumes
docker compose -p lifytp -f docker-compose.lifytp.yml down

echo ""
echo "✅ LifyTP arrêté avec succès!"
echo ""
echo "💡 Les volumes sont conservés. Pour un nettoyage complet : npm run lifytp:clean"
echo ""
