# Lify - Project Guide

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
- Docker (for Database and Minio)

### 2. Start Infrastructure
Run this in the root directory to start Postgres, Redis, and Minio:
```bash
docker compose up -d
```

### 3. Start Backend (API)
The API runs on port **3000**.
```bash
cd apps/api
npm install
npm run dev
```

### 4. Start Mobile App
The logic runs on Expo.
```bash
cd apps/mobile
npm install
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
