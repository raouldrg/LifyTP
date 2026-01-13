# 🚀 Workflow de développement LifyTP simplifié

## Nouveau workflow (Une seule commande !)

### Option 1 : Infrastructure + API (2 terminaux)

**Terminal 1 : Backend**
```bash
npm run lifytp:start
```
Démarre automatiquement :
- Infrastructure Docker (Postgres, Redis, MinIO, MailHog)
- API Backend (port 3000)

**Terminal 2 : Frontend Mobile**
```bash
npm run dev:mobile
```

---

### Option 2 : Tout en un (1 seul terminal !)

```bash
npm run lifytp:dev
```

Démarre **TOUT** en même temps :
- Infrastructure Docker
- API Backend
- Mobile App (Expo)

> [!TIP]
> Utiliser `Ctrl+C` pour tout arrêter, puis `npm run lifytp:stop` pour nettoyer Docker.

---

## Commandes disponibles

| Commande | Action |
|----------|--------|
| `npm run lifytp:start` | 🚀 Infra + API (2 services) |
| `npm run lifytp:dev` | 🚀 **Tout** (Infra + API + Mobile) |
| `npm run lifytp:infra` | 🐳 Infrastructure Docker uniquement |
| `npm run dev:api` | ⚙️ API Backend uniquement |
| `npm run dev:mobile` | 📱 Mobile app uniquement |
| `npm run lifytp:stop` | ⏹️ Arrêter Docker |
| `npm run lifytp:logs` | 📋 Voir logs Docker |
| `npm run lifytp:clean` | 🧹 Nettoyer tout (volumes inclus) |

---

## Ancien workflow (3 terminaux - déprécié)

<details>
<summary>Cliquer pour voir l'ancien workflow</summary>

**Terminal 1**
```bash
npm run lifytp:infra
```

**Terminal 2**
```bash
npm run dev:api
```

**Terminal 3**
```bash
npm run dev:mobile
```

</details>

---

## Voir aussi

- [LIFYTP_ISOLATION.md](LIFYTP_ISOLATION.md) - Isolation Docker
- [FRONTEND_BACKEND_CONFIG.md](FRONTEND_BACKEND_CONFIG.md) - Config frontend/backend
- [API_LIFYTP_PORTS.md](API_LIFYTP_PORTS.md) - Configuration ports API
