# Contributing to Lify (Mobile)

## Structure
- **Screens** -> `src/screens` (suffixe `Screen.tsx`)
- **Components** -> `src/components` (réutilisable uniquement)
- **Services** -> `src/services` (API, Socket)
- **Context** -> `src/context` (State global)

## Règles d'Or
1. **Pas de Code Mort** : Supprimez ce que vous n'utilisez pas.
2. **Linting** : `npm run lint:report` doit être consulté.
3. **Typecheck** : `npm run typecheck` **DOIT** passer avant tout commit.
4. **Imports** : Utilisez les chemins relatifs propres (pas de `../../../../`).

## Commandes
- Dev : `npm start`
- Check : `npm run typecheck`
