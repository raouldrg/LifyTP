import React, { createContext, useContext, useState, useEffect } from "react";
import { api, socket } from "../lib/api"; // Ensure api is imported to set headers

// Define User type based on what we expect from the backend
export interface User {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string;
    role?: string;
    bio?: string;
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
    signIn: (userData: User, token: string) => Promise<void>;
    updateUser: (partialUser: Partial<User>) => void;
    refreshUser: () => Promise<void>;
    signOut: () => Promise<void>;
    unreadCount: number;
    fetchUnreadCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    // Initial check or persistent storage load could go here
    useEffect(() => {
        // TODO: Load from AsyncStorage if needed
    }, []);

    useEffect(() => {
        if (user?.id) {
            const joinRoom = () => socket.emit("join", user.id);
            joinRoom(); // Join immediately

            // Re-join on reconnect
            socket.on("connect", joinRoom);

            fetchUnreadCount();

            const handleNewMsg = () => {
                fetchUnreadCount();
            };
            socket.on("message:new", handleNewMsg);

            return () => {
                socket.off("connect", joinRoom);
                socket.off("message:new", handleNewMsg);
            };
        }
    }, [user?.id]);

    const fetchUnreadCount = async () => {
        try {
            const res = await api.get("/messages/unread");
            setUnreadCount(res.data.count);
        } catch (e) {
            console.error(e);
        }
    };

    const signIn = async (userData: User, newToken: string) => {
        setUser(userData);
        setToken(newToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        fetchUnreadCount(); // Fetch unread count on sign in
    };

    const updateUser = (partialUser: Partial<User>) => {
        setUser(prev => prev ? { ...prev, ...partialUser } : null);
    };

    const refreshUser = async () => {
        if (!token) return;
        try {
            const res = await api.get("/me");
            if (res.data.user) {
                setUser(res.data.user);
                fetchUnreadCount(); // Also refresh unread count
            }
        } catch (error) {
            console.error("Failed to refresh user", error);
        }
    };

    const signOut = async () => {
        setUser(null);
        setToken(null);
        setUnreadCount(0); // Clear unread count on sign out
        delete api.defaults.headers.common["Authorization"];
    };

    const value = {
        user,
        token,
        isAuthenticated: !!user,
        signIn,
        updateUser,
        refreshUser,
        signOut,
        unreadCount,
        fetchUnreadCount
    };

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
