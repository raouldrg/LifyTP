import * as AuthStorage from './authStorage';
import { User } from '../context/AuthContext';

export interface StoredAccount {
    id: string;
    email: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    lastUsedAt?: string; // Implicit in order
}

/**
 * Service for managing multiple locally stored accounts
 * Wraps the new AuthStorage implementation for backward compatibility / UI convenience
 */
export const accountStorage = {
    /**
     * Get all stored accounts
     */
    async getAccounts(): Promise<StoredAccount[]> {
        const { accounts } = await AuthStorage.listSavedAccounts();

        // Map User to StoredAccount interface if needed, although they are compatible
        // The listSavedAccounts already returns sorted by usage
        return accounts.map(user => ({
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        }));
    },

    /**
     * Get the ID of the currently active account
     */
    async getActiveAccountId(): Promise<string | null> {
        return await AuthStorage.getActiveUserId();
    },

    /**
     * Check if we can add more accounts
     */
    async canAddAccount(): Promise<boolean> {
        // Hardcoded limit in authStorage is 3
        const { accounts } = await AuthStorage.listSavedAccounts();
        return accounts.length < 3;
    },

    /**
     * Remove an account
     */
    async removeAccount(id: string): Promise<void> {
        await AuthStorage.clearSessionForUser(id);
    },

    // Legacy/Unused methods kept empty to avoid breaking imports during strict linting if checked
    // saveAccount is now handled by AuthContext.signIn -> authStorage.saveSessionForUser
    async saveAccount(account: StoredAccount): Promise<void> {
        // No-op: AuthStorage handles this automatically when logging in
        console.warn("[AccountStorage] saveAccount is deprecated. Use AuthContext.signIn");
    },

    async setActiveAccount(id: string): Promise<void> {
        // This should be done via AuthContext.switchAccount to ensure token rotation
        console.warn("[AccountStorage] setActiveAccount is deprecated. Use AuthContext.switchAccount");
    }
};
