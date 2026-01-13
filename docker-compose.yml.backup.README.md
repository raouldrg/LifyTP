# ⚠️ ANCIEN FICHIER - NE PLUS UTILISER

Ce fichier a été renommé en `.backup` car il n'est plus utilisé.

**Utilisez désormais : `docker-compose.lifytp.yml`**

## Raison du changement

L'ancien `docker-compose.yml` créait des conflits avec le projet Lify original :
- Container names identiques (`lify_*`)
- Ports partagés (5432, 6379, 9000/9001)
- Pas d'isolation entre les deux projets

## Nouvelle configuration

Le nouveau fichier `docker-compose.lifytp.yml` utilise :
- ✅ Aucun `container_name` (Docker génère automatiquement avec préfixe `lifytp-`)
- ✅ Project name dédié : `-p lifytp`
- ✅ Ports dédiés LifyTP :
  - Postgres : **5433** (au lieu de 5432)
  - Redis : **6380** (au lieu de 6379)
  - MinIO : **9100/9101** (au lieu de 9000/9001)
  - MailHog : **1026/8026** (au lieu de 1025/8025)

## Commandes à utiliser

```bash
# Démarrer LifyTP
npm run lifytp:start

# Arrêter LifyTP
npm run lifytp:stop

# Nettoyer LifyTP
npm run lifytp:clean

# Voir les logs
npm run lifytp:logs
```

---

**Ce fichier est conservé pour référence uniquement.**
