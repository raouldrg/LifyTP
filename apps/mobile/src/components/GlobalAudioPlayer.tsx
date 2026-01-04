/**
 * GlobalAudioPlayer - Invisible component that handles actual audio playback
 * 
 * This component stays mounted and uses expo-audio's useAudioPlayer hook.
 * It listens to AudioPlayerStore for play/pause requests and updates the store with progress.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { AudioPlayerStore } from '../stores/AudioPlayerStore';

export function GlobalAudioPlayer() {
    const storeState = useRef(AudioPlayerStore.getState());
    const [currentUri, setCurrentUri] = React.useState<string | null>(null);

    // Initialize audio mode for playback when component mounts
    useEffect(() => {
        setAudioModeAsync({
            playsInSilentMode: true,  // Important for iOS - play even in silent mode
            shouldRouteThroughEarpiece: false,
        }).catch(console.error);
    }, []);

    // Create player - null initially, will be set when we have a URI
    const player = useAudioPlayer(currentUri ? { uri: currentUri } : null);
    const status = useAudioPlayerStatus(player);

    // Subscribe to store changes
    useEffect(() => {
        const unsubscribe = AudioPlayerStore.subscribe((state) => {
            storeState.current = state;

            // If URI changed, update our player source
            if (state.currentUri !== currentUri) {
                setCurrentUri(state.currentUri);
            }
        });
        return unsubscribe;
    }, [currentUri]);

    // Handle play/pause based on store state
    useEffect(() => {
        if (!player) return;

        const state = storeState.current;

        if (state.isPlaying && !status.playing) {
            // Store wants to play but player is paused
            if (status.isLoaded) {
                // If at end, seek to beginning
                if (player.duration > 0 && player.currentTime >= player.duration - 0.1) {
                    player.seekTo(0);
                }
                player.play();
            }
        } else if (!state.isPlaying && status.playing) {
            // Store wants to pause but player is playing
            player.pause();
        }

        // Apply speed changes
        if (player && state.speed !== player.playbackRate) {
            player.setPlaybackRate(state.speed);
        }
    }, [player, status.playing, status.isLoaded]);

    // Note: Progress updates are handled internally by AudioPlayerStore via its polling mechanism
    // The store uses startProgressUpdates() which polls the player every 100ms

    // This component renders nothing - it just manages audio playback
    return null;
}
