import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme';

interface WaveformProps {
    levels: number[]; // Array of values between 0 and 1
    isPlaying?: boolean;
    color?: string;
    activeColor?: string;
    progress?: number; // 0 to 1
    barWidth?: number;
    gap?: number;
}

export function Waveform({
    levels,
    isPlaying = false,
    color = "rgba(0,0,0,0.5)",
    activeColor = "#000",
    progress = 0,
    barWidth = 3,
    gap = 2
}: WaveformProps) {
    // If playing, we can animate, but for MVP let's just render the bars based on levels
    // Typically for "recording", levels change dynamically.
    // For "playback", levels are static but we might highlight them progressivly (not implemented yet).

    const activeIndex = Math.floor(progress * levels.length);

    return (
        <View style={styles.container}>
            {levels.map((level, index) => {
                const isActive = index < activeIndex;
                const barColor = isActive && activeColor ? activeColor : color;

                return (
                    <View
                        key={index}
                        style={[
                            styles.bar,
                            {
                                height: Math.max(4, level * 24), // Min height 4, Max height 24
                                backgroundColor: barColor,
                                width: barWidth,
                                marginRight: gap,
                                opacity: isPlaying ? 0.8 : 0.5
                            }
                        ]}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 30, // Fixed container height
    },
    bar: {
        borderRadius: 2,
    }
});
