# Tests Finaux Kubernetes - Services Events et Messages

**Date**: 12 janvier 2026, 19:30  
**Objectif**: Valider tous les endpoints Kubernetes pour soutenance

---

## Tests Events Service (Port 4101)

### Port-Forward
```bash
kubectl port-forward -n lifytp service/events-service 4101:4101 &
# Forwarding from 127.0.0.1:4101 -> 4101
# Forwarding from [::1]:4101 -> 4101
```

### Health Check
```bash
curl http://localhost:4101/health
```

**Output:**
```json
{"status":"ok","service":"events-service","port":4101}
```

✅ **Résultat**: Service events opérationnel via Kubernetes

### Endpoint Demo (GET /events)
```bash
curl http://localhost:4101/events
```

**Output:**
```json
{"message":"Events service is running","events":[]}
```

✅ **Résultat**: Route métier fonctionnelle (retourne liste vide comme attendu)

---

## Tests Messages Service (Port 4102)

### Port-Forward
```bash
kubectl port-forward -n lifytp service/messages-service 4102:4102 &
# Forwarding from 127.0.0.1:4102 -> 4102
# Forwarding from [::1]:4102 -> 4102
```

### Health Check
```bash
curl http://localhost:4102/health
```

**Output:**
```json
{"status":"ok","service":"messages-service","port":4102}
```

✅ **Résultat**: Service messages opérationnel via Kubernetes

### Endpoint Demo (GET /messages/conversations)
```bash
curl http://localhost:4102/messages/conversations
```

**Output:**
```json
{"message":"Messages service is running","conversations":[]}
```

✅ **Résultat**: Route métier fonctionnelle (retourne liste vide comme attendu)

---

## Récapitulatif Tests Kubernetes

| Service | Port | Health Check | Route métier | Status |
|---------|------|--------------|--------------|--------|
| **Auth** | 4100 | ✅ OK | POST /auth/test ✅ | ✅ Opérationnel |
| **Events** | 4101 | ✅ OK | GET /events ✅ | ✅ Opérationnel |
| **Messages** | 4102 | ✅ OK | GET /messages/conversations ✅ | ✅ Opérationnel |

**Conclusion**: ✅ Tous les microservices accessibles et fonctionnels via Kubernetes

---

## Sécurisation Images Docker

### Modification ImagePullPolicy

**Avant** (développement):
```yaml
imagePullPolicy: Never  # Utilise uniquement images locales
```

**Après** (production-ready):
```yaml
imagePullPolicy: IfNotPresent  # Utilise image locale si existe, sinon pull depuis registry
```

**Fichiers modifiés:**
- `deploy/deployments/auth-deployment.yaml`
- `deploy/deployments/events-deployment.yaml`
- `deploy/deployments/messages-deployment.yaml`

### Stratégie Images

**Développement Local:**
- Images: `lifytp-auth-service:latest`, `lifytp-events-service:latest`, `lifytp-messages-service:latest`
- Source: Build local via `docker compose build`
- Pull Policy: `IfNotPresent` (utilise local d'abord)

**Production:**
- Images: `ghcr.io/raouldrg/lifytp-auth:v1.0.0`, `ghcr.io/raouldrg/lifytp-events:v1.0.0`, etc.
- Source: GitHub Container Registry (GHCR)
- Tags: Versions sémantiques (v1.0.0, v1.0.1, etc.)
- Pull Policy: `IfNotPresent` ou `Always` (selon stratégie)

**Note importante**: Pour utiliser GHCR en production, modifier les images dans les deployments:
```yaml
# Remplacer:
image: lifytp-auth-service:latest

# Par:
image: ghcr.io/raouldrg/lifytp-auth:v1.0.0
```

Le workflow CD (`.github/workflows/cd-main.yml`) est déjà configuré pour push vers GHCR.

---

## Vérification Base de Données PostgreSQL

### User PostgreSQL

**Commande:**
```bash
kubectl exec -n lifytp postgres-0 -- psql -U lify -d lifytp_dev -c "\du"
```

**Output:**
```
Role name |                         Attributes
-----------+------------------------------------------------------------
lify      | Superuser, Create role, Create DB, Replication, Bypass RLS
```

✅ **Résultat**: Utilisateur `lify` existe avec tous les privilèges

### Database

**Commande:**
```bash
kubectl exec -n lifytp postgres-0 -- psql -U lify -d lifytp_dev -c "\l"
```

**Output (extrait):**
```
Name       | Owner | Encoding | Locale Provider | Collate    | Ctype
-----------+-------+----------+-----------------+------------+------------
lifytp_dev | lify  | UTF8     | libc            | en_US.utf8 | en_US.utf8
```

✅ **Résultat**: Base de données `lifytp_dev` existe, owner `lify`

### Conclusion DB

- ✅ L'utilisateur PostgreSQL `lify` est créé automatiquement par l'image `postgres:16-alpine`
- ✅ La database `lifytp_dev` est créée automatiquement via `POSTGRES_DB` env var
- ✅ Aucune action manuelle requise

**Configuration utilisée** (dans `postgres-statefulset.yaml`):
```yaml
env:
- name: POSTGRES_USER
  value: "lify"
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-secret
      key: POSTGRES_PASSWORD
- name: POSTGRES_DB
  value: "lifytp_dev"
```

**Prochaine étape** (si nécessaire): Exécuter migrations Prisma
```bash
# Depuis un pod de service
kubectl exec -it <auth-pod> -n lifytp -- npx prisma migrate deploy

# Ou depuis local avec port-forward vers postgres
kubectl port-forward -n lifytp postgres-0 5432:5432 &
DATABASE_URL="postgresql://lify:lify@localhost:5432/lifytp_dev" npx prisma migrate deploy
```

---

**TOUS LES TESTS VALIDÉS - PRÊT POUR SOUTENANCE** ✅
