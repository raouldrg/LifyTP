# 🔒 Isolation LifyTP

## Contexte

LifyTP est maintenant **totalement isolé** du projet Lify original. Les deux projets peuvent fonctionner **en parallèle** sans aucun conflit.

---

## ⚠️ Problèmes résolus

Avant cette isolation, LifyTP causait des conflits avec Lify :

| Problème | Impact | Solution |
|----------|--------|----------|
| Container names `lify_*` | Impossible de lancer les deux projets | Suppression des `container_name` → Docker génère `lifytp-*` |
| Ports partagés (5432, 6379, etc.) | Conflits de ports | Ports dédiés LifyTP (5433, 6380, etc.) |
| Docker Compose non isolé | Commandes affectant les deux projets | Fichier dédié + project name `-p lifytp` |

---

## 🔧 Configuration LifyTP

### Ports dédiés

| Service | Port Lify Original | Port LifyTP | Accès LifyTP |
|---------|-------------------|-------------|--------------|
| **Postgres** | 5432 | **5433** | `psql -h localhost -p 5433 -U lify` |
| **Redis** | 6379 | **6380** | `redis-cli -p 6380` |
| **MinIO API** | 9000 | **9100** | `http://localhost:9100` |
| **MinIO Console** | 9001 | **9101** | `http://localhost:9101` |
| **MailHog SMTP** | 1025 | **1026** | `localhost:1026` |
| **MailHog UI** | 8025 | **8026** | `http://localhost:8026` |

### Microservices (ports inchangés)

| Service | Port | Accessible sur |
|---------|------|----------------|
| Auth Service | 4100 | `http://localhost:4100` |
| Events Service | 4101 | `http://localhost:4101` |
| Messages Service | 4102 | `http://localhost:4102` |

---

## 🚀 Commandes LifyTP

### Démarrage

```bash
# Méthode recommandée
npm run lifytp:start

# Équivalent à
docker compose -p lifytp -f docker-compose.lifytp.yml up -d
```

**Sortie attendue :**
```
🚀 Démarrage de LifyTP...

✅ LifyTP démarré avec succès!

📊 Services disponibles:
  - Postgres : localhost:5433
  - Redis    : localhost:6380
  - MinIO    : http://localhost:9100 (API) / http://localhost:9101 (Console)
  - MailHog  : http://localhost:8026 (UI) / localhost:1026 (SMTP)
```

### Logs en temps réel

```bash
npm run lifytp:logs

# Ou pour un service spécifique
docker compose -p lifytp -f docker-compose.lifytp.yml logs -f postgres
```

### Arrêt

```bash
# Arrêter sans supprimer les volumes (données conservées)
npm run lifytp:stop

# Équivalent à
docker compose -p lifytp -f docker-compose.lifytp.yml down
```

### Nettoyage complet

```bash
# Supprimer containers + volumes (⚠️ perte de données)
npm run lifytp:clean

# Équivalent à
docker compose -p lifytp -f docker-compose.lifytp.yml down -v
```

### Statut des containers

```bash
# Voir tous les containers LifyTP
docker ps --filter "name=lifytp"

# Avec docker compose
docker compose -p lifytp -f docker-compose.lifytp.yml ps
```

---

## 📋 Workflow de développement

### Démarrage complet de LifyTP

```bash
# Terminal 1 : Infrastructure Docker
npm run lifytp:start

# Terminal 2 : API (une fois l'infra prête)
npm run dev:api

# Terminal 3 : Mobile (une fois l'API prête)
npm run dev:mobile
```

### Vérification rapide

```bash
# Vérifier que l'infrastructure tourne
docker compose -p lifytp ps

# Tester Postgres
psql -h localhost -p 5433 -U lify -d lify_dev

# Tester Redis
redis-cli -p 6380 PING
# Doit répondre: PONG

# Tester MinIO (dans le navigateur)
open http://localhost:9101
# Login: lify / lifypassword
```

---

## 🔒 Garanties d'isolation

### ✅ Ce qui est garanti

1. **Container names** : Tous les containers LifyTP ont le préfixe `lifytp-*` (ex: `lifytp-postgres-1`)
2. **Ports** : Aucun conflit possible, ports dédiés LifyTP
3. **Volumes** : Volumes nommés avec préfixe `lifytp_*` (ex: `lifytp_pgdata`)
4. **Network** : Réseau dédié `lifytp_lifytp-network`
5. **Project name** : Utilisation systématique de `-p lifytp`

### ❌ Lify original non affecté

- Aucune commande LifyTP ne touche aux containers `lify_*` (si existants)
- Les ports de Lify restent disponibles (5432, 6379, etc.)
- `npm run dev` dans Lify fonctionne normalement

---

## 🧪 Tests de non-régression

### Test 1 : Isolation des containers

```bash
# Démarrer LifyTP
npm run lifytp:start

# Vérifier les noms
docker ps --filter "name=lifytp" --format "{{.Names}}"
# Attendu : lifytp-postgres-1, lifytp-redis-1, lifytp-minio-1, lifytp-mailhog-1

# Vérifier qu'aucun container lify_* n'existe
docker ps --filter "name=lify_" --format "{{.Names}}"
# Attendu : (vide si Lify n'est pas lancé)
```

### Test 2 : Vérification des ports

```bash
# Vérifier les ports utilisés par LifyTP
lsof -i :5433  # Postgres LifyTP
lsof -i :6380  # Redis LifyTP
lsof -i :9100  # MinIO API LifyTP
lsof -i :9101  # MinIO Console LifyTP

# Les ports Lify doivent être libres (si Lify non lancé)
lsof -i :5432  # Doit être vide
lsof -i :6379  # Doit être vide
```

### Test 3 : Exécution parallèle

```bash
# Terminal 1 : Démarrer LifyTP
cd "/Users/raouldrg/Desktop/Lify TP"
npm run lifytp:start

# Terminal 2 : Démarrer Lify original
cd ~/path/to/Lify
npm run dev

# Vérification : Les deux doivent tourner sans erreur
docker ps --format "{{.Names}}" | grep -E "(lify|lifytp)"
```

---

## 🛠️ Troubleshooting

### Les containers ne démarrent pas

**Problème** : `docker compose up` retourne une erreur

**Solutions** :
```bash
# 1. Vérifier les ports disponibles
lsof -i :5433 :6380 :9100 :9101

# 2. Nettoyer et redémarrer
npm run lifytp:clean
npm run lifytp:start

# 3. Vérifier les logs
npm run lifytp:logs
```

### Conflit de ports malgré l'isolation

**Problème** : Erreur `port already in use`

**Solutions** :
```bash
# Identifier quel processus utilise le port
lsof -i :5433

# Arrêter le processus conflictuel
kill -9 <PID>

# Ou changer le port dans docker-compose.lifytp.yml
# Exemple: "5434:5432" au lieu de "5433:5432"
```

### Impossible de se connecter à Postgres/Redis

**Problème** : Les applications ne trouvent pas les services

**Cause** : Variables d'environnement pointant vers les anciens ports

**Solution** : Vérifier/mettre à jour les `.env` des microservices
```env
# Anciens ports (à éviter)
DATABASE_URL=postgresql://lify:lify@localhost:5432/lify_dev
REDIS_URL=redis://localhost:6379

# Nouveaux ports LifyTP
DATABASE_URL=postgresql://lify:lify@localhost:5433/lify_dev
REDIS_URL=redis://localhost:6380
```

### Les volumes ne sont pas nettoyés

**Problème** : `npm run lifytp:clean` ne supprime pas les données

**Solution** :
```bash
# Nettoyage manuel des volumes
docker volume ls | grep lifytp
docker volume rm lifytp_pgdata lifytp_minio
```

---

## 📚 Références

- **Fichier Docker Compose** : [`docker-compose.lifytp.yml`](file:///Users/raouldrg/Desktop/Lify%20TP/docker-compose.lifytp.yml)
- **Scripts** :
  - [`scripts/start-lifytp.sh`](file:///Users/raouldrg/Desktop/Lify%20TP/scripts/start-lifytp.sh)
  - [`scripts/stop-lifytp.sh`](file:///Users/raouldrg/Desktop/Lify%20TP/scripts/stop-lifytp.sh)
  - [`scripts/clean-lifytp.sh`](file:///Users/raouldrg/Desktop/Lify%20TP/scripts/clean-lifytp.sh)
- **Configuration npm** : [`package.json`](file:///Users/raouldrg/Desktop/Lify%20TP/package.json)
- **Ancien fichier** : [`docker-compose.yml.backup`](file:///Users/raouldrg/Desktop/Lify%20TP/docker-compose.yml.backup) (référence uniquement)

---

## ❓ FAQ

**Q : Puis-je utiliser l'ancien `docker-compose.yml` ?**  
R : Non, il a été renommé en `.backup`. Utilisez uniquement `docker-compose.lifytp.yml`.

**Q : Comment savoir si LifyTP tourne ?**  
R : `docker ps --filter "name=lifytp"` ou `docker compose -p lifytp ps`

**Q : Est-ce que `npm run dev` lance aussi Docker LifyTP ?**  
R : Non, `npm run dev` affiche juste des instructions. Utilisez `npm run lifytp:start` séparément.

**Q : Puis-je changer les ports LifyTP ?**  
R : Oui, modifiez `docker-compose.lifytp.yml` et mettez à jour les `.env` des microservices.

**Q : Comment réinitialiser complètement la base de données ?**  
R : `npm run lifytp:clean` puis `npm run lifytp:start`
