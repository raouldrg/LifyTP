/**
 * AudioPlayerStore - Robust audio player using expo-audio
 * 
 * Features:
 * - Single audio playback (stops previous when new one starts)
 * - Accurate progress tracking (0% to 100%)
 * - Reliable replay from beginning
 * - Speed control
 */

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

export interface AudioPlayerState {
    currentUri: string | null;
    isPlaying: boolean;
    progress: number; // 0-1, accurate to actual playback
    currentTime: number; // ms
    duration: number; // ms
    speed: number;
    isLoaded: boolean;
    hasEnded: boolean; // Track if audio finished naturally
}

type Listener = (state: AudioPlayerState) => void;

// Constants
const PROGRESS_UPDATE_INTERVAL = 50; // ms - more frequent for smoother progress
const LOAD_TIMEOUT = 5000; // ms

class AudioPlayerStoreClass {
    private listeners: Set<Listener> = new Set();
    private state: AudioPlayerState = {
        currentUri: null,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: 0,
        speed: 1,
        isLoaded: false,
        hasEnded: false,
    };

    // Global player - only one at a time
    private currentPlayer: AudioPlayer | null = null;
    private isInitialized = false;
    private updateInterval: NodeJS.Timeout | null = null;

    // ============ Public API ============

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): AudioPlayerState {
        return { ...this.state };
    }

    isPlayingUri(uri: string): boolean {
        return this.state.currentUri === uri && this.state.isPlaying;
    }

    getCurrentUri(): string | null {
        return this.state.currentUri;
    }

    /**
     * Play audio from URI
     * - If same URI and paused: resume (or replay if ended)
     * - If same URI and playing: do nothing
     * - If different URI: stop current, start new
     */
    async play(uri: string, durationMs?: number): Promise<void> {
        await this.initAudioMode();

        const normalizedUri = uri;

        // Same URI - handle resume/replay
        if (this.state.currentUri === normalizedUri) {
            if (this.state.isPlaying) {
                // Already playing, do nothing
                return;
            }

            // Paused or ended - resume or replay
            if (this.currentPlayer) {
                try {
                    // If ended or at the end, seek to beginning
                    if (this.state.hasEnded || this.state.progress >= 0.99) {
                        console.log('[AudioPlayer] Replaying from beginning');
                        this.currentPlayer.seekTo(0);
                        this.updateState({
                            progress: 0,
                            currentTime: 0,
                            hasEnded: false
                        });
                    }

                    this.currentPlayer.play();
                    this.updateState({ isPlaying: true });
                    this.startProgressUpdates();
                    console.log('[AudioPlayer] Resumed playback');
                    return;
                } catch (e) {
                    console.error('[AudioPlayer] Resume failed:', e);
                    // Fall through to create new player
                }
            }
        }

        // Different URI or failed resume - create new player
        await this.releaseCurrentPlayer();

        // Update state for new audio
        this.updateState({
            currentUri: normalizedUri,
            isPlaying: false,
            progress: 0,
            currentTime: 0,
            duration: durationMs || 0,
            isLoaded: false,
            hasEnded: false,
        });

        try {
            console.log('[AudioPlayer] Creating player for:', normalizedUri);
            const player = createAudioPlayer({ uri: normalizedUri });
            this.currentPlayer = player;

            // Wait for load with timeout
            const loadedSuccessfully = await this.waitForLoad(player);

            if (loadedSuccessfully) {
                const actualDuration = (player.duration || 0) * 1000;
                console.log('[AudioPlayer] Loaded, duration:', actualDuration);

                player.play();
                this.updateState({
                    isPlaying: true,
                    isLoaded: true,
                    duration: actualDuration || durationMs || 0,
                });
                this.startProgressUpdates();
            } else {
                console.error('[AudioPlayer] Failed to load after timeout');
                this.updateState({ isPlaying: false, isLoaded: false });
            }
        } catch (e) {
            console.error('[AudioPlayer] Failed to create player:', e);
            this.updateState({ isPlaying: false, isLoaded: false });
        }
    }

    /**
     * Pause current playback
     */
    async pause(): Promise<void> {
        if (this.currentPlayer && this.state.isPlaying) {
            try {
                this.currentPlayer.pause();
                this.updateState({ isPlaying: false });
                this.stopProgressUpdates();
                console.log('[AudioPlayer] Paused');
            } catch (e) {
                console.error('[AudioPlayer] Pause failed:', e);
            }
        }
    }

    /**
     * Toggle play/pause for URI
     */
    async togglePlayPause(uri: string, durationMs?: number): Promise<void> {
        if (this.state.currentUri === uri && this.state.isPlaying) {
            await this.pause();
        } else {
            await this.play(uri, durationMs);
        }
    }

    /**
     * Set playback speed
     */
    async setSpeed(rate: number): Promise<void> {
        this.updateState({ speed: rate });
        if (this.currentPlayer) {
            try {
                this.currentPlayer.setPlaybackRate(rate);
            } catch (e) {
                console.error('[AudioPlayer] Failed to set speed:', e);
            }
        }
    }

    /**
     * Stop playback completely
     */
    async stop(): Promise<void> {
        await this.releaseCurrentPlayer();
        this.updateState({
            currentUri: null,
            isPlaying: false,
            progress: 0,
            currentTime: 0,
            duration: 0,
            isLoaded: false,
            hasEnded: false,
        });
    }

    /**
     * Seek to position (0-1)
     */
    async seek(position: number): Promise<void> {
        if (this.currentPlayer && this.state.duration > 0) {
            const timeSeconds = (position * this.state.duration) / 1000;
            try {
                this.currentPlayer.seekTo(timeSeconds);
                this.updateState({
                    progress: position,
                    currentTime: position * this.state.duration,
                    hasEnded: false,
                });
            } catch (e) {
                console.error('[AudioPlayer] Seek failed:', e);
            }
        }
    }

    // ============ Private Methods ============

    private async initAudioMode(): Promise<void> {
        try {
            await setAudioModeAsync({
                playsInSilentMode: true,
            });
            if (!this.isInitialized) {
                console.log('[AudioPlayer] Audio mode initialized');
                this.isInitialized = true;
            }
        } catch (e) {
            console.error('[AudioPlayer] Failed to set audio mode:', e);
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.state));
    }

    private updateState(partial: Partial<AudioPlayerState>): void {
        this.state = { ...this.state, ...partial };
        this.notifyListeners();
    }

    private async waitForLoad(player: AudioPlayer): Promise<boolean> {
        const startTime = Date.now();
        while (!player.isLoaded && Date.now() - startTime < LOAD_TIMEOUT) {
            await new Promise(r => setTimeout(r, 50));
        }
        return player.isLoaded;
    }

    private startProgressUpdates(): void {
        this.stopProgressUpdates();

        this.updateInterval = setInterval(() => {
            if (!this.currentPlayer) {
                this.stopProgressUpdates();
                return;
            }

            const currentTimeMs = (this.currentPlayer.currentTime || 0) * 1000;
            const durationMs = (this.currentPlayer.duration || 0) * 1000;
            const isActuallyPlaying = this.currentPlayer.playing;

            // Calculate accurate progress
            const progress = durationMs > 0
                ? Math.min(Math.max(currentTimeMs / durationMs, 0), 1)
                : 0;

            // Detect natural end of playback
            if (this.state.isPlaying && !isActuallyPlaying && durationMs > 0) {
                // Check if we're at or very near the end
                const isAtEnd = currentTimeMs >= durationMs - 100 || progress >= 0.99;

                if (isAtEnd) {
                    console.log('[AudioPlayer] Playback finished naturally');
                    this.updateState({
                        isPlaying: false,
                        progress: 1,
                        currentTime: durationMs,
                        hasEnded: true,
                    });
                    this.stopProgressUpdates();
                    return;
                }
            }

            // Regular progress update
            if (this.state.isPlaying) {
                this.updateState({
                    currentTime: currentTimeMs,
                    duration: durationMs || this.state.duration,
                    progress,
                    isLoaded: this.currentPlayer.isLoaded,
                });
            }
        }, PROGRESS_UPDATE_INTERVAL);
    }

    private stopProgressUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private async releaseCurrentPlayer(): Promise<void> {
        this.stopProgressUpdates();

        if (this.currentPlayer) {
            try {
                this.currentPlayer.remove();
                console.log('[AudioPlayer] Player released');
            } catch (e) {
                console.error('[AudioPlayer] Error releasing player:', e);
            }
            this.currentPlayer = null;
        }
    }
}

// Export singleton instance
export const AudioPlayerStore = new AudioPlayerStoreClass();
