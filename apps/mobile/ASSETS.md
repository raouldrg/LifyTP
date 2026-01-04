# Audit des Assets

## 1. Polices
Chargées dynamiquement via `@expo-google-fonts` dans `App.tsx` :
- `Montserrat` (400, 500, 600, 700)
- `MontserratAlternates` (400, 500, 600, 700)

## 2. Images Locales
❌ **Aucune image locale trouvée** dans `apps/mobile`.
- **Icon / Splash** : Non configurés dans `app.json`. Utilise les défauts Expo (blanc / défaut).
- **Images UI** : Toutes les images semblent provenir d'URLs distantes (S3 via API pour les avatars).

## 3. Recommandation
Ajouter un dossier `assets/` avec au minimum :
- `icon.png` (1024x1024)
- `splash.png` (1242x2436)
- `adaptive-icon.png` (pour Android)
- Configurer `app.json` pour pointer dessus.
