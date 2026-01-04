import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const HOUR_HEIGHT = 60; // 1 hour = 60px height
// START_HOUR is dynamic now
const TIME_COLUMN_WIDTH = 0; // No dedicated column, hours float
const GRID_WIDTH = width; // Full width
const DAY_COLUMN_WIDTH = GRID_WIDTH / 7; // Exact division for 7 days

interface CalendarEvent {
    id: string;
    start: number;
    duration: number;
    color: string;
}

// Custom Palette
const PALETTE = {
    SAND: '#E8CFA6',
    GREEN: '#C5E8B7',
    RED: '#EA6C6C',
    PURPLE: '#A7A6E8',
    GREY: '#D9D9D9',
    TEAL: '#9AD2D2',
    LIGHT_GREY: '#EBEBEB',
    ORANGE: '#F4A460'
};

const MOCK_DATA: Record<number, CalendarEvent[]> = {
    0: [ // Mon
        { id: 'm1', start: 8, duration: 2, color: PALETTE.SAND },
        { id: 'm2', start: 11, duration: 1.5, color: PALETTE.SAND },
        { id: 'm3', start: 14, duration: 1, color: PALETTE.GREEN },
        { id: 'm4', start: 16, duration: 3, color: PALETTE.RED },
    ],
    1: [ // Tue
        { id: 't1', start: 9, duration: 2.5, color: PALETTE.SAND },
        { id: 't2', start: 12, duration: 1, color: PALETTE.SAND },
        { id: 't3', start: 14, duration: 1.5, color: PALETTE.GREEN },
        { id: 't4', start: 17, duration: 2, color: PALETTE.RED },
    ],
    2: [ // Wed
        { id: 'w1', start: 8.5, duration: 1.5, color: PALETTE.SAND },
        { id: 'w2', start: 11, duration: 2, color: PALETTE.SAND },
        { id: 'w3', start: 14.5, duration: 1.5, color: PALETTE.SAND },
        { id: 'w4', start: 17, duration: 4, color: PALETTE.RED },
    ],
    3: [ // Thu
        { id: 'th1', start: 9, duration: 1.5, color: PALETTE.SAND },
        { id: 'th2', start: 11.5, duration: 1.5, color: PALETTE.SAND },
        { id: 'th3', start: 14, duration: 3, color: PALETTE.GREEN },
    ],
    4: [ // Fri
        { id: 'f1', start: 8, duration: 1, color: PALETTE.GREY },
        { id: 'f2', start: 10, duration: 1.5, color: PALETTE.GREY },
        { id: 'f3', start: 13, duration: 4, color: PALETTE.RED },
        { id: 'f4', start: 18, duration: 2, color: PALETTE.TEAL },
    ],
    5: [ // Sat
        { id: 's1', start: 10, duration: 2, color: PALETTE.PURPLE },
        { id: 's2', start: 14, duration: 3, color: PALETTE.TEAL },
    ],
    6: [ // Sun
        { id: 'su1', start: 11, duration: 6, color: PALETTE.GREY },
    ]
};

const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

export function ProfileDaysHeader() {
    return (
        <View style={styles.headerContainer}>
            {DAYS.map((day) => (
                <Text key={day} style={styles.dayHeader}>{day}</Text>
            ))}
        </View>
    );
}

export function ProfileCalendarGrid() {
    const [now, setNow] = React.useState(new Date());

    const START_HOUR = 0;
    const END_HOUR = 24;
    const HOURS_COUNT = END_HOUR - START_HOUR;
    const HOURS = Array.from({ length: HOURS_COUNT + 1 }, (_, i) => START_HOUR + i);

    React.useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const currentDayIndex = (now.getDay() + 6) % 7;
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const shouldShowIndicator = currentHour >= START_HOUR && currentHour <= END_HOUR;

    return (
        <View style={styles.container}>
            {/* Grid Body */}
            <View style={[styles.bodyContainer, { height: HOURS_COUNT * HOUR_HEIGHT }]}>
                {/* Layer 1: Grid Lines (Background) */}
                {HOURS.map((hour, index) => (
                    <View key={`line-${hour}`} style={[styles.hourRow, { top: index * HOUR_HEIGHT, zIndex: 0 }]}>
                        <View style={styles.hourLine} />
                    </View>
                ))}

                {/* Layer 2: Events (Middle - "Pastilles") */}
                <View style={styles.eventsContainer}>
                    {Object.keys(MOCK_DATA).map((colIndexStr) => {
                        const colIndex = parseInt(colIndexStr);
                        const events = MOCK_DATA[colIndex];
                        return events.map((event) => {
                            // Filter out events that are entirely before the start hour
                            if (event.start + event.duration <= START_HOUR) return null;

                            // Adjust start for display if event partially overlaps or starts after
                            const effectiveStart = Math.max(event.start, START_HOUR);
                            // Adjust duration accordingly
                            const effectiveDuration = Math.min(event.duration, (event.start + event.duration) - effectiveStart);

                            const top = (effectiveStart - START_HOUR) * HOUR_HEIGHT;
                            const height = effectiveDuration * HOUR_HEIGHT;
                            const left = colIndex * DAY_COLUMN_WIDTH;

                            return (
                                <View
                                    key={event.id}
                                    style={[
                                        styles.eventBlock,
                                        {
                                            backgroundColor: event.color,
                                            left: left + 2,
                                            top: top + 2,
                                            width: DAY_COLUMN_WIDTH - 4,
                                            height: height - 4,
                                        }
                                    ]}
                                />
                            );
                        });
                    })}
                </View>

                {/* Layer 3: Grid Labels (Foreground) */}
                {HOURS.map((hour, index) => {
                    const isOverlapped = MOCK_DATA[0]?.some(e => e.start < hour && (e.start + e.duration) > hour);
                    return (
                        <View key={`label-${hour}`} style={[styles.hourRow, { top: index * HOUR_HEIGHT, zIndex: 20 }]}>
                            {/* Hour "Island" */}
                            <View style={styles.hourIsland}>
                                <Text style={[styles.hourText, { opacity: isOverlapped ? 0.5 : 1 }]}>{hour === 24 ? '00h' : `${hour}h`}</Text>
                            </View>
                        </View>
                    );
                })}

                {/* Layer 3: Current Time Indicator */}
                {shouldShowIndicator && (
                    <View
                        style={{
                            position: 'absolute',
                            left: currentDayIndex * DAY_COLUMN_WIDTH,
                            top: (currentHour - START_HOUR) * HOUR_HEIGHT,
                            width: DAY_COLUMN_WIDTH,
                            flexDirection: 'row',
                            alignItems: 'center',
                            zIndex: 100
                        }}
                    >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9F7A', marginLeft: -4 }} />
                        <View style={{ flex: 1, height: 2, backgroundColor: '#FF9F7A' }} />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginTop: 0,
    },
    headerContainer: {
        flexDirection: 'row',
        marginBottom: 0,
        paddingBottom: 6,
        paddingLeft: 0,
    },
    dayHeader: {
        width: DAY_COLUMN_WIDTH,
        textAlign: 'center',
        fontSize: 10,
        color: theme.colors.text.secondary,
        fontWeight: '600',
    },
    bodyContainer: {
        position: 'relative',
    },
    hourRow: {
        position: 'absolute',
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
        pointerEvents: 'none',
    },
    hourIsland: {
        position: 'absolute',
        left: 8,
        top: -8,
        zIndex: 20,
        backgroundColor: 'transparent',
    },
    hourText: {
        fontSize: 10,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        textShadowColor: 'rgba(255, 255, 255, 1)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
        opacity: 1,
    },
    hourLine: {
        position: 'absolute',
        left: TIME_COLUMN_WIDTH,
        right: 0,
        height: 1,
        backgroundColor: '#F0F0F0',
        zIndex: 0,
    },
    eventsContainer: {
        position: 'absolute',
        top: 0,
        left: TIME_COLUMN_WIDTH,
        right: 0,
        bottom: 0,
        zIndex: 10,
    },
    eventBlock: {
        position: 'absolute',
        borderRadius: 12,
        opacity: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    }
});

export default ProfileCalendarGrid;
