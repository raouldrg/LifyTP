#!/bin/bash

echo "🧹 Nettoyage complet de LifyTP..."
echo ""
echo "⚠️  Cela supprimera tous les volumes (données Postgres, MinIO, etc.)"
read -p "Continuer? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Arrêter et supprimer containers + volumes
    docker compose -p lifytp -f docker-compose.lifytp.yml down -v
    
    echo ""
    echo "✅ LifyTP complètement nettoyé!"
    echo ""
    echo "💡 Redémarrer avec : npm run lifytp:start"
else
    echo ""
    echo "❌ Nettoyage annulé"
fi
echo ""
