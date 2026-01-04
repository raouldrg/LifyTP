/**
 * useAudioRecording - React hook for audio recording
 * 
 * Combines AudioRecordingStore (state) with expo-audio's useAudioRecorder (actual recording)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, useAudioRecorderState } from 'expo-audio';
import { AudioRecordingStore, RecordingState, RecordingStatus } from '../stores/AudioRecordingStore';

export interface UseAudioRecordingReturn extends RecordingState {
    // Computed states
    isActive: boolean;
    isRecording: boolean;
    isLocked: boolean;
    isUploading: boolean;
    isCanceling: boolean;
    isStarting: boolean;
    isSent: boolean;
    isError: boolean;
    canStart: boolean;

    // Formatted duration string (MM:SS)
    formattedDuration: string;

    // Normalized metering (0-1) for UI animations
    normalizedMetering: number;

    // Actions
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<{ uri: string; durationMs: number } | null>;
    cancelRecording: () => Promise<void>;
    lockRecording: () => void;
    markSent: (messageId: string) => void;
    setError: (error: string) => void;
    retry: () => void;
    reset: () => void;

    // Gesture state setters
    setCancelGestureActive: (active: boolean) => void;
    setLockGestureActive: (active: boolean) => void;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert dB metering to normalized 0-1 value
 * Metering typically ranges from -160 (silence) to 0 (max)
 * We map -60 to 0 to our usable range
 */
function normalizeMetering(metering: number): number {
    const MIN_DB = -60;
    const MAX_DB = 0;
    const clamped = Math.max(MIN_DB, Math.min(MAX_DB, metering));
    return (clamped - MIN_DB) / (MAX_DB - MIN_DB);
}

/**
 * Custom hook for audio recording using expo-audio
 */
export function useAudioRecording(): UseAudioRecordingReturn {
    const [state, setState] = useState<RecordingState>(AudioRecordingStore.getState());

    // Create a fresh audio recorder instance each time
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder);

    // Track if we've started recording to update metering
    const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Subscribe to store changes
    useEffect(() => {
        const unsubscribe = AudioRecordingStore.subscribe(setState);
        return unsubscribe;
    }, []);

    // Update metering from recorder state
    useEffect(() => {
        if (recorderState.isRecording) {
            // Start metering updates
            meteringIntervalRef.current = setInterval(() => {
                // expo-audio provides metering through the recorder state
                const metering = recorderState.metering ?? -60;
                AudioRecordingStore.updateMetering(metering);
            }, 100);
        } else {
            // Stop metering updates
            if (meteringIntervalRef.current) {
                clearInterval(meteringIntervalRef.current);
                meteringIntervalRef.current = null;
            }
        }

        return () => {
            if (meteringIntervalRef.current) {
                clearInterval(meteringIntervalRef.current);
            }
        };
    }, [recorderState.isRecording]);

    // Computed states
    const isActive = useMemo(() => {
        const s = state.status;
        return ['STARTING', 'RECORDING', 'LOCKED', 'CANCELING', 'UPLOADING'].includes(s);
    }, [state.status]);

    const isRecording = state.status === 'RECORDING';
    const isLocked = state.status === 'LOCKED';
    const isUploading = state.status === 'UPLOADING';
    const isCanceling = state.status === 'CANCELING';
    const isStarting = state.status === 'STARTING';
    const isSent = state.status === 'SENT';
    const isError = state.status === 'ERROR';
    const canStart = useMemo(() => {
        const s = state.status;
        return ['IDLE', 'SENT', 'ERROR'].includes(s);
    }, [state.status]);

    // Formatted values
    const formattedDuration = useMemo(() => formatDuration(state.duration), [state.duration]);
    const normalizedMetering = useMemo(() => normalizeMetering(state.metering), [state.metering]);

    // Start recording
    const startRecording = useCallback(async () => {
        if (!AudioRecordingStore.canStart()) {
            console.warn('[useAudioRecording] Cannot start, not in valid state');
            return;
        }

        // Transition store to STARTING
        AudioRecordingStore.transitionToStarting();

        try {
            // Request permissions
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                AudioRecordingStore.setError('Permission microphone refusée');
                return;
            }

            // Set audio mode for recording
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true
            });

            // Prepare and start recording
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();

            // Transition to RECORDING
            AudioRecordingStore.transitionToRecording();

        } catch (err) {
            console.error('[useAudioRecording] Recording start error:', err);
            AudioRecordingStore.setError(String(err));
        }
    }, [audioRecorder]);

    // Stop recording and get results
    const stopRecording = useCallback(async (): Promise<{ uri: string; durationMs: number } | null> => {
        if (!isRecording && !isLocked) {
            return null;
        }

        try {
            // Get duration before stopping
            const durationMs = (audioRecorder.currentTime || 0) * 1000;

            // Stop recording
            await audioRecorder.stop();
            const uri = audioRecorder.uri;

            // Check if recording is valid
            if (!uri || durationMs < 500) {
                AudioRecordingStore.cancelRecording();
                return null;
            }

            // Transition to uploading
            const success = AudioRecordingStore.prepareUpload(uri, durationMs);
            if (!success) {
                return null;
            }

            return { uri, durationMs };

        } catch (error) {
            console.error('[useAudioRecording] Stop error:', error);
            AudioRecordingStore.setError(String(error));
            return null;
        }
    }, [audioRecorder, isRecording, isLocked]);

    // Cancel recording
    const cancelRecording = useCallback(async () => {
        try {
            // Stop recorder if running
            if (recorderState.isRecording) {
                await audioRecorder.stop();
            }
        } catch (e) {
            // Ignore stop errors
        }

        AudioRecordingStore.cancelRecording();
    }, [audioRecorder, recorderState.isRecording]);

    // Lock recording
    const lockRecording = useCallback(() => {
        AudioRecordingStore.lockRecording();
    }, []);

    // Mark sent
    const markSent = useCallback((messageId: string) => {
        AudioRecordingStore.markSent(messageId);
    }, []);

    // Set error
    const setError = useCallback((error: string) => {
        AudioRecordingStore.setError(error);
    }, []);

    // Retry
    const retry = useCallback(() => {
        AudioRecordingStore.retry();
    }, []);

    // Reset
    const reset = useCallback(() => {
        AudioRecordingStore.reset();
    }, []);

    // Gesture state setters
    const setCancelGestureActive = useCallback(
        (active: boolean) => AudioRecordingStore.setCancelGestureActive(active),
        []
    );
    const setLockGestureActive = useCallback(
        (active: boolean) => AudioRecordingStore.setLockGestureActive(active),
        []
    );

    return {
        // State
        ...state,

        // Computed
        isActive,
        isRecording,
        isLocked,
        isUploading,
        isCanceling,
        isStarting,
        isSent,
        isError,
        canStart,
        formattedDuration,
        normalizedMetering,

        // Actions
        startRecording,
        stopRecording,
        cancelRecording,
        lockRecording,
        markSent,
        setError,
        retry,
        reset,
        setCancelGestureActive,
        setLockGestureActive,
    };
}

export default useAudioRecording;
