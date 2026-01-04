import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { theme } from '../theme';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

interface DaysBarProps {
    weekDays: Array<{
        name: string;
        date: Date;
        isToday: boolean;
    }>;
    weekOffset: number;
    slideDirection: 'left' | 'right';
    monthIndicator: string | null;
    onDoubleTap: () => void;
}

const TIMELINE_WIDTH = 0; // Will be calc below but generally we rely on flex
// We need same constants to match grid
// Actually standard layout is fine.

export function DaysBar({ weekDays, weekOffset, slideDirection, monthIndicator, onDoubleTap }: DaysBarProps) {
    // Use runOnJS(true) since onDoubleTap is a JS callback that accesses React state
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .runOnJS(true)
        .onEnd(onDoubleTap);

    return (
        <GestureDetector gesture={doubleTap}>
            <View style={styles.headerRowBase}>
                <View style={styles.headerRowContent}>
                    <Animated.View
                        key={weekOffset}
                        entering={slideDirection === 'right' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
                        exiting={slideDirection === 'right' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
                        style={styles.daysRow}
                    >
                        {weekDays.map((d, index) => {
                            const isActive = d.isToday;
                            return (
                                <View key={index} style={styles.dayColHeader}>
                                    <Text style={[
                                        styles.dayText,
                                        isActive && styles.activeDayText
                                    ]}>{d.name}</Text>
                                    <Text style={[
                                        styles.dayNumText,
                                        isActive && styles.activeDayText
                                    ]}>{d.date.getDate()}</Text>
                                    {isActive && <View style={styles.activeUnderline} />}
                                </View>
                            );
                        })}
                    </Animated.View>
                </View>

                {/* Month Indicator Overlay */}
                {monthIndicator && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(300)}
                        style={styles.monthOverlay}
                    >
                        <Text style={styles.monthOverlayText}>{monthIndicator}</Text>
                    </Animated.View>
                )}
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    headerRowBase: {
        height: 50,
        backgroundColor: '#FFFFFF',
        zIndex: 10,
        position: 'relative',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    daysRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    dayColHeader: {
        flex: 1, // Distribute evenly
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
    },
    dayText: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '400',
        textTransform: 'capitalize'
    },
    activeDayText: {
        color: '#000',
        fontWeight: '600',
    },
    dayNumText: {
        fontSize: 14,
        fontWeight: '400',
        color: '#444',
        marginTop: 2,
    },
    activeUnderline: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.accent || '#FFA07A',
        marginTop: 4,
    },
    monthOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    monthOverlayText: {
        fontSize: 16,
        color: '#000',
        fontWeight: '600',
    }
});
