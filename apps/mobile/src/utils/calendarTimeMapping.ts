/**
 * calendarTimeMapping.ts
 * 
 * Utilitaire central pour le mapping temps → pixels dans le calendrier 24h.
 * Implémente une compression PROGRESSIVE des heures nocturnes (1h–8h)
 * avec une courbe Gaussienne pour un effet "trou de verre" lissé.
 * 
 * MODÈLE MATHÉMATIQUE:
 * - La compression est maximale à 4h du matin (scale = 0.6)
 * - La compression diminue progressivement vers les bords (1h et 8h)
 * - Les heures de journée (9h+) conservent leur hauteur normale (scale = 1)
 * - Formule: scale(h) = 1 - (1 - minScale) × exp(-((h - center)² / (2σ²)))
 * 
 * UX INTENTION:
 * - Optimiser l'espace visuel pour les heures d'activité
 * - Réduire l'espace pour les heures de sommeil sans les masquer
 * - Éviter tout saut visuel grâce à la courbe continue
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Hauteur de base d'une heure en pixels (sans compression) */
export const BASE_HOUR_HEIGHT = 80;

/** Centre de la compression (point de compression maximale) */
const COMPRESSION_CENTER = 4; // 4h du matin

/** Scale minimum (60% = hauteur réduite à 48px au lieu de 80px) */
const MIN_SCALE = 0.6;

/** 
 * Sigma de la Gaussienne - contrôle l'étalement de la compression
 * Plus σ est petit, plus la compression est concentrée autour du centre
 * σ = 2.5 donne une belle transition sur ~6 heures (1h à 8h)
 */
const SIGMA = 2.5;

/** Première heure du calendrier */
const START_HOUR = 0;

/** Dernière heure du calendrier (exclusive pour le calcul) */
const END_HOUR = 24;

// =============================================================================
// FONCTIONS DE SCALE
// =============================================================================

/**
 * Calcule le facteur de scale pour une heure donnée.
 * Utilise une Gaussienne inversée centrée sur COMPRESSION_CENTER.
 * 
 * @param hour - Heure entière (0-23)
 * @returns Facteur de scale entre MIN_SCALE (0.6) et 1.0
 * 
 * Exemples:
 * - getHourScale(4) = 0.60 (maximum compression)
 * - getHourScale(7) ≈ 0.77
 * - getHourScale(9) ≈ 0.96
 * - getHourScale(14) = 1.00 (aucune compression)
 */
export function getHourScale(hour: number): number {
    // Gaussienne: exp(-((x - μ)² / (2σ²)))
    // Inversée pour compression: 1 - (1 - minScale) × gaussienne
    const exponent = -((hour - COMPRESSION_CENTER) ** 2) / (2 * SIGMA ** 2);
    const gaussianValue = Math.exp(exponent);

    // Scale inversé: minimum au centre, maximum aux extrémités
    const scale = 1 - (1 - MIN_SCALE) * gaussianValue;

    return scale;
}

/**
 * Calcule la hauteur en pixels pour une heure donnée.
 * 
 * @param hour - Heure entière (0-23)
 * @returns Hauteur en pixels (entre BASE_HOUR_HEIGHT × MIN_SCALE et BASE_HOUR_HEIGHT)
 */
export function getHourHeight(hour: number): number {
    return BASE_HOUR_HEIGHT * getHourScale(hour);
}

// =============================================================================
// CACHE DES POSITIONS CUMULATIVES
// Pré-calcul des positions Y pour chaque heure entière (optimisation)
// =============================================================================

/** Cache des positions Y cumulatives pour les heures 0 à 24 */
let _cumulativeHeights: number[] | null = null;

/**
 * Calcule et cache les hauteurs cumulatives pour toutes les heures.
 * Position Y de l'heure H = somme des hauteurs des heures 0 à H-1
 */
function getCumulativeHeights(): number[] {
    if (_cumulativeHeights !== null) return _cumulativeHeights;

    _cumulativeHeights = [0]; // L'heure 0 commence à Y = 0

    for (let h = 0; h < END_HOUR; h++) {
        const prevY = _cumulativeHeights[h];
        const hourH = getHourHeight(h);
        _cumulativeHeights.push(prevY + hourH);
    }

    return _cumulativeHeights;
}

// =============================================================================
// FONCTIONS DE MAPPING
// =============================================================================

/**
 * Convertit une heure (avec décimales) en position Y en pixels.
 * C'est la fonction CENTRALE à utiliser pour tout positionnement.
 * 
 * @param hourFloat - Heure avec décimales (ex: 14.5 = 14h30)
 * @returns Position Y en pixels depuis le haut du calendrier
 * 
 * Algorithme:
 * 1. Récupère la position Y de l'heure entière inférieure (depuis le cache)
 * 2. Ajoute la fraction de l'heure courante × hauteur de cette heure
 */
export function hourToY(hourFloat: number): number {
    // Clamp aux limites du calendrier
    const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR, hourFloat));

    const cumulative = getCumulativeHeights();
    const floorHour = Math.floor(clampedHour);

    // Si exactement sur une heure entière ou à la limite supérieure
    if (floorHour >= END_HOUR) {
        return cumulative[END_HOUR];
    }

    // Position de l'heure entière + fraction de l'heure courante
    const baseY = cumulative[floorHour];
    const fraction = clampedHour - floorHour;
    const currentHourHeight = getHourHeight(floorHour);

    return baseY + fraction * currentHourHeight;
}

/**
 * Convertit une position Y en pixels vers une heure (avec décimales).
 * Fonction inverse de hourToY - utilisée pour la détection des taps.
 * 
 * @param y - Position Y en pixels depuis le haut du calendrier
 * @returns Heure avec décimales (ex: 14.5 = 14h30)
 * 
 * Algorithme:
 * 1. Recherche binaire pour trouver l'heure entière correspondante
 * 2. Calcule la fraction à partir du reste de Y
 */
export function yToHour(y: number): number {
    const cumulative = getCumulativeHeights();
    const totalHeight = cumulative[END_HOUR];

    // Clamp Y aux limites
    if (y <= 0) return START_HOUR;
    if (y >= totalHeight) return END_HOUR;

    // Recherche de l'heure entière par parcours linéaire
    // (24 itérations max, pas besoin de binaire)
    let hour = 0;
    for (let h = 0; h < END_HOUR; h++) {
        if (cumulative[h + 1] > y) {
            hour = h;
            break;
        }
    }

    // Calcul de la fraction
    const baseY = cumulative[hour];
    const hourHeight = getHourHeight(hour);
    const fraction = (y - baseY) / hourHeight;

    return hour + fraction;
}

/**
 * Retourne la hauteur totale du calendrier en pixels.
 * Équivalent à hourToY(24).
 */
export function getTotalHeight(): number {
    const cumulative = getCumulativeHeights();
    return cumulative[END_HOUR];
}

/**
 * Calcule la hauteur en pixels entre deux heures.
 * Utilisé pour la hauteur des événements.
 * 
 * @param startHour - Heure de début (avec décimales)
 * @param endHour - Heure de fin (avec décimales)
 * @returns Hauteur en pixels
 */
export function getHeightBetweenHours(startHour: number, endHour: number): number {
    return hourToY(endHour) - hourToY(startHour);
}

// =============================================================================
// DEBUG / INTROSPECTION
// =============================================================================

/**
 * Affiche un tableau de debug avec les scales et hauteurs de chaque heure.
 * Utile pour vérifier la courbe de compression.
 */
export function debugPrintHourMapping(): void {
    console.log('--- Hour Compression Mapping ---');
    console.log('Hour | Scale  | Height | Cumulative Y');
    console.log('-----|--------|--------|-------------');

    const cumulative = getCumulativeHeights();

    for (let h = 0; h <= END_HOUR; h++) {
        const scale = h < END_HOUR ? getHourScale(h).toFixed(2) : '-';
        const height = h < END_HOUR ? getHourHeight(h).toFixed(0) : '-';
        const y = cumulative[h].toFixed(0);
        console.log(`${String(h).padStart(4)} | ${scale.padStart(6)} | ${String(height).padStart(6)} | ${y}`);
    }
}
