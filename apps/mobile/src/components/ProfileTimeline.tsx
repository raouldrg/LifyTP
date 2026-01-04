import React, { useEffect, useState, useImperativeHandle, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Pressable, GestureResponderEvent, Text as NativeText } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { theme } from '../theme';
import { CalendarEvent, EventTheme } from '../types/events';
import { THEME_STYLES, DEFAULT_THEMES, resolveEventColor, getThemeStyles } from '../constants/eventThemes';
import { hourToY, yToHour, getTotalHeight, getHeightBetweenHours } from '../utils/calendarTimeMapping';

const { width } = Dimensions.get('window');
// Helper constants
const START_HOUR = 0;
const END_HOUR = 24;
// Include 24 in the array (0 to 24 inclusive = 25 items)
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const PADDING_HORIZONTAL = 16;
const TIMELINE_WIDTH = width - (PADDING_HORIZONTAL * 2);
const DAY_COLUMN_WIDTH = TIMELINE_WIDTH / 7;

// Format hour helper
const formatHour = (hour: number) => {
    if (hour === 24) return "24h";
    return `${String(hour).padStart(2, '0')}h`;
};

// Date Helpers
const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    if (typeof timeStr === 'number') return timeStr;
    if (timeStr.includes('T')) {
        const d = new Date(timeStr);
        return d.getHours() + (d.getMinutes() / 60);
    }
    if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':').map(Number);
        return h + (m / 60);
    }
    return 0;
};

interface ProfileTimelineProps {
    events?: CalendarEvent[];
    onScroll?: any;
    onEventPress?: (event: CalendarEvent) => void;
    onEmptySlotPress?: (dayIndex: number, startAt: string) => void;

    // External Data
    weekStart: Date;
    weekOffset: number;
    onChangeWeek: (direction: number) => void;

    // Layout
    contentTopPadding: any; // SharedValue<number> | number
    onReady?: (initialOffset: number) => void;
}

// NowLine Component
const NowLine = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const currentHourFloat = now.getHours() + now.getMinutes() / 60;
    const currentDayIndex = (now.getDay() + 6) % 7;
    const leftPos = PADDING_HORIZONTAL + (currentDayIndex * DAY_COLUMN_WIDTH);

    return (
        <View style={[
            styles.nowLineContainer,
            { top: hourToY(currentHourFloat) }
        ]}>
            <View style={[styles.nowLine, { left: leftPos, width: DAY_COLUMN_WIDTH }]} />
            <View style={[styles.nowDot, { left: leftPos }]} />
        </View>
    );
};

interface LayoutInfo {
    height: number;
    y: number;
}


// Internal Component
function ProfileTimelineInner({
    events = [],
    onScroll,
    onEventPress,
    onEmptySlotPress,
    weekStart,
    weekOffset,
    onChangeWeek,
    contentTopPadding,
    onReady
}: ProfileTimelineProps, ref: any) {
    const internalRef = useAnimatedRef<Animated.ScrollView>();
    const translateX = useSharedValue(0);

    // Resolve padding style
    // Spacer Animation
    // Spacer Animation
    const rSpacerStyle = useAnimatedStyle(() => {
        // Safe read: if object with .value, treat as shared value
        // We assume it returns a number.
        // If contentTopPadding is a plain number, use it.
        // If it's a SharedValue, access .value.

        // Note: The specific check 'value' in ... works, but for safety lets cast
        let heightVal = 380; // Default expanded

        if (typeof contentTopPadding === 'number') {
            heightVal = contentTopPadding;
        } else if (contentTopPadding && typeof contentTopPadding === 'object') {
            // Force Read .value for Reanimated
            heightVal = (contentTopPadding as any).value;
        }

        return { height: heightVal };
    }, [contentTopPadding]);

    // SWIPE GESTURE
    const panGesture = Gesture.Pan()
        .activeOffsetX([-30, 30]) // Require explicit horizontal movement
        .failOffsetY([-10, 10]) // Fail immediately if vertical movement detected (prioritize scroll)
        .onUpdate((e) => {
            'worklet';
            translateX.value = e.translationX;
        })
        .onEnd((e) => {
            'worklet';
            const SWIPE_THRESHOLD = 80;
            if (e.translationX < -SWIPE_THRESHOLD) {
                // Swipe Left -> Next Week
                runOnJS(onChangeWeek)(1);
            } else if (e.translationX > SWIPE_THRESHOLD) {
                // Swipe Right -> Prev Week
                runOnJS(onChangeWeek)(-1);
            }
            // Always snap back visually
            translateX.value = withTiming(0);
        });

    const rSwipeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    const [layoutReady, setLayoutReady] = useState(false);
    const [detectedHeight, setDetectedHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const [debugStats, setDebugStats] = useState<any>({});

    // Guard against centering while user interacts
    const isInteracting = useRef(false);
    // Guard against repeated centering (Jump fix)
    const centeredOnceRef = useRef(false);

    // Exposed Method to Center Now
    const ensureCenteredNow = useCallback((reason: string) => {
        // Requirements
        if (!layoutReady || detectedHeight <= 0 || contentHeight <= 0) {
            console.log(`[TIMELINE] ensureCenteredNow skipped (${reason}): layout/content not ready. H:${detectedHeight} C:${contentHeight}`);
            return;
        }

        // 1. Guard: Don't snap if user is scrolling
        if (isInteracting.current && reason !== "boot_layout_ready" && reason !== "focus_effect") {
            console.log(`[TIMELINE] ensureCenteredNow skipped (${reason}): User is interacting.`);
            return;
        }

        // 2. Guard: Don't snap repeatedly on boot if already done
        // But ALWAYS allow focus_effect to recenter (navigating back to screen)
        if (reason === "boot_layout_ready" && centeredOnceRef.current) {
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();
        const timeInHours = currentHour + currentMinutes / 60;

        // HEADER_EXPANDED_HEIGHT = 380 (spacer at boot)
        const HEADER_EXPANDED = 380;
        const BOTTOM_TAB_BAR_HEIGHT = 85;
        const SAFE_AREA_BOTTOM = 34; // iPhone notch approx

        // Calculate yNow (position of now line in content)
        // Uses hourToY for progressive night-time compression
        const yNow = HEADER_EXPANDED + hourToY(timeInHours);

        // Calculate visible calendar viewport (where the calendar is actually visible)
        // = screen height - header (deployed) - bottom tab bar - safe area
        const calendarVisibleViewport = detectedHeight - HEADER_EXPANDED - BOTTOM_TAB_BAR_HEIGHT - SAFE_AREA_BOTTOM;

        // Position now bar at MIDDLE OF BOTTOM HALF of visible calendar area
        // Bottom half = from 50% to 100% of viewport
        // Middle of bottom half = 75% down from top = 25% up from bottom
        // targetY = yNow should appear at (calendarVisibleViewport * 0.75)
        // Then subtract 300px as requested by user
        const target = yNow - (calendarVisibleViewport * 0.75) - 300;

        // Clamp
        const maxScroll = Math.max(0, contentHeight - detectedHeight);
        const finalTarget = Math.max(0, Math.min(target, maxScroll));

        // Debug Data
        const stats = {
            reason,
            viewportHeight: detectedHeight,
            yNow,
            calendarVisibleViewport,
            finalTarget,
            maxScroll
        };
        setDebugStats(stats);
        // console.log("[TIMELINE] ensureCenteredNow running", JSON.stringify(stats));

        // Sync parent for animation (initialNowOffset)
        if (onReady) onReady(finalTarget);

        // Scroll
        internalRef.current?.scrollTo({ y: finalTarget, animated: false });
        centeredOnceRef.current = true;

    }, [layoutReady, detectedHeight, contentHeight, contentTopPadding, onReady]);

    // Expose scrollTo to parent via Ref
    useImperativeHandle(ref, () => ({
        scrollTo: (y: number, animated: boolean) => {
            if (internalRef.current) {
                internalRef.current.scrollTo({ y, animated });
            }
        },
        ensureCenteredNow,
        getDebugStats: () => debugStats
    }));

    // Calculate "Now" Offset (Validation only, unused for primary logic now)
    const calculateInitialOffset = useCallback((viewportHeight: number) => {
        return 0;
    }, []);

    // Effect to trigger onReady ONLY when layout is known
    // Boot Sequence / Layout Change
    useEffect(() => {
        if (layoutReady && detectedHeight > 0 && contentHeight > 0) {
            // Debounce slightly to ensure one run
            setTimeout(() => ensureCenteredNow("boot_layout_ready"), 50);
        }
    }, [layoutReady, detectedHeight, contentHeight, ensureCenteredNow]);

    const handleLayout = (e: any) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && h !== detectedHeight) {
            setDetectedHeight(h);
            setLayoutReady(true);
        }
    };

    // Process Events
    const processedEvents = React.useMemo(() => {
        const segments: any[] = [];
        if (!events) return segments;

        events.forEach(event => {
            const isISO = event.startAt && typeof event.startAt === 'string' && event.startAt.includes('T');
            if (!isISO) {
                if (weekOffset === 0) {
                    const start = parseTime(event.startAt);
                    const end = parseTime(event.endAt);
                    const dayIndex = (event as any).dayIndex;
                    if (end > start) {
                        segments.push({
                            ...event,
                            processedStart: start,
                            processedEnd: end,
                            processedDayIndex: dayIndex
                        });
                    }
                }
                return;
            }

            const startDate = new Date(event.startAt);
            const endDate = new Date(event.endAt);
            let loopDate = new Date(startDate);
            loopDate.setHours(0, 0, 0, 0);
            const lastDay = new Date(endDate);
            lastDay.setHours(0, 0, 0, 0);

            let iterations = 0;
            while (loopDate <= lastDay && iterations < 365) {
                iterations++;
                let segStartHour = 0;
                let segEndHour = 24;

                if (loopDate.getTime() === new Date(startDate).setHours(0, 0, 0, 0)) {
                    segStartHour = startDate.getHours() + (startDate.getMinutes() / 60);
                }
                if (loopDate.getTime() === lastDay.getTime()) {
                    segEndHour = endDate.getHours() + (endDate.getMinutes() / 60);
                }

                const diffTime = loopDate.getTime() - weekStart.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays <= 6) {
                    if (segEndHour > segStartHour) {
                        segments.push({
                            ...event,
                            _segmentId: `${event.id}_seg_${diffDays}`,
                            processedStart: segStartHour,
                            processedEnd: segEndHour,
                            processedDayIndex: diffDays
                        });
                    }
                }
                loopDate.setDate(loopDate.getDate() + 1);
            }
        });
        return segments;
    }, [events, weekStart, weekOffset]);

    const handleGridPress = (e: GestureResponderEvent) => {
        if (!onEmptySlotPress) return;
        const { locationX, locationY } = e.nativeEvent;
        let dayIndex = Math.floor((locationX - PADDING_HORIZONTAL) / DAY_COLUMN_WIDTH);
        dayIndex = Math.max(0, Math.min(6, dayIndex));

        const targetDate = new Date(weekStart);
        targetDate.setDate(targetDate.getDate() + dayIndex);

        // Use yToHour for accurate tap detection with compression
        const rawHour = yToHour(locationY);
        const roundedHour = Math.round(rawHour * 4) / 4;
        const h = Math.floor(roundedHour);
        const m = Math.round((roundedHour - h) * 60);

        const d = new Date(targetDate);
        d.setHours(h, m, 0, 0);
        onEmptySlotPress(dayIndex, d.toISOString());
    };

    return (
        <View style={styles.container}>
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.container, rSwipeStyle]}>
                    <Animated.ScrollView
                        ref={internalRef}
                        style={styles.scrollView}
                        contentContainerStyle={{ paddingBottom: 60 }}
                        showsVerticalScrollIndicator={false}

                        // Performance & Feel
                        removeClippedSubviews={true}
                        decelerationRate="normal"
                        overScrollMode="always"

                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        onLayout={handleLayout}
                        onContentSizeChange={(w, h) => setContentHeight(h)}
                        onScrollBeginDrag={() => { isInteracting.current = true; }}
                        onMomentumScrollEnd={() => { isInteracting.current = false; }}
                        onScrollEndDrag={() => {
                            // If no momentum, end immediately
                            setTimeout(() => { isInteracting.current = false; }, 100);
                        }}
                    >
                        {/* Spacer for Animated Header Offset */}
                        <Animated.View style={rSpacerStyle} />

                        <View style={styles.gridContainer}>
                            <Pressable
                                style={[StyleSheet.absoluteFill, { zIndex: 2 }]}
                                onPress={handleGridPress}
                            />
                            {HOURS.map((hour) => (
                                <View key={`line-${hour}`} style={[styles.gridLineRow, { top: hourToY(hour) }]}>
                                    <View style={[styles.gridLine, { left: PADDING_HORIZONTAL, width: TIMELINE_WIDTH }]} />
                                </View>
                            ))}

                            {processedEvents.map((event: any) => {
                                const start = event.processedStart;
                                const end = event.processedEnd;
                                const evtDayIndex = event.processedDayIndex;
                                const duration = end - start;
                                if (duration <= 0) return null;

                                // New color system: prioritize colorHex, fallback to theme lookup
                                const eventColor = resolveEventColor(event, DEFAULT_THEMES);
                                const pillBgColor = eventColor + '38'; // ~22% opacity
                                const titleColor = eventColor;
                                const descColor = '#555555'; // Dark gray for description (never white)
                                const isSmall = duration < 0.75;

                                return (
                                    <TouchableOpacity
                                        key={event._segmentId || event.id}
                                        onPress={() => onEventPress?.(event)}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.eventPill,
                                            {
                                                // Use hourToY for compressed positioning
                                                top: hourToY(start - START_HOUR) + 2,
                                                // Use getHeightBetweenHours for accurate height with compression
                                                height: getHeightBetweenHours(start, end) - 4,
                                                left: PADDING_HORIZONTAL + (evtDayIndex * DAY_COLUMN_WIDTH) + 2,
                                                width: DAY_COLUMN_WIDTH - 4,
                                                backgroundColor: pillBgColor,
                                                borderColor: 'rgba(0,0,0,0.02)',
                                            }
                                        ]}
                                    >
                                        <View style={styles.eventContent}>
                                            <NativeText
                                                style={[styles.eventTitle, { color: titleColor }]}
                                                numberOfLines={isSmall ? 1 : 2}
                                            >
                                                {event.title}
                                            </NativeText>
                                            {!isSmall && event.description ? (
                                                <NativeText
                                                    style={[styles.eventDescription, { color: descColor }]}
                                                    numberOfLines={2}
                                                >
                                                    {event.description}
                                                </NativeText>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}

                            {HOURS.map((hour) => (
                                <View key={`label-${hour}`} style={[styles.labelOverlay, { top: hourToY(hour) }]}>
                                    <NativeText style={styles.hourText}>
                                        {formatHour(hour)}
                                    </NativeText>
                                </View>
                            ))}
                            <NowLine />
                        </View>
                    </Animated.ScrollView>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

export const ProfileTimeline = React.forwardRef(ProfileTimelineInner);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollView: { flex: 1 },
    gridContainer: { position: 'relative', height: getTotalHeight() + 20 },
    gridLineRow: { position: 'absolute', width: '100%', left: 0, height: 1, justifyContent: 'center', zIndex: 1 },
    gridLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.04)' },
    labelOverlay: { position: 'absolute', left: 10, top: -10, zIndex: 50, elevation: 10 },
    hourText: { fontSize: 13, color: 'rgba(60,60,60,0.5)', fontWeight: '600' },
    nowLineContainer: { position: 'absolute', width: '100%', zIndex: 100, pointerEvents: 'none' },
    nowLine: { height: 2, backgroundColor: theme.colors.accent || '#FFA07A' },
    nowDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent || '#FFA07A', top: -3, borderWidth: 1.5, borderColor: '#FFF' },
    eventPill: { position: 'absolute', borderRadius: 8, zIndex: 10, overflow: 'hidden', borderWidth: 1, paddingLeft: 6, paddingTop: 4, paddingRight: 4, justifyContent: 'flex-start' },
    eventContent: { flex: 1 },
    eventTitle: { fontSize: 11, fontWeight: '700', marginBottom: 2, lineHeight: 13 },
    eventDescription: { fontSize: 10, fontWeight: '500', marginTop: 0, lineHeight: 12 },
});
