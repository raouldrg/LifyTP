# Architecture Mobile

## Navigation
Géré par `react-navigation`.
- **AppNavigator** (`src/navigation/AppNavigator.tsx`) : Point d'entrée.
- **Stacks** : Auth (Login/SignUp) ou App (MainTabs).
- **Tabs** : Home, Search, Messages, Profile.

## Authentification
Géré par `AuthContext` (`src/context/AuthContext.tsx`).
- Stocke `user` et `token`.
- Gère la connexion Socket.io (join room à la connexion).

## Services & Data
- **API** : `src/services/api.ts` (wrapper Axios). Headers Auth auto-injectés.
- **Socket** : `src/services/socket.ts` (Singleton Socket.io).
- **Assets** : Stockés côté URL distante (S3/Cloudinary) ou UI Avatars par défaut.

## Structure
- `src/screens` : Vues principales.
- `src/components` : UI réutilisable (`UserListItem`, `CustomTabBar`).
- `src/services` : Logique API/Socket.
- `src/context` : State global (Auth).