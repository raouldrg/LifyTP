# Dette Technique (Lint)

Total de problèmes restants : ~80 (principalement `no-explicit-any` et `no-unused-vars` sur arguments).

## 1. À corriger maintenant (Safe)
- [x] Imports inutilisés (corrigés via `eslint --fix`).
- [ ] Variables inutilisées (arguments de callback) : Vérifier si on peut les préfixer par `_` ou les supprimer.

## 2. À corriger bientôt (Types)
- **`@typescript-eslint/no-explicit-any`** : ~60 occurrences.
  - Raison : Code legacy rapide.
  - Action : Définir des interfaces pour `User`, `Message`, `NavigationProps` au lieu de `any`.
  - Priorité : Moyenne (bloque pas le run, mais réduit la sécurité).

## 3. Configuration / Ignoré
- **Arguments inutilisés** : Configuré pour ignorer si commence par `_`.
- **Règles Style** : Prise en charge par Prettier.

## Plan de réduction
1. Migrer les `any` critiques (API, Auth) vers des types stricts.
2. Utiliser `_` pour les args inutilisés obligatoires (ex: `renderItem`).
3. Activer `lint` strict dans le CI.
