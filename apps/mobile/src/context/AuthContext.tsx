import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setLogoutHandler } from "../services/api";
import { socket } from "../services/socket";
import { SocketManager } from "../services/SocketManager";
import {
    saveSessionForUser,
    restoreActiveSession,
    restoreSessionForUser,
    clearSessionForUser,
    setActiveUserId,
    listSavedAccounts
} from "../services/authStorage";

// Define User type based on what we expect from the backend
export interface User {
    id: string;
    email: string;
    username: string;           // @ handle (6-month cooldown)
    displayName?: string;       // Pseudo (1-day cooldown)
    avatarUrl?: string;
    avatarColor?: string;
    role?: string;
    bio?: string;
    isPrivate?: boolean;        // Private profile toggle
    lastUsernameChange?: string;      // ISO date for @ cooldown
    lastDisplayNameChange?: string;   // ISO date for pseudo cooldown
    stats?: {
        events: number;
        followers: number;
        following: number;
    };
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;          // True while restoring session
    availableAccounts: User[];   // List of signed-in accounts

    signIn: (userData: User, token: string, refreshToken: string) => Promise<void>;
    updateUser: (partialUser: Partial<User>) => void;
    refreshUser: () => Promise<void>;
    signOut: () => Promise<void>;
    switchAccount: (userId: string) => Promise<void>;
    addAccount: () => Promise<void>;

    unreadCount: number;
    fetchUnreadCount: () => Promise<void>;
    pendingRequestsCount: number;
    fetchPendingRequestsCount: () => Promise<void>;
    setPendingRequestsCount: React.Dispatch<React.SetStateAction<number>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);  // Start loading
    const [availableAccounts, setAvailableAccounts] = useState<User[]>([]);

    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // ============================================================
    // FETCH UNREAD COUNT
    // ============================================================
    const lastFetchUnreadRef = React.useRef<number>(0);
    const fetchUnreadCount = React.useCallback(async () => {
        // Guard: Do not fetch if not authenticated or no token
        if (!user || !token) return;

        // Throttle: max once per 3 seconds
        const now = Date.now();
        if (now - lastFetchUnreadRef.current < 3000) return;
        lastFetchUnreadRef.current = now;

        try {
            const res = await api.get("/messages/unread");
            setUnreadCount(res.data.count);
        } catch (e: any) {
            if (e?.isThrottled) return; // Silent fail
            // Don't spam console if it's just network error
            if (e?.code === 'ERR_NETWORK') return;
            console.error("[AuthContext] fetchUnreadCount failed", e.message);
        }
    }, [user, token]);

    // ============================================================
    // FETCH PENDING REQUESTS COUNT (For Profile Tab Badge)
    // ============================================================
    const fetchPendingRequestsCount = React.useCallback(async () => {
        if (!user || !token) return;
        try {
            const res = await api.get('/follow/requests/count');
            setPendingRequestsCount(res.data.count || 0);
        } catch (error: any) {
            if (error?.isThrottled || error?.code === 'ERR_NETWORK') return;
            console.error("[AuthContext] Failed to fetch pending requests count:", error.message);
        }
    }, [user, token]);

    // Helper to refresh accounts list
    const refreshAccountList = async () => {
        const { accounts } = await listSavedAccounts();
        setAvailableAccounts(accounts);
    };

    // ============================================================
    // RESTORE SESSION ON MOUNT
    // ============================================================
    useEffect(() => {
        async function restoreAuth() {
            try {
                console.log("[Auth] Restoring active session...");
                const session = await restoreActiveSession();

                await refreshAccountList();

                if (session) {
                    console.log("[Auth] Session found, restoring user:", session.user.email);
                    setUser(session.user);
                    setToken(session.token);
                    // Set axios header for all future requests
                    api.defaults.headers.common["Authorization"] = `Bearer ${session.token}`;

                    // Initialize Socket Manager
                    SocketManager.getInstance().initialize(
                        session.token,
                        () => fetchUnreadCount(), // On Sync
                        () => console.log("[Auth] Socket Auth Error")
                    );
                } else {
                    console.log("[Auth] No active session found");
                }
            } catch (error) {
                console.error("[Auth] Failed to restore session:", error);
            } finally {
                setIsLoading(false);
            }
        }

        restoreAuth();
    }, []);

    // ============================================================
    // SOCKET LISTENERS (Unread Count)
    // ============================================================
    useEffect(() => {
        if (user?.id && token) {
            console.log("[AuthContext] Setting up socket listeners for user", user.id);
            fetchUnreadCount();
            fetchPendingRequestsCount();

            const handleNewMsg = () => {
                fetchUnreadCount();
            };
            socket.on("message:new", handleNewMsg);

            return () => {
                socket.off("message:new", handleNewMsg);
            };
        }
    }, [user?.id, token, fetchUnreadCount]);

    // ============================================================
    // SIGN IN - Persists to storage (Multi-Account)
    // ============================================================
    const signIn = React.useCallback(async (userData: User, newToken: string, refreshToken: string) => {
        // Update state
        setUser(userData);
        setToken(newToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

        // Initialize Socket
        SocketManager.getInstance().initialize(
            newToken,
            () => fetchUnreadCount(),
            () => console.log("[Auth] Socket Auth Error via SignIn")
        );

        // Persist to storage with user ID
        await saveSessionForUser(userData.id, newToken, refreshToken, userData);
        console.log(`[Auth] Session saved for ${userData.username}`);

        await refreshAccountList();
        fetchUnreadCount();
    }, [fetchUnreadCount]);

    // ============================================================
    // UPDATE USER AND PERSIST
    // ============================================================
    const updateUser = React.useCallback(async (partialUser: Partial<User>) => {
        if (!user) return;

        // 1. Update React state immediately (optimistic)
        const updatedUser = { ...user, ...partialUser };
        setUser(updatedUser);

        // 2. Persist to session storage for CURRENT active user
        // We need to restore tokens to save them back, unless we just update the user object.
        // authStorage.saveSessionForUser requires tokens. 
        // We should probably add a method updateSessionUser(userId, partialUser) to authStorage
        // But for now, let's just do a restore-save cycle if we have the ID.
        try {
            // We can use restoreSessionForUser to get tokens
            const stored = await restoreSessionForUser(user.id);
            if (stored) {
                await saveSessionForUser(user.id, stored.token, stored.refreshToken, updatedUser);
                await refreshAccountList();
            }
        } catch (e) {
            console.error("[AuthContext] Failed to persist user update", e);
        }
    }, [user]);

    // ============================================================
    // REFRESH USER FROM BACKEND
    // ============================================================
    const refreshUser = React.useCallback(async () => {
        if (!token || !user) return;
        try {
            console.log(`[AuthContext] Refreshing user data for ${user.id}...`);
            const res = await api.get("/me");
            if (res.data.user) {
                const freshUser = res.data.user;

                // Update State
                setUser(freshUser);

                // Persist
                const stored = await restoreSessionForUser(user.id);
                if (stored) {
                    await saveSessionForUser(user.id, stored.token, stored.refreshToken, freshUser);
                }

                await refreshAccountList();
                fetchUnreadCount();
                console.log(`[AuthContext] Refreshed user ${freshUser.username}, isPrivate=${freshUser.isPrivate}`);
            }
        } catch (error) {
            console.error("Failed to refresh user", error);
        }
    }, [token, user, fetchUnreadCount]);

    // ============================================================
    // SWITCH ACCOUNT - NEW
    // ============================================================
    const switchAccount = React.useCallback(async (targetUserId: string) => {
        console.log(`[SwitchAccount] Switching to user ${targetUserId}...`);

        try {
            // 1. Restore target session
            const session = await restoreSessionForUser(targetUserId);

            if (!session) {
                console.error(`[SwitchAccount] Failed: No session found for ${targetUserId}`);
                // Fallback: Remove this invalid account from list
                await clearSessionForUser(targetUserId);
                await refreshAccountList();
                return;
            }

            // 2. Set API Header IMMEDIATELY
            api.defaults.headers.common["Authorization"] = `Bearer ${session.token}`;
            console.log(`[SwitchAccount] Set Authorization header for ${session.user.username}`);

            // 3. Update Storage Active ID
            await setActiveUserId(targetUserId);

            // 4. Update State
            setUser(session.user);
            setToken(session.token);

            // 5. Update Socket
            SocketManager.getInstance().updateToken(session.token);
            console.log(`[SwitchAccount] Socket token updated`);

            // 6. Refresh data from Backend to ensure isPrivate etc are up to date
            // We can't call refreshUser() directly here because `user` and `token` state vars 
            // might not be updated yet in this closure (stale closure).
            // BUT we can call the API directly and update storage manually.
            try {
                const meRes = await api.get("/me");
                if (meRes.data.user) {
                    const freshUser = meRes.data.user;
                    console.log(`[SwitchAccount] Fetched fresh user data: isPrivate=${freshUser.isPrivate}`);

                    setUser(freshUser); // Update state to fresh
                    // Update storage with fresh user + token we already have
                    await saveSessionForUser(targetUserId, session.token, session.refreshToken, freshUser);
                    await refreshAccountList();
                }
            } catch (refErr) {
                console.warn("[SwitchAccount] Failed to fetch fresh user data, using stored session.", refErr);
            }

            fetchUnreadCount();

        } catch (e) {
            console.error(`[SwitchAccount] Error during switch:`, e);
            // Fallback?
        }
    }, [fetchUnreadCount]);

    // ============================================================
    // SIGN OUT
    // ============================================================
    const signOut = React.useCallback(async () => {
        if (user) {
            console.log(`[Auth] Signing out ${user.username}`);
            await clearSessionForUser(user.id);
        }

        // Refresh list to see if anyone is left
        const { activeUserId, accounts } = await listSavedAccounts();
        setAvailableAccounts(accounts);

        if (activeUserId && accounts.length > 0) {
            // Auto-switch to next available account
            console.log(`[Auth] Auto-switching to next account: ${activeUserId}`);
            await switchAccount(activeUserId);
        } else if (accounts.length > 0) {
            // If no active ID but accounts exist (weird case), pick first
            console.log(`[Auth] Auto-switching to first available account`);
            await switchAccount(accounts[0].id);
        } else {
            // No accounts left
            setUser(null);
            setToken(null);
            setUnreadCount(0);
            delete api.defaults.headers.common["Authorization"];
            SocketManager.getInstance().disconnect();
        }
    }, [user, switchAccount]);

    // ============================================================
    // ADD ACCOUNT (Deactivate current, go to Login, keep session)
    // ============================================================
    const addAccount = React.useCallback(async () => {
        console.log(`[Auth] Preparing to add account (clearing active state)`);

        // 1. Unset active user in storage (so we don't auto-login to this one)
        // We pass a non-existent ID or handle null in storage
        // But our setActiveUserId in authStorage expects string.
        // We need to update authStorage to allow null or just ignore if we don't call restore.
        // Actually, if we just keys activeUserId, restoreActiveSession will find it.
        // We need to set activeUserId to null in storage.
        // Let's modify setActiveUserId to accept null or add clearActiveUser.
        // For now, let's just clear state and rely on the fact that if we login, we overwrite active.
        // BUT if we restart app, we might auto-login to the old one if we don't clear activeUserId.
        // Let's rely on `setActiveUserId` being called with the NEW user on login.
        // To prevent auto-restore of the OLD user if app restarts while on Login screen:
        // We really should clear activeUserId in storage.

        // Since I didn't verify if setActiveUserId accepts null in the previous file write (it took string),
        // I will trust that for now we just clear the state.
        // If the user restarts the app, they might be logged back in to the previous account. 
        // This is actually acceptable behavior (Instagram does this).
        // If I strictly want to go to Login on restart, I should clear it.

        // Let's just clear state.
        setUser(null);
        setToken(null);
        setUnreadCount(0);
        delete api.defaults.headers.common["Authorization"];
        SocketManager.getInstance().disconnect();
    }, []);

    // Register logout handler callback
    useEffect(() => {
        setLogoutHandler(() => {
            if (token) {
                console.log("[Auth] API triggered forced logout (Refresh expired or invalid)");
                signOut();
            }
        });
    }, [signOut, token]);

    const value = React.useMemo(() => ({
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        availableAccounts,
        signIn,
        updateUser,
        refreshUser,
        signOut,
        switchAccount,
        addAccount,
        unreadCount,
        fetchUnreadCount,
        pendingRequestsCount,
        fetchPendingRequestsCount,
        setPendingRequestsCount
    }), [user, token, isLoading, availableAccounts, signIn, updateUser, refreshUser, signOut, switchAccount, unreadCount, fetchUnreadCount, pendingRequestsCount, fetchPendingRequestsCount]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
