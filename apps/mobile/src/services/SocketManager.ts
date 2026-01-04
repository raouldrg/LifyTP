import { AppState, AppStateStatus } from 'react-native';
import { socket } from './socket';

export class SocketManager {
    private static instance: SocketManager;
    private listeners: (() => void)[] = [];
    private authErrorCallback: (() => void) | null = null;
    private isInitialized = false;

    private constructor() {
        // Private constructor
    }

    public static getInstance(): SocketManager {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }

    public initialize(
        token: string,
        onSync: () => void,
        onAuthError: () => void
    ) {
        // Update auth token
        socket.auth = { token };

        // Reset listeners and add the initial sync callback
        this.listeners = [];
        this.addSyncListener(onSync);

        this.authErrorCallback = onAuthError;

        if (!this.isInitialized) {
            this.setupListeners();
            this.setupAppState();
            this.isInitialized = true;
        }

        if (!socket.connected) {
            socket.connect();
        }
    }

    private setupListeners() {
        // Remove existing listeners to avoid duplicates if re-initialized
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');

        socket.on('connect', () => {
            console.log('[SocketManager] Connected');
            this.notifySync();
        });

        socket.on('disconnect', (reason) => {
            console.log('[SocketManager] Disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
            console.log('[SocketManager] Connection Error:', err.message);
            if (err.message.includes("Unauthorized")) {
                this.authErrorCallback?.();
            }
            // Let the built-in Manager handle reconnection, but ensure we don't spam
            // Socket.io client already has randomization and backoff, but we can verify config
        });

        // Manual Backoff Config via Manager if accessing underlying manager:
        if (socket.io) {
            socket.io.reconnection(true);
            socket.io.reconnectionAttempts(Infinity);
            socket.io.reconnectionDelay(1000);
            socket.io.reconnectionDelayMax(30000); // Max 30s
            socket.io.randomizationFactor(0.5);
        }
    }

    private setupAppState() {
        AppState.addEventListener('change', this.handleAppStateChange);
    }

    private handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
            console.log('[SocketManager] App active, checking connection');
            if (!socket.connected) {
                socket.connect();
            }
            // Trigger sync to fetch messages missed while backgrounded/disconnected
            this.notifySync();
        }
    }

    public addSyncListener(callback: () => void) {
        this.listeners.push(callback);
    }

    public removeSyncListener(callback: () => void) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    private notifySync() {
        this.listeners.forEach(cb => cb());
    }

    public updateToken(newToken: string) {
        socket.auth = { token: newToken };
        // If we were disconnected due to auth error, reconnect now
        if (!socket.connected) {
            socket.connect();
        }
    }

    public disconnect() {
        if (socket.connected) {
            socket.disconnect();
        }
    }
}
