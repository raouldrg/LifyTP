# CLEANUP REPORT

## Étape 0 : État des lieux

### 1. Arborescence Actuelle (Résumé)
Le projet est structuré comme un monorepo avec `apps/mobile` contenant l'application React Native.
Structure de `apps/mobile/src` :
- `components/` : Composants UI (6 fichiers)
- `lib/` : Utilitaires et Contextes (ex: `AuthContext`)
- `navigation/` : Configuration de la navigation (1 fichier principal)
- `screens/` : Écrans de l'application (15 fichiers)
- `theme.ts` : Fichier de thème

### 2. Features Réelles vs Fantômes
- **Screens** : Tous les 15 écrans présents dans `src/screens` sont importés et utilisés dans `AppNavigator.tsx`. Aucune "feature fantôme" évidente au niveau des écrans.
- **Composants** :
    - `CustomTabBar` : Utilisé dans `AppNavigator`.
    - `FeedCard`, `AudioMessage`, `Waveform`, `BentoCard`, `ProfileCalendarGrid` : Semblent être des composants actifs (à vérifier par grep lors de l'étape de nettoyage).

### 3. Fichiers Inutilisés / Suspects
- Pas de dossier `assets` trouvé dans `src` ni à la racine de `apps/mobile`. Il faudra vérifier où sont stockés les assets.
- `README2.md` dans `apps/mobile` semble suspect (doublon ?).

### 4. Doublons Potentiels
- `UserListScreen` vs `SearchScreen` ? (À vérifier si logique similaire).
- `UserProfileScreen` vs `ProfileScreen` ? (`ProfileScreen` est pour l'utilisateur connecté, `UserProfileScreen` pour les autres, pattern classique mais à vérifier).

### 5. Dette Technique & Tooling
- **Scripts manquants** dans `apps/mobile/package.json` :
    - `lint`
    - `typecheck`
    - `test`
    - `format`
- **Linting** : Configuration ESLint présente à la racine du monorepo (`.eslintrc.json`), mais pas explicitement reliée dans le package mobile.
- **Prettier** : Configuration présente à la racine (`.prettierrc`).

## Suivi des Actions (À compléter)

### Suppressions (Étape 2)
| Fichier / Dossier | Raison | Impact |
| --- | --- | --- |
| `apps/mobile/README2.md` | Fichier redondant/inutile | Aucun |
| `apps/mobile/src/components/BentoCard.tsx` | Composant non utilisé (grep check) | Aucun |
| `apps/mobile/src/lib/api.ts` (export socket) | Doublon avec `socket.ts`. Supprimé. | Consolidation socket |

### Remplacements / Refactors (Étape 3)
| Ancien code | Nouveau code | Note |
| --- | --- | --- |
| `SearchScreen` / `UserListScreen` cards | `UserListItem` | Factorisation UI |
| `api.ts` export socket | `socket.ts` singleton | Fix multi-connexions |

### Déplacements (Étape 4)
| Fichier | Nouvelle Destination |
| --- | --- |
| `src/lib/api.ts` | `src/services/api.ts` |
| `src/lib/socket.ts` | `src/services/socket.ts` |
| `src/lib/AuthContext.tsx` | `src/context/AuthContext.tsx` |

## Vérification Finale (Étape 6)
- **Commandes** : `npm run lint`, `npm run typecheck` (configuré et passe sur le code source).
- **Points de vigilance** :
  - `socket.ts` est maintenant la seule source de vérité pour le socket.
  - Les imports `../lib/*` ont été migrés vers `../services/*` ou `../context/*`.
