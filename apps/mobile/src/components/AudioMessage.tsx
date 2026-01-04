import React, { useEffect, useCallback, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { theme } from "../theme";
import { Waveform } from "./Waveform";
import { api, API_URL } from "../services/api";

interface AudioMessageProps {
    uri: string;
    isMe: boolean;
    initialDuration?: number;
    messageId?: string; // Optional for healing
}

export function AudioMessage({ uri, isMe, initialDuration = 0, messageId }: AudioMessageProps) {
    const [speed, setSpeed] = useState(1.0);
    const [levels] = useState(() => Array.from({ length: 30 }, () => Math.random())); // Fake static waveform
    const [healedDuration, setHealedDuration] = useState(initialDuration);
    const hasHealed = useRef(false);

    // Use centralized API_URL for full URI construction
    const safeUri = uri || "";
    const fullUri = safeUri.startsWith("http") ? safeUri : `${API_URL}${safeUri}`;

    // Create player with the audio source
    const player = useAudioPlayer(fullUri ? { uri: fullUri } : null);
    const status = useAudioPlayerStatus(player);

    // Heal duration if we get it from player and it was initially 0
    const healDuration = useCallback(async (foundDuration: number) => {
        if (initialDuration === 0 && messageId && foundDuration > 0 && !hasHealed.current) {
            hasHealed.current = true;
            try {
                // Heal the message in DB
                await api.patch(`/messages/${messageId}/duration`, { duration: foundDuration });
                console.log(`Healed duration for message ${messageId}: ${foundDuration}`);
                setHealedDuration(foundDuration);
            } catch (e) {
                console.error("Failed to heal duration", e);
            }
        }
    }, [initialDuration, messageId]);

    // Get duration from player when loaded
    useEffect(() => {
        if (status.isLoaded && player.duration > 0 && healedDuration === 0) {
            const durationMs = player.duration * 1000; // expo-audio uses seconds
            setHealedDuration(durationMs);
            healDuration(durationMs);
        }
    }, [status.isLoaded, player.duration, healedDuration, healDuration]);

    // Handle play/pause toggle
    const togglePlayback = useCallback(() => {
        if (!player) return;

        if (status.playing) {
            player.pause();
        } else {
            // If at end, seek to beginning first
            if (player.duration > 0 && player.currentTime >= player.duration - 0.1) {
                player.seekTo(0);
            }
            player.play();
        }
    }, [player, status.playing]);

    // Handle speed change
    const toggleSpeed = useCallback(() => {
        const speeds = [1.0, 1.25, 1.5, 2.0];
        const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
        const nextSpeed = speeds[nextIndex];
        setSpeed(nextSpeed);
        if (player) {
            player.setPlaybackRate(nextSpeed);
        }
    }, [player, speed]);

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Calculate position and duration in ms for display
    const positionMs = (player?.currentTime || 0) * 1000;
    const durationMs = healedDuration > 0 ? healedDuration : (player?.duration || 0) * 1000;
    const progress = durationMs > 0 ? positionMs / durationMs : 0;
    const isPlaying = status.playing;

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={24}
                    color={isMe ? theme.colors.text.light : theme.colors.text.primary}
                />
            </TouchableOpacity>
            <View style={styles.progressContainer}>
                <Waveform
                    levels={levels}
                    color={isMe ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)"} // Inactive color
                    activeColor={isMe ? "#FFF" : theme.colors.text.primary} // Active color
                    progress={progress}
                    isPlaying={isPlaying}
                />
            </View>
            <View style={styles.metaContainer}>
                <Text style={[styles.duration, { color: isMe ? "rgba(255,255,255,0.8)" : theme.colors.text.secondary }]}>
                    {isPlaying || positionMs > 0
                        ? `${formatTime(positionMs)} / ${formatTime(durationMs)}`
                        : formatTime(durationMs > 0 ? durationMs : 0)
                    }
                </Text>
                <TouchableOpacity onPress={toggleSpeed} style={styles.speedButton}>
                    <Text style={[styles.speedText, { color: isMe ? "#FFF" : theme.colors.primary }]}>
                        {speed}x
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        width: 250, // Wider for controls
        padding: 4,
    },
    playButton: {
        marginRight: 8,
    },
    progressContainer: {
        flex: 1,
        height: 30,
        marginRight: 8,
        justifyContent: "center",
        overflow: 'hidden',
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    duration: {
        fontSize: 12,
        marginRight: 8,
        fontVariant: ['tabular-nums'],
    },
    speedButton: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    speedText: {
        fontSize: 10,
        fontWeight: '700',
    }
});
