# Lify - Project Guide

> [!IMPORTANT]
> **LifyTP est isolé du projet Lify original**
> 
> Ce projet utilise une configuration Docker dédiée pour éviter tout conflit avec le projet Lify original.
> - **Fichier Docker** : `docker-compose.lifytp.yml` (et NON `docker-compose.yml`)
> - **Ports dédiés** : Postgres 5433, Redis 6380, MinIO 9100/9101
> - **Commandes** : `npm run lifytp:start/stop/clean`
> 
> 📖 **[Lire la documentation complète d'isolation](LIFYTP_ISOLATION.md)**

## 📂 Project Structure

This project is a Monorepo containing the Backend (API) and Frontend (Mobile App).

- **`apps/api`**: Node.js Backend using **Fastify** and **Prisma** (PostgreSQL).
  - `src/index.ts`: Entry point.
  - `src/routes/`: API Endpoints (Auth, Events, Posts, etc.).
  - `src/lib/`: Shared utilities (Prisma client, Auth guard).
  - `prisma/schema.prisma`: Database Schema.

- **`apps/mobile`**: React Native App using **Expo**.
  - `src/navigation/`: App Navigation (Routes, Stacks).
  - `src/screens/`: UI Screens (Login, Home).
  - `src/services/`: API clients (Axios) and Socket.io.
  - `src/context/`: Global State (Auth).
  - `src/components/`: Shared UI components.
  - `App.tsx`: Main entry component.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Docker (for Database, Redis, MinIO, MailHog)

### 2. Start Infrastructure + API (One Command!)

LifyTP can now start everything (Docker infrastructure + API) with a single command:

```bash
npm run lifytp:start
```

This starts:
- ✅ Postgres (port 5433)
- ✅ Redis (port 6380)  
- ✅ MinIO (ports 9100/9101)
- ✅ MailHog (ports 1026/8026)
- ✅ **API Backend (port 3000)** ← NEW!

> [!TIP]
> **Alternative**: Start EVERYTHING (Infra + API + Mobile) in one terminal:
> ```bash
> npm run lifytp:dev
> ```

> [!NOTE]
> To stop: Press `Ctrl+C` in the terminal, then run `npm run lifytp:stop`

---

### 3. Choose Backend Mode (Optional)

LifyTP supports **two backend architectures**:

#### Option A: Monolithic API (Default - Just Started!)
Already running on port 3000 from step 2. You're good to go! ✅

#### Option B: Microservices (For Kubernetes/TP Demo)
Separate services on ports 4100-4102 (requires Kubernetes).

```bash
# Port-forward Kubernetes services
kubectl port-forward -n lifytp service/auth-service 4100:4100 &
kubectl port-forward -n lifytp service/events-service 4101:4101 &
kubectl port-forward -n lifytp service/messages-service 4102:4102 &
```

> [!NOTE]
> **To switch between modes**: Create `apps/mobile/.env` with:
> - `EXPO_PUBLIC_BACKEND_MODE=monolith` (default)
> - `EXPO_PUBLIC_BACKEND_MODE=microservices` (Kubernetes demo)
> 
> 📖 **[Full backend configuration guide](FRONTEND_BACKEND_CONFIG.md)**

---

### 4. Start Mobile App
The mobile app runs on Expo.
```bash
# In a NEW terminal
cd apps/mobile
npm start
```
- Press `i` to open in iOS Simulator.
- Press `a` to open in Android Emulator.

## 🔑 Development Credentials

We have a **Mock Authentication** system for development ease.

- **Login Endpoint**: `POST /dev/mock-login` (Automatically used by the Mobile App).
- **Default Test Account**:
  - **Email**: `test@lify.app`
  - **Password**: (No password required for mock login)

## 🛠 Tech Stack Details

- **Backend**:
  - Framework: Fastify
  - ORM: Prisma
  - Database: PostgreSQL
  - Storage: Minio (S3 compatible)
  - Realtime: Socket.io

- **Frontend**:
  - Framework: React Native (Expo)
  - Navigation: React Navigation
  - HTTP Client: Axios

## 📝 Notes
- Use `npx prisma studio` in `apps/api` to browse the database visually.
- The `Minio` connection is optional for development; the server will warn but not crash if it's down.
