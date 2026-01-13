# 🔌 Configuration Frontend-Backend LifyTP

## Vue d'ensemble

LifyTP dispose de **deux architectures backend** que le frontend mobile peut utiliser :

| Architecture | Port(s) | Utilisation | Démarrage |
|--------------|---------|-------------|-----------|
| **API Monolithique** | 3000 | Développement local rapide | `npm run dev:api` |
| **Microservices** | 4100, 4101, 4102 | Démo Kubernetes/TP | `kubectl port-forward` |

Le frontend mobile peut **basculer entre les deux** via une simple variable d'environnement.

---

## 🎯 Modes Backend

### Mode Monolith (par défaut)

**Caractéristiques** :
- ✅ Un seul serveur pour tous les endpoints
- ✅ Plus simple à démarrer et débugger
- ✅ Parfait pour le développement local
- ✅ Port unique : 3000

**URL** : `http://192.168.1.119:3000`

**Tous les endpoints** (`/auth/*`, `/events/*`, `/messages/*`) sont servis par le même serveur.

---

### Mode Microservices

**Caractéristiques** :
- ✅ Services séparés par domaine métier
- ✅ Déploiement Kubernetes
- ✅ Démonstration de l'architecture distribuée
- ⚠️ Nécessite `kubectl port-forward` pour accès local

**URLs** :
- Auth Service : `http://192.168.1.119:4100`
- Events Service : `http://192.168.1.119:4101`
- Messages Service : `http://192.168.1.119:4102`

---

## 🔧 Configuration

### Fichier de configuration : `apps/mobile/src/config/api.ts`

Le fichier exporte automatiquement les bonnes URLs selon le mode :

```typescript
// Variables exportées
export const API_BASE_URL      // URL principale (auth en mode microservices)
export const SERVICES_URLS     // { auth, events, messages }
export const backendMode       // 'monolith' | 'microservices'
export const isMonolithMode    // boolean
export const isMicroservicesMode // boolean
```

---

## 🔀 Basculer entre les modes

### Méthode 1 : Variable d'environnement (recommandé)

Créez un fichier `.env` dans `apps/mobile/` :

```env
# Mode Monolith
EXPO_PUBLIC_BACKEND_MODE=monolith

# OU Mode Microservices
EXPO_PUBLIC_BACKEND_MODE=microservices
```

Puis redémarrez l'app mobile :
```bash
npm start -w @lify/mobile
```

---

### Méthode 2 : Modification directe

Si vous n'utilisez pas de fichier `.env`, modifiez directement dans [`apps/mobile/src/config/api.ts`](file:///Users/raouldrg/Desktop/Lify%20TP/apps/mobile/src/config/api.ts) :

```typescript
// Ligne 18
const BACKEND_MODE = 'microservices'; // Change 'monolith' to 'microservices'
```

⚠️ **Ne committez pas** cette modification si c'est juste pour tester localement.

---

## 🚀 Workflows de démarrage

### Workflow 1 : Mode Monolith (Développement)

```bash
# Terminal 1 : Infrastructure Docker
npm run lifytp:start

# Terminal 2 : API Monolithique
npm run dev:api

# Terminal 3 : Mobile App
cd apps/mobile
echo "EXPO_PUBLIC_BACKEND_MODE=monolith" > .env
npm start
```

**Vérification** :
- L'app mobile se connecte à `http://192.168.1.119:3000`
- Console Expo affiche : `[Config] 🔧 Backend Mode: MONOLITH`

---

### Workflow 2 : Mode Microservices (TP/Démo)

```bash
# Terminal 1 : Kubernetes Port-Forward
kubectl port-forward -n lifytp service/auth-service 4100:4100 &
kubectl port-forward -n lifytp service/events-service 4101:4101 &
kubectl port-forward -n lifytp service/messages-service 4102:4102 &

# Terminal 2 : Mobile App
cd apps/mobile
echo "EXPO_PUBLIC_BACKEND_MODE=microservices" > .env
npm start
```

**Vérification** :
- Console Expo affiche :
  ```
  [Config] 🔧 Backend Mode: MICROSERVICES
  [Config] 🎯 Auth Service: http://192.168.1.119:4100
  [Config] 📅 Events Service: http://192.168.1.119:4101
  [Config] 💬 Messages Service: http://192.168.1.119:4102
  ```

---

## ✅ Tests de connexion

### Test 1 : Vérifier le mode actif

Ouvrez l'app mobile et regardez **la console Expo Metro** :

```
[Config] 🔧 Backend Mode: MONOLITH
[Config] 📡 API Base URL: http://192.168.1.119:3000
```

Ou en mode microservices :

```
[Config] 🔧 Backend Mode: MICROSERVICES
[Config] 📡 API Base URL: http://192.168.1.119:4100
[Config] 🎯 Auth Service: http://192.168.1.119:4100
[Config] 📅 Events Service: http://192.168.1.119:4101
[Config] 💬 Messages Service: http://192.168.1.119:4102
```

---

### Test 2 : Tester la connexion API (Monolith)

```bash
# Démarrer l'API
npm run dev:api

# Tester depuis le terminal
curl http://192.168.1.119:3000/health

# Tester depuis l'app mobile
# Utiliser le bouton "PING API" sur l'écran de login
```

---

### Test 3 : Tester les microservices

```bash
# Vérifier que les pods tournent
kubectl get pods -n lifytp

# Port-forward les services
kubectl port-forward -n lifytp service/auth-service 4100:4100 &
kubectl port-forward -n lifytp service/events-service 4101:4101 &
kubectl port-forward -n lifytp service/messages-service 4102:4102 &

# Tester chaque service
curl http://localhost:4100/health
curl http://localhost:4101/health
curl http://localhost:4102/health
```

---

## 🐛 Troubleshooting

### Problème : L'app ne se connecte pas au backend

**Solution 1 : Vérifier l'IP LAN**

Votre IP LAN doit correspondre à celle dans [`apps/mobile/src/config/api.ts`](file:///Users/raouldrg/Desktop/Lify%20TP/apps/mobile/src/config/api.ts) :

```bash
# Trouver votre IP LAN (Mac)
ifconfig | grep "inet " | grep -v 127.0.0.1

# Exemple de sortie :
# inet 192.168.1.119 netmask 0xffffff00 broadcast 192.168.1.255
```

Modifiez la ligne 16 si nécessaire :
```typescript
const LAN_IP = "192.168.1.XXX"; // Votre IP
```

---

**Solution 2 : Vérifier que le backend tourne**

```bash
# Mode Monolith
lsof -i :3000

# Mode Microservices
lsof -i :4100
lsof -i :4101
lsof -i :4102
```

Si vide, démarrez le backend correspondant.

---

**Solution 3 : Vérifier le mode dans la console**

Redémarrez l'app Expo et vérifiez les logs :
```
[Config] 🔧 Backend Mode: ???
```

Si ce n'est pas le bon mode, vérifiez votre fichier `.env`.

---

### Problème : Microservices inaccessibles

**Cause** : `kubectl port-forward` non lancé

**Solution** :
```bash
# Vérifier les pods Kubernetes
kubectl get pods -n lifytp

# Si les pods ne tournent pas
kubectl apply -f deploy/deployments/
kubectl apply -f deploy/services/

# Port-forward
kubectl port-forward -n lifytp service/auth-service 4100:4100 &
kubectl port-forward -n lifytp service/events-service 4101:4101 &
kubectl port-forward -n lifytp service/messages-service 4102:4102 &
```

---

### Problème : L'app se connecte toujours au mauvais backend

**Cause** : Cache Expo Metro

**Solution** :
```bash
# Arrêter Metro
# Supprimer le cache
rm -rf apps/mobile/.expo
rm -rf apps/mobile/node_modules/.cache

# Redémarrer
npm start -w @lify/mobile -- --clear
```

---

## 📊 Comparaison des modes

| Aspect | Monolith | Microservices |
|--------|----------|---------------|
| **Complexité** | ⭐ Simple | ⭐⭐⭐ Complexe |
| **Démarrage** | `npm run dev:api` | `kubectl port-forward` × 3 |
| **Ports** | 1 (3000) | 3 (4100-4102) |
| **Dépendances** | Postgres, Redis | Kubernetes cluster |
| **Performance** | ⚡ Rapide (local) | 🐢 Latence réseau |
| **Débogage** | ✅ Facile | ⚠️ Distribué |
| **Utilisation** | Dev quotidien | Démo TP/Soutenance |

---

## 💡 Recommandations

### Pour le développement quotidien
→ **Mode Monolith** (défaut)
- Plus rapide à démarrer
- Debugging plus simple
- Pas besoin de Kubernetes

### Pour la soutenance/démo TP
→ **Mode Microservices**
- Démontre l'architecture distribuée
- Montre la scalabilité Kubernetes
- Prouve la maîtrise des microservices

### Basculement pendant la démo
Vous pouvez facilement basculer pour montrer les deux approches :

1. Démontrer le mode Microservices (architecture distribuée)
2. Basculer vers Monolith (expliquer pourquoi on garde les deux)
3. Comparer les performances/complexité

---

## 🔗 Références

- **Configuration API** : [`apps/mobile/src/config/api.ts`](file:///Users/raouldrg/Desktop/Lify%20TP/apps/mobile/src/config/api.ts)
- **Services API** : [`apps/mobile/src/services/api.ts`](file:///Users/raouldrg/Desktop/Lify%20TP/apps/mobile/src/services/api.ts)
- **API Monolithique** : [`apps/api/`](file:///Users/raouldrg/Desktop/Lify%20TP/apps/api)
- **Microservices** : [`services/`](file:///Users/raouldrg/Desktop/Lify%20TP/services)
- **Déploiement Kubernetes** : [`KUBERNETES_DEPLOYMENT.md`](file:///Users/raouldrg/Desktop/Lify%20TP/KUBERNETES_DEPLOYMENT.md)
