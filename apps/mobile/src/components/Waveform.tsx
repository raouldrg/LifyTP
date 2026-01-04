/**
 * Waveform - Animated audio waveform visualization
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withDelay,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';

interface WaveformProps {
    levels: number[]; // Array of values between 0 and 1
    isPlaying?: boolean;
    color?: string;
    activeColor?: string;
    progress?: number; // 0 to 1
    barWidth?: number;
    gap?: number;
}

// Animated bar component
const AnimatedBar = React.memo(({
    baseHeight,
    index,
    isPlaying,
    isActive,
    color,
    activeColor,
    barWidth,
    gap,
}: {
    baseHeight: number;
    index: number;
    isPlaying: boolean;
    isActive: boolean;
    color: string;
    activeColor: string;
    barWidth: number;
    gap: number;
}) => {
    const scale = useSharedValue(1);

    useEffect(() => {
        if (isPlaying && isActive) {
            // Create a bouncy animation for active playing bars
            const delay = index * 50; // Stagger the animation
            scale.value = withDelay(
                delay % 300,
                withRepeat(
                    withSequence(
                        withTiming(1.3, { duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
                        withTiming(0.8, { duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
                        withTiming(1.1, { duration: 150, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
                        withTiming(1, { duration: 150, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
                    ),
                    -1, // Infinite repeat
                    false
                )
            );
        } else {
            cancelAnimation(scale);
            scale.value = withTiming(1, { duration: 150 });
        }

        return () => {
            cancelAnimation(scale);
        };
    }, [isPlaying, isActive, index]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scaleY: scale.value }],
    }));

    return (
        <Animated.View
            style={[
                styles.bar,
                {
                    height: baseHeight,
                    backgroundColor: isActive ? activeColor : color,
                    width: barWidth,
                    marginRight: gap,
                    opacity: isPlaying ? 1 : 0.6,
                },
                animatedStyle,
            ]}
        />
    );
});

export function Waveform({
    levels,
    isPlaying = false,
    color = "rgba(0,0,0,0.3)",
    activeColor = "#1A1A1A",
    progress = 0,
    barWidth = 3,
    gap = 2
}: WaveformProps) {
    const activeIndex = Math.floor(progress * levels.length);

    return (
        <View style={styles.container}>
            {levels.map((level, index) => {
                const isActive = index < activeIndex;
                const baseHeight = Math.max(4, level * 24);

                return (
                    <AnimatedBar
                        key={index}
                        baseHeight={baseHeight}
                        index={index}
                        isPlaying={isPlaying}
                        isActive={isActive}
                        color={color}
                        activeColor={activeColor}
                        barWidth={barWidth}
                        gap={gap}
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
        height: 30,
    },
    bar: {
        borderRadius: 2,
    }
});
