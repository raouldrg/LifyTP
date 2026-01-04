import { EventTheme } from "../types/events";

// ==============================================================
// LIFY OFFICIAL COLOR PALETTE (15 colors)
// ==============================================================
export interface LifyColor {
    name: string;
    hex: string;
}

export const LIFY_THEME_COLORS: LifyColor[] = [
    { name: "Lify Orange", hex: "#FF9F6E" },
    { name: "Bleu Travail", hex: "#5B8DEF" },
    { name: "Bleu Clair", hex: "#AFCBFF" },
    { name: "Vert Sport", hex: "#6FCF97" },
    { name: "Vert Doux", hex: "#B7E4C7" },
    { name: "Jaune Social", hex: "#F2C94C" },
    { name: "Beige Lify", hex: "#F5E6CC" },
    { name: "Rouge Famille", hex: "#EB5757" },
    { name: "Rose Doux", hex: "#F4A6B8" },
    { name: "Violet Créatif", hex: "#9B51E0" },
    { name: "Lavande", hex: "#D7C6F2" },
    { name: "Turquoise Santé", hex: "#56CCF2" },
    { name: "Menthe", hex: "#A8E6CF" },
    { name: "Gris Clair", hex: "#E0E0E0" },
    { name: "Gris Chaud", hex: "#BDBDBD" },
];

// ==============================================================
// USER THEME INTERFACE
// ==============================================================
export interface UserTheme {
    id: string;
    name: string;
    colorHex: string;
    isDefault?: boolean;
}

// ==============================================================
// DEFAULT THEMES (using Lify palette)
// ==============================================================
export const DEFAULT_THEMES: UserTheme[] = [
    { id: "travail", name: "Travail", colorHex: "#5B8DEF", isDefault: true },
    { id: "sport", name: "Sport", colorHex: "#6FCF97", isDefault: true },
    { id: "social", name: "Social", colorHex: "#F2C94C", isDefault: true },
    { id: "famille", name: "Famille", colorHex: "#EB5757", isDefault: true },
    { id: "sante", name: "Santé", colorHex: "#56CCF2", isDefault: true },
];

// ==============================================================
// STYLE HELPERS
// ==============================================================

/**
 * Calculate visual styles for a theme based on its color
 * - Background: colorHex at 20% opacity
 * - Text: colorHex at full intensity
 */
export function getThemeStyles(colorHex: string): { bg: string; text: string; accent: string } {
    return {
        bg: colorHex + "33", // ~20% opacity (hex 33 = 51/255 ≈ 20%)
        text: colorHex,
        accent: colorHex,
    };
}

/**
 * Find a theme by ID from a list of themes
 */
export function findThemeById(themes: UserTheme[], themeId?: string): UserTheme | undefined {
    if (!themeId) return undefined;
    return themes.find(t => t.id === themeId);
}

/**
 * Resolve full theme object for an event (including fallback)
 * Returns theme name, color, and isSystem flag
 */
export function resolveTheme(
    event: { themeId?: string; colorHex?: string; theme?: EventTheme },
    allThemes: UserTheme[]
): UserTheme {
    // Priority 1: Lookup by themeId
    if (event.themeId) {
        const theme = findThemeById(allThemes, event.themeId);
        if (theme) return theme;
    }

    // Priority 2: Legacy theme name lookup
    if (event.theme) {
        const legacy = DEFAULT_THEMES.find(t => t.name === event.theme);
        if (legacy) return legacy;
    }

    // Fallback: "Autre" theme
    return { id: 'autre', name: 'Autre', colorHex: event.colorHex || '#BDBDBD', isDefault: true };
}

/**
 * Resolve color for an event (prioritize colorHex, fallback to theme lookup)
 */
export function resolveEventColor(
    event: { themeId?: string; colorHex?: string; theme?: EventTheme; color?: string },
    allThemes: UserTheme[]
): string {
    // Priority 1: Direct colorHex on event
    if (event.colorHex) return event.colorHex;

    // Priority 2: Lookup by themeId
    if (event.themeId) {
        const theme = findThemeById(allThemes, event.themeId);
        if (theme) return theme.colorHex;
    }

    // Priority 3: Legacy theme name lookup
    if (event.theme) {
        const legacy = DEFAULT_THEMES.find(t => t.name === event.theme);
        if (legacy) return legacy.colorHex;
    }

    // Priority 4: Legacy color field
    if (event.color) return event.color;

    // Fallback: Lify Orange
    return "#FF9F6E";
}

// ==============================================================
// LEGACY COMPATIBILITY (for existing code that uses old types)
// ==============================================================
export const THEME_STYLES: Record<EventTheme, { bg: string; accent: string; text: string }> = {
    "Travail": { bg: "#5B8DEF33", accent: "#5B8DEF", text: "#5B8DEF" },
    "Sport": { bg: "#6FCF9733", accent: "#6FCF97", text: "#6FCF97" },
    "Social": { bg: "#F2C94C33", accent: "#F2C94C", text: "#9B7800" }, // Darker text for yellow
    "Famille": { bg: "#EB575733", accent: "#EB5757", text: "#EB5757" },
    "Santé": { bg: "#56CCF233", accent: "#56CCF2", text: "#1A8AAD" }, // Darker text for cyan
    "Autre": { bg: "#BDBDBD33", accent: "#BDBDBD", text: "#757575" },
};

export const EVENT_THEMES: Record<EventTheme, string> = {
    "Travail": "#5B8DEF",
    "Sport": "#6FCF97",
    "Social": "#F2C94C",
    "Famille": "#EB5757",
    "Santé": "#56CCF2",
    "Autre": "#BDBDBD",
};

export const THEME_OPTIONS: EventTheme[] = [
    "Travail", "Sport", "Social", "Famille", "Santé", "Autre"
];
