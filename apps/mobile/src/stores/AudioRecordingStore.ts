/**
 * AudioRecordingStore - Robust State Machine for Audio Recording
 * 
 * Uses expo-audio (modern API, not deprecated expo-av)
 * 
 * Explicit states:
 * - IDLE: No recording in progress
 * - STARTING: Initializing recording (permissions, audio mode)
 * - RECORDING: Actively recording, can be canceled or locked
 * - LOCKED: Recording paused for review (user can send or cancel)
 * - CANCELING: Cancel animation playing (transitions to IDLE)
 * - UPLOADING: Audio is being uploaded to server
 * - SENT: Upload complete, message sent
 * - ERROR: Something went wrong (with retry capability)
 */

import {
    useAudioRecorder,
    AudioModule,
    RecordingPresets,
    setAudioModeAsync
} from 'expo-audio';
import * as Haptics from 'expo-haptics';

// State types
export type RecordingStatus =
    | 'IDLE'
    | 'STARTING'
    | 'RECORDING'
    | 'LOCKED'
    | 'CANCELING'
    | 'UPLOADING'
    | 'SENT'
    | 'ERROR';

export interface RecordingState {
    status: RecordingStatus;
    startTime: number | null;
    duration: number; // in seconds
    localUri: string | null;
    metering: number; // current decibel level (-160 to 0)
    meteringBuffer: number[]; // Last 20 metering values for waveform visualization
    error: string | null;
    messageId: string | null;
    // Gesture state tracking for UI feedback
    isCancelGestureActive: boolean;
    isLockGestureActive: boolean;
}

type Listener = (state: RecordingState) => void;

// Constants
const METERING_BUFFER_SIZE = 20;
const CANCEL_ANIMATION_DURATION = 400; // ms
const SENT_RESET_DELAY = 800; // ms
const MIN_RECORDING_DURATION = 1; // seconds
const DURATION_UPDATE_INTERVAL = 100; // ms

/**
 * Singleton store class for managing audio recording state
 * Note: This store manages STATE only. The actual recorder instance 
 * must be created and managed by a component using useAudioRecorder hook.
 */
class AudioRecordingStoreClass {
    private state: RecordingState = {
        status: 'IDLE',
        startTime: null,
        duration: 0,
        localUri: null,
        metering: -160,
        meteringBuffer: [],
        error: null,
        messageId: null,
        isCancelGestureActive: false,
        isLockGestureActive: false,
    };

    private listeners: Set<Listener> = new Set();
    private durationInterval: ReturnType<typeof setInterval> | null = null;

    // ============ Public API ============

    /**
     * Subscribe to state changes
     */
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        // Immediately call with current state
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Get current state (snapshot)
     */
    getState(): RecordingState {
        return { ...this.state };
    }

    /**
     * Check if currently in an active recording state (UI should be visible)
     */
    isActive(): boolean {
        return ['STARTING', 'RECORDING', 'LOCKED', 'CANCELING', 'UPLOADING'].includes(this.state.status);
    }

    /**
     * Check if recording can be started
     */
    canStart(): boolean {
        return ['IDLE', 'SENT', 'ERROR'].includes(this.state.status);
    }

    // ============ Gesture State Updates ============

    /**
     * Update cancel gesture state (called from UI during pan gesture)
     */
    setCancelGestureActive(active: boolean): void {
        if (this.state.isCancelGestureActive !== active) {
            this.updateState({ isCancelGestureActive: active });
            if (active) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
        }
    }

    /**
     * Update lock gesture state (called from UI during pan gesture)
     */
    setLockGestureActive(active: boolean): void {
        if (this.state.isLockGestureActive !== active) {
            this.updateState({ isLockGestureActive: active });
            if (active) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
        }
    }

    // ============ State Transitions ============

    /**
     * Transition to STARTING state
     * Called when recording is about to start
     */
    transitionToStarting(): void {
        if (!this.canStart()) {
            console.warn(`[AudioRecordingStore] Cannot start from state: ${this.state.status}`);
            return;
        }

        this.resetInternal();
        this.updateState({
            status: 'STARTING',
            startTime: null,
            duration: 0,
            localUri: null,
            error: null,
            messageId: null,
            meteringBuffer: [],
            isCancelGestureActive: false,
            isLockGestureActive: false,
        });
    }

    /**
     * Transition to RECORDING state
     * Called when recording has successfully started
     */
    transitionToRecording(): void {
        if (this.state.status !== 'STARTING') {
            console.warn(`[AudioRecordingStore] Cannot transition to RECORDING from: ${this.state.status}`);
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });

        this.updateState({
            status: 'RECORDING',
            startTime: Date.now(),
        });

        this.startDurationCounter();
    }

    /**
     * Lock recording (user slid up to lock)
     * Transition: RECORDING → LOCKED
     */
    lockRecording(): void {
        if (this.state.status !== 'RECORDING') {
            console.warn(`[AudioRecordingStore] Cannot lock from state: ${this.state.status}`);
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

        this.updateState({
            status: 'LOCKED',
            isLockGestureActive: false,
            isCancelGestureActive: false,
        });
    }

    /**
     * Cancel recording
     * Transition: RECORDING | LOCKED → CANCELING → IDLE
     */
    cancelRecording(): void {
        if (this.state.status !== 'RECORDING' && this.state.status !== 'LOCKED') {
            console.warn(`[AudioRecordingStore] Cannot cancel from state: ${this.state.status}`);
            return;
        }

        this.stopDurationCounter();

        // Transition to CANCELING for animation
        this.updateState({
            status: 'CANCELING',
            isCancelGestureActive: false,
            isLockGestureActive: false,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });

        // Auto transition to IDLE after animation delay
        setTimeout(() => {
            if (this.state.status === 'CANCELING') {
                this.reset();
            }
        }, CANCEL_ANIMATION_DURATION);
    }

    /**
     * Prepare upload with audio URI and duration
     * Transition: RECORDING | LOCKED → UPLOADING
     */
    prepareUpload(uri: string, durationMs: number): boolean {
        if (this.state.status !== 'RECORDING' && this.state.status !== 'LOCKED') {
            console.warn(`[AudioRecordingStore] Cannot prepare upload from state: ${this.state.status}`);
            return false;
        }

        this.stopDurationCounter();

        const durationSec = durationMs / 1000;

        // Check minimum duration
        if (durationSec < MIN_RECORDING_DURATION || !uri) {
            console.log('[AudioRecordingStore] Recording too short, canceling');
            this.cancelRecording();
            return false;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

        this.updateState({
            status: 'UPLOADING',
            localUri: uri,
            duration: durationSec,
            isCancelGestureActive: false,
            isLockGestureActive: false,
        });

        return true;
    }

    /**
     * Mark upload as complete
     * Transition: UPLOADING → SENT → IDLE
     */
    markSent(messageId: string): void {
        if (this.state.status !== 'UPLOADING') {
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });

        this.updateState({
            status: 'SENT',
            messageId,
        });

        // Auto-reset to IDLE after delay
        setTimeout(() => {
            if (this.state.status === 'SENT') {
                this.reset();
            }
        }, SENT_RESET_DELAY);
    }

    /**
     * Mark upload/recording as failed
     * Transition: Any active state → ERROR
     */
    setError(error: string): void {
        this.stopDurationCounter();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });

        this.updateState({
            status: 'ERROR',
            error,
            isCancelGestureActive: false,
            isLockGestureActive: false,
        });
    }

    /**
     * Update metering value (called periodically during recording)
     */
    updateMetering(metering: number): void {
        // Add to buffer, maintain max size
        const newBuffer = [...this.state.meteringBuffer, metering];
        if (newBuffer.length > METERING_BUFFER_SIZE) {
            newBuffer.shift();
        }
        this.updateState({
            metering,
            meteringBuffer: newBuffer
        });
    }

    /**
     * Retry upload after error
     * Transition: ERROR → UPLOADING (if localUri exists)
     */
    retry(): void {
        if (this.state.status !== 'ERROR') {
            return;
        }

        if (!this.state.localUri) {
            this.reset();
            return;
        }

        this.updateState({
            status: 'UPLOADING',
            error: null,
        });
    }

    /**
     * Reset to initial state
     * Transition: Any → IDLE
     */
    reset(): void {
        this.stopDurationCounter();
        this.resetInternal();
        this.notify();
    }

    // ============ Private Methods ============

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state));
    }

    private updateState(partial: Partial<RecordingState>): void {
        this.state = { ...this.state, ...partial };
        this.notify();
    }

    private startDurationCounter(): void {
        this.stopDurationCounter();
        this.durationInterval = setInterval(() => {
            if (this.state.status === 'RECORDING' || this.state.status === 'LOCKED') {
                const elapsed = this.state.startTime
                    ? (Date.now() - this.state.startTime) / 1000
                    : 0;
                this.updateState({ duration: elapsed });
            }
        }, DURATION_UPDATE_INTERVAL);
    }

    private stopDurationCounter(): void {
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = null;
        }
    }

    private resetInternal(): void {
        this.state = {
            status: 'IDLE',
            startTime: null,
            duration: 0,
            localUri: null,
            metering: -160,
            meteringBuffer: [],
            error: null,
            messageId: null,
            isCancelGestureActive: false,
            isLockGestureActive: false,
        };
    }
}

// Export singleton instance
export const AudioRecordingStore = new AudioRecordingStoreClass();
