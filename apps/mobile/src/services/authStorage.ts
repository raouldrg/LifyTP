/**
 * authStorage.ts - Secure storage for authentication data (Multi-Account Support)
 * 
 * Architecture:
 * - Sessions Map (AsyncStorage): "accounts:sessions" -> { activeUserId, sessions: { [userId]: { user, updatedAt } } }
 * - Tokens (SecureStore): "token:<userId>" -> accessToken
 * - RefreshTokens (SecureStore): "refresh:<userId>" -> refreshToken
 * 
 * This separation ensures sensitive data is encrypted, while the user list is easily accessible.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../context/AuthContext';

// Storage Keys
const SESSIONS_KEY = 'accounts:sessions';
const MAX_SESSIONS = 3;

interface SessionData {
    user: User;
    updatedAt: number;
}

interface SessionsStore {
    activeUserId: string | null;
    sessions: Record<string, SessionData>;
}

// ============================================================
// HELPER: Key Generators & Sanitizer
// ============================================================

/**
 * Sanitize key for SecureStore (alphanumeric, '.', '-', '_')
 * Replaces any invalid character with '_'
 */
function safeKey(raw: string): string {
    if (!raw) throw new Error("SecureStore key empty");
    return raw.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

const getTokenKey = (userId: string) => safeKey(`lify.token.${userId}`);
const getRefreshKey = (userId: string) => safeKey(`lify.refresh.${userId}`);

// ============================================================
// CORE STORAGE OPERATIONS
// ============================================================

/**
 * Get the full sessions store object
 */
async function getSessionsStore(): Promise<SessionsStore> {
    try {
        const json = await AsyncStorage.getItem(SESSIONS_KEY);
        if (!json) {
            return { activeUserId: null, sessions: {} };
        }
        return JSON.parse(json);
    } catch (error) {
        console.error('[AuthStorage] Failed to read sessions store:', error);
        return { activeUserId: null, sessions: {} };
    }
}

/**
 * Save the sessions store object
 */
async function saveSessionsStore(store: SessionsStore): Promise<void> {
    try {
        await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(store));
    } catch (error) {
        console.error('[AuthStorage] Failed to save sessions store:', error);
    }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Save a user session (User + Tokens)
 * Handles LRU eviction if > MAX_SESSIONS
 */
export async function saveSessionForUser(
    userId: string,
    accessToken: string,
    refreshToken: string,
    user: User
): Promise<void> {
    if (!userId) {
        console.error('[AuthStorage] saveSessionForUser aborted: userId is empty');
        return;
    }

    try {
        console.log(`[AuthStorage] Saving session for ${userId} (${user.username})`);

        // 1. SecureStore: Save Tokens
        // We catch SecureStore errors to avoid blocking the login flow if persistence fails
        try {
            await Promise.all([
                SecureStore.setItemAsync(getTokenKey(userId), accessToken),
                SecureStore.setItemAsync(getRefreshKey(userId), refreshToken)
            ]);
        } catch (ssError) {
            console.error('[AuthStorage] SecureStore save failed (tokens not persisted):', ssError);
            // In a real app, you might want to inform the user or track this error.
            // But we proceed to save the session metadata so the user can at least use the app now.
        }

        // 2. AsyncStorage: Update Sessions Map
        const store = await getSessionsStore();

        // Update or Add session
        store.sessions[userId] = {
            user,
            updatedAt: Date.now()
        };

        // Set as active
        store.activeUserId = userId;

        // LRU Garbage Collection
        const userIds = Object.keys(store.sessions);
        if (userIds.length > MAX_SESSIONS) {
            // Find oldest session to remove
            const sortedIds = userIds.sort((a, b) =>
                store.sessions[b].updatedAt - store.sessions[a].updatedAt
            );

            // Keep top MAX_SESSIONS, remove the rest
            const idsToRemove = sortedIds.slice(MAX_SESSIONS);

            for (const idToRemove of idsToRemove) {
                if (idToRemove !== store.activeUserId) { // Don't remove active user
                    console.log(`[AuthStorage] Evicting old session: ${idToRemove}`);
                    delete store.sessions[idToRemove];
                    try {
                        await SecureStore.deleteItemAsync(getTokenKey(idToRemove));
                        await SecureStore.deleteItemAsync(getRefreshKey(idToRemove));
                    } catch (e) {
                        console.warn(`[AuthStorage] Failed to cleanup secure tokens for evicted user ${idToRemove}`);
                    }
                }
            }
        }

        await saveSessionsStore(store);

    } catch (error) {
        console.error('[AuthStorage] Failed to save session:', error);
        // We don't re-throw to keep the app working in the current session
    }
}

/**
 * Restore a specific user's session
 */
export async function restoreSessionForUser(userId: string): Promise<{ user: User, token: string, refreshToken: string } | null> {
    try {
        const store = await getSessionsStore();
        const sessionData = store.sessions[userId];

        if (!sessionData) {
            console.warn(`[AuthStorage] No session found for user ${userId}`);
            return null;
        }

        const [token, refreshToken] = await Promise.all([
            SecureStore.getItemAsync(getTokenKey(userId)),
            SecureStore.getItemAsync(getRefreshKey(userId))
        ]);

        if (!token || !refreshToken) {
            console.warn(`[AuthStorage] Missing tokens for user ${userId}`);
            return null;
        }

        return {
            user: sessionData.user,
            token,
            refreshToken
        };

    } catch (error) {
        console.error('[AuthStorage] Failed to restore session for user:', error);
        return null;
    }
}

/**
 * Restore the currently active session (on app launch)
 */
export async function restoreActiveSession(): Promise<{ user: User, token: string, refreshToken: string } | null> {
    const store = await getSessionsStore();
    if (!store.activeUserId) return null;
    return restoreSessionForUser(store.activeUserId);
}

/**
 * Get active User ID
 */
export async function getActiveUserId(): Promise<string | null> {
    const store = await getSessionsStore();
    return store.activeUserId;
}

/**
 * Set active User ID (without changing data)
 */
export async function setActiveUserId(userId: string): Promise<void> {
    const store = await getSessionsStore();
    if (store.sessions[userId]) {
        store.activeUserId = userId;
        await saveSessionsStore(store);
    }
}

/**
 * Get refresh token for a specific user (Used by Axios interceptor)
 */
export async function getRefreshTokenForUser(userId: string): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(getRefreshKey(userId));
    } catch (error) {
        return null;
    }
}

/**
 * List all saved accounts
 */
export async function listSavedAccounts(): Promise<{ activeUserId: string | null, accounts: User[] }> {
    const store = await getSessionsStore();
    const accounts = Object.values(store.sessions)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(s => s.user);

    return {
        activeUserId: store.activeUserId,
        accounts
    };
}

/**
 * Remove a specific user session (Logout one account)
 */
export async function clearSessionForUser(userId: string): Promise<void> {
    try {
        console.log(`[AuthStorage] Clearing session for ${userId}`);
        const store = await getSessionsStore();

        if (store.sessions[userId]) {
            delete store.sessions[userId];
        }

        // If we removed the active user, clear activeUserId
        if (store.activeUserId === userId) {
            store.activeUserId = null;
            // Optionally promote another user? No, let AuthContext handle that.
        }

        await saveSessionsStore(store);

        // Clear secure tokens
        await Promise.all([
            SecureStore.deleteItemAsync(getTokenKey(userId)),
            SecureStore.deleteItemAsync(getRefreshKey(userId))
        ]);

    } catch (error) {
        console.error('[AuthStorage] Failed to clear session:', error);
    }
}

/**
 * Clear ALL sessions (Logout All)
 */
export async function clearAllSessions(): Promise<void> {
    try {
        const store = await getSessionsStore();
        const userIds = Object.keys(store.sessions);

        await Promise.all(userIds.map(id => clearSessionForUser(id)));

        await AsyncStorage.removeItem(SESSIONS_KEY);
    } catch (error) {
        console.error('[AuthStorage] Failed to clear all sessions:', error);
    }
}

// ============================================================
// MIGRATION / COMPATIBILITY (Optional)
// ============================================================
// Wrappers to maintain compatibility if other files import singular saveToken etc.
// But ideally we should refactor them.
// For now, let's export these dummy functions or mapped functions if needed.
// Only if we want to avoid breaking everything immediately.

export const saveToken = async (t: string) => { console.warn("Deprecated saveToken called"); };
export const getToken = async () => { console.warn("Deprecated getToken called"); return null; };
export const saveRefreshToken = async (t: string) => { console.warn("Deprecated saveRefreshToken called"); };
export const getRefreshToken = async () => {
    // Fallback: try to get for active user
    const active = await getActiveUserId();
    if (active) return getRefreshTokenForUser(active);
    return null;
};
export const clearSession = clearAllSessions;
export const saveUser = async (u: User) => { console.warn("Deprecated saveUser called"); };
