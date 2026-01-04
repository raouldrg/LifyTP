import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserTheme, DEFAULT_THEMES } from '../constants/eventThemes';

const STORAGE_KEY = 'user_event_themes';

/**
 * Load custom user themes from AsyncStorage
 */
export async function loadUserThemes(): Promise<UserTheme[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (!json) return [];
        return JSON.parse(json) as UserTheme[];
    } catch (error) {
        console.error('[ThemeService] Error loading themes:', error);
        return [];
    }
}

/**
 * Save a new custom theme
 */
export async function saveUserTheme(theme: UserTheme): Promise<void> {
    try {
        const existing = await loadUserThemes();
        const updated = [...existing, theme];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('[ThemeService] Error saving theme:', error);
        throw error;
    }
}

/**
 * Delete a custom theme by ID
 */
export async function deleteUserTheme(themeId: string): Promise<void> {
    try {
        const existing = await loadUserThemes();
        const filtered = existing.filter(t => t.id !== themeId);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('[ThemeService] Error deleting theme:', error);
        throw error;
    }
}

/**
 * Get all themes (default + custom), without duplicates
 */
export async function getAllThemes(): Promise<UserTheme[]> {
    const customThemes = await loadUserThemes();

    // Merge: defaults first, then custom (avoiding name duplicates)
    const defaultNames = new Set(DEFAULT_THEMES.map(t => t.name.toLowerCase()));
    const uniqueCustom = customThemes.filter(
        t => !defaultNames.has(t.name.toLowerCase())
    );

    return [...DEFAULT_THEMES, ...uniqueCustom];
}

/**
 * Check if a theme name already exists
 */
export async function themeNameExists(name: string): Promise<boolean> {
    const allThemes = await getAllThemes();
    return allThemes.some(t => t.name.toLowerCase() === name.toLowerCase().trim());
}

/**
 * Generate a unique theme ID
 */
export function generateThemeId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
