import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { theme } from "../theme";
import { Waveform } from "./Waveform";
import { api } from "../lib/api";

interface AudioMessageProps {
    uri: string;
    isMe: boolean;
    initialDuration?: number;
    messageId?: string; // Optional for healing
}

export function AudioMessage({ uri, isMe, initialDuration = 0, messageId }: AudioMessageProps) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(initialDuration);
    const [position, setPosition] = useState(0);

    // Sync duration if prop changes (e.g. from 0 to actual value after fetch)
    useEffect(() => {
        if (initialDuration > 0 && duration === 0) {
            setDuration(initialDuration);
        }
    }, [initialDuration]);

    const healDuration = async (foundDuration: number) => {
        if (initialDuration === 0 && messageId && foundDuration > 0) {
            try {
                // Heal the message in DB
                await api.patch(`/messages/${messageId}/duration`, { duration: foundDuration });
                console.log(`Healed duration for message ${messageId}: ${foundDuration}`);
            } catch (e) {
                console.error("Failed to heal duration", e);
            }
        }
    };

    // TODO: Construct full URL if relative
    const safeUri = uri || "";
    const fullUri = safeUri.startsWith("http") ? safeUri : `http://localhost:3000${safeUri}`;

    async function playSound() {
        if (!uri) return; // Guard against no URI
        if (!sound) {
            console.log("Loading Sound", fullUri);
            const { sound: newSound, status } = await Audio.Sound.createAsync(
                { uri: fullUri },
                { shouldPlay: true }
            );
            setSound(newSound);
            setIsPlaying(true);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    const d = status.durationMillis || 0;
                    if (d > 0 && duration === 0) {
                        setDuration(d);
                        healDuration(d);
                    }
                    setPosition(status.positionMillis);
                    if (status.didJustFinish) {
                        setIsPlaying(false);
                        newSound.setPositionAsync(0);
                    }
                }
            });
        } else {
            if (isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
            } else {
                await sound.playAsync();
                setIsPlaying(true);
            }
        }
    }

    const [levels] = useState(() => Array.from({ length: 30 }, () => Math.random())); // Fake static waveform
    const [speed, setSpeed] = useState(1.0);

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const toggleSpeed = async () => {
        const speeds = [1.0, 1.25, 1.5, 2.0];
        const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
        const nextSpeed = speeds[nextIndex];
        setSpeed(nextSpeed);
        if (sound) {
            await sound.setRateAsync(nextSpeed, true);
        }
    };

    useEffect(() => {
        return () => {
            sound?.unloadAsync();
        };
    }, [sound]);

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={playSound} style={styles.playButton}>
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
                    progress={duration > 0 ? position / duration : 0}
                    isPlaying={isPlaying}
                />
            </View>
            <View style={styles.metaContainer}>
                <Text style={[styles.duration, { color: isMe ? "rgba(255,255,255,0.8)" : theme.colors.text.secondary }]}>
                    {isPlaying || position > 0
                        ? `${formatTime(position)} / ${formatTime(duration)}`
                        : formatTime(duration > 0 ? duration : 0)
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
