import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api"; // Ensure api is imported to set headers

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    // Initial check or persistent storage load could go here
    useEffect(() => {
        // TODO: Load from AsyncStorage if needed
    }, []);

    const signIn = async (userData: User, newToken: string) => {
        setUser(userData);
        setToken(newToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
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
            }
        } catch (error) {
            console.error("Failed to refresh user", error);
        }
    };

    const signOut = async () => {
        setUser(null);
        setToken(null);
        delete api.defaults.headers.common["Authorization"];
    };

    const value = {
        user,
        token,
        isAuthenticated: !!user,
        signIn,
        updateUser,
        refreshUser,
        signOut
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
