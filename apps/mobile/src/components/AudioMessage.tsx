import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { theme } from "../theme";

interface AudioMessageProps {
    uri: string;
    isMe: boolean;
}

export function AudioMessage({ uri, isMe }: AudioMessageProps) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    // TODO: Construct full URL if relative
    const fullUri = uri.startsWith("http") ? uri : `http://localhost:3000${uri}`;

    async function playSound() {
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
                    setDuration(status.durationMillis || 0);
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
                {/* Visual placeholder for waveform: just a line for now */}
                <View style={[styles.progressBar, { backgroundColor: isMe ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.1)" }]} />
            </View>
            <Text style={[styles.duration, { color: isMe ? "rgba(255,255,255,0.8)" : theme.colors.text.secondary }]}>
                {isPlaying ? `${Math.floor(position / 1000)}s` : "Audio"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        width: 150,
        padding: 4,
    },
    playButton: {
        marginRight: 10,
    },
    progressContainer: {
        flex: 1,
        height: 2,
        marginRight: 10,
        justifyContent: "center",
    },
    progressBar: {
        height: 2,
        width: "100%",
    },
    duration: {
        fontSize: 12,
    }
});
