# Démo Soutenance - 5 Minutes

**Date**: 12 janvier 2026  
**Statut**: ✅ Prêt pour présentation

---

## 🎯 Script de Démonstration (5 minutes chrono)

### Minute 1: Architecture et Isolation

**Montrer:**
```bash
# Structure du projet
tree -L 2 services/
# ├── auth-service/
# ├── events-service/
# ├── messages-service/
# └── shared/

# Ports dédiés (isolation totale de Lify)
cat docker-compose.yml | grep -A 1 "ports:"
# PostgreSQL: 5433 (vs 5432 Lify)
# Redis: 6380 (vs 6379 Lify)
# MinIO: 9100/9101 (vs 9000/9001 Lify)
# Services: 4100, 4101, 4102
```

**Dire**: "3 microservices backend (Auth, Events, Messages) + infrastructure isolée"

---

### Minute 2: Docker Compose Local

```bash
# Démarrer (si pas déjà fait)
docker compose up -d

# Montrer tous les services running
docker compose ps
# NAME              STATUS
# lifytp_postgres   Up (healthy)
# lifytp_redis      Up (healthy)
# lifytp_minio      Up (healthy)
# lifytp_auth       Up
# lifytp_events     Up
# lifytp_messages   Up

# Tester un endpoint
curl http://localhost:4100/health
# {"status":"ok","service":"auth-service","port":4100}
```

**Dire**: "6 services dockerisés, testés localement avec health checks"

---

### Minute 3: Kubernetes - Déploiement

```bash
# Vérifier le cluster
kubectl get nodes
# docker-desktop   Ready   v1.34.1

# Montrer le déploiement
kubectl get all -n lifytp
# Pods: 8/8 Running (postgres, redis, 6x microservices)
# Services: 5 ClusterIP avec Load Balancing
# Deployments: 2 replicas par service

kubectl get pods -n lifytp
# auth-service-xxx (2/2 Running)
# events-service-xxx (2/2 Running)  
# messages-service-xxx (2/2 Running)
# postgres-0 (1/1 Running)
# redis-xxx (1/1 Running)
```

**Dire**: "Déploiement Kubernetes avec replicas pour haute disponibilité"

---

### Minute 4a: Auto-Healing (30 secondes)

```bash
# Terminal 1: Monitoring
kubectl get pods -n lifytp -l app=auth-service -w

# Terminal 2: Supprimer un pod
POD=$(kubectl get pod -n lifytp -l app=auth-service -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $POD -n lifytp
# pod "auth-service-xxx" deleted

# Observer:
# - Pod Terminating
# - Nouveau pod Created immédiatement  
# - Running en ~9 secondes
# - Service toujours disponible (2ème replica continuait)
```

**Dire**: "Auto-healing démontré: pod supprimé → recréé en 9s, zero downtime"

---

### Minute 4b: Rolling Update (30 secondes)

```bash
# Déclencher update
kubectl patch deployment auth-service -n lifytp \
  -p '{"spec":{"template":{"metadata":{"annotations":{"version":"demo"}}}}}'

# Observer rollout
kubectl get pods -n lifytp -l app=auth-service -w
# Anciens pods terminés 1 par 1
# Nouveaux pods créés progressivement
# Toujours ≥1 pod Running
```

**Dire**: "Rolling update sans interruption: 2 replicas permettent zéro downtime"

---

### Minute 5: CI/CD et Conclusion

**Montrer workflows:**
```bash
# CI sur develop
cat .github/workflows/ci-develop.yml | grep -A 3 "jobs:"
# lint → type-check → build

# CD sur tags
cat .github/workflows/cd-main.yml | grep -A 5 "deploy-to-kubernetes:"
# build images → push GHCR → kubectl apply
```

**Conclure**:
- ✅ 3 microservices opérationnels
- ✅ Docker + Kubernetes fonctionnels
- ✅ Auto-healing et rolling updates démontrés
- ✅ CI/CD configuré
- ✅ Isolation complète de Lify
- ✅ Documentation exhaustive

---

## 📊 Checklist Avant Présentation

### Prérequis
- [ ] Cluster Kubernetes actif: `kubectl get nodes`
- [ ] Pods LifyTP running: `kubectl get pods -n lifytp`
- [ ] Docker Compose testé: `docker compose ps`

### Commandes à Préparer (copier-coller rapide)

**1. Docker Compose:**
```bash
docker compose ps
curl http://localhost:4100/health
```

**2. Kubernetes Status:**
```bash
kubectl get all -n lifytp
kubectl get pods -n lifytp
```

**3. Auto-Healing:**
```bash
# Terminal 1
kubectl get pods -n lifytp -l app=auth-service -w

# Terminal 2  
POD=$(kubectl get pod -n lifytp -l app=auth-service -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $POD -n lifytp
```

**4. Rolling Update:**
```bash
kubectl patch deployment auth-service -n lifytp \
  -p '{"spec":{"template":{"metadata":{"annotations":{"version":"'$(date +%s)'"}}}}}'
kubectl get pods -n lifytp -l app=auth-service -w
```

**5. Test Endpoints (si besoin):**
```bash
kubectl port-forward -n lifytp service/auth-service 4100:4100 &
curl http://localhost:4100/health
pkill -f port-forward
```

---

## 🎓 Points Clés à Mentionner

### Architecture
- Découpage en 3 microservices based on domain-driven design
- Communication REST synchrone (extensible vers event-driven)
- Base de données partagée (simplification TP, évolutif vers DB par service)

### Docker
- Multi-stage Dockerfiles optimisés (images <200MB)
- docker-compose.yml avec health checks et depends_on
- Isolation totale: ports, volumes, DB, networks dédiés

### Kubernetes
- Namespace `lifytp` pour isolation
- Deployments avec 2 replicas (haute disponibilité)
- RollingUpdate strategy (maxUnavailable: 1)
- Health probes (liveness + readiness)
- Services ClusterIP avec Load Balancing

### CI/CD
- GitHub Actions: CI sur develop, CD sur tags
- Build automatique + push vers GHCR
- Déploiement Kubernetes automatisé avec kubectl

### Démos
- **Auto-healing**: Kubernetes recréé les pods supprimés (~9s)
- **Rolling update**: Mise à jour sans downtime (progressive)
- **Zero downtime**: ≥1 pod toujours disponible grâce aux replicas

---

## ⏱️ Timing Recommandé

| Étape | Durée | Contenu |
|-------|-------|---------|
| Introduction | 30s | Architecture microservices |
| Docker Compose | 1min | Démo locale, health checks |
| Kubernetes Status | 1min | Pods, services, replicas |
| Auto-Healing | 1min | Suppression pod + recréation |
| Rolling Update | 1min | Update sans downtime |
| CI/CD + Conclusion | 1min30s | Workflows + récap |

**Total**: 5-6 minutes

---

## 🚀 Plan B (si problème technique)

**Si pods crashent:**
```bash
kubectl logs <POD_NAME> -n lifytp
kubectl describe pod <POD_NAME> -n lifytp
# Montrer les logs comme preuve de diagnostic méthodique
```

**Si cluster pas dispo:**
- Basculer sur Docker Compose (100% fonctionnel)
- Expliquer que K8s était fonctionnel (showing captures d'écran)

**Si time overrun:**
- Sauter auto-healing OU rolling update (pas les 2)
- Garder 1 démo minimum + CI/CD

---

## 📸 Captures à Avoir Sous la Main

1. **Auto-healing**: Pods Terminating → Running
2. **Rolling update**: 2 versions de pods en parallèle
3. **kubectl get all -n lifytp**: Vue complète du déploiement
4. **docker compose ps**: Services locaux healthy

---

**TOUT EST PRÊT POUR LA SOUTENANCE!** 🎯
