import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    interpolate,
    Easing,
    Extrapolate,
    useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { CalendarEvent } from '../types/events';
import MediaStackView from './MediaStackView';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface EventDetailViewProps {
    visible: boolean;
    event: CalendarEvent | null;
    onClose: () => void;
    currentUserId?: string;
    creatorUser?: any; // User object with username/displayName
}

export default function EventDetailView({ visible, event, onClose, currentUserId, creatorUser }: EventDetailViewProps) {
    const insets = useSafeAreaInsets();

    // Animation state
    const [shouldRender, setShouldRender] = useState(false);
    const animationProgress = useSharedValue(0);
    const scrollY = useSharedValue(0);

    // Handle visibility with smooth animations
    useEffect(() => {
        if (visible && event) {
            setShouldRender(true);
            animationProgress.value = withTiming(1, {
                duration: 350,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1), // iOS ease-out
            });
        } else {
            animationProgress.value = withTiming(0, {
                duration: 250,
                easing: Easing.in(Easing.cubic),
            }, (finished) => {
                if (finished) {
                    runOnJS(setShouldRender)(false);
                }
            });
        }
    }, [visible, event]);

    // Formatted data
    const formattedDate = useMemo(() => {
        if (!event) return '';
        const start = new Date(event.startAt);
        return start.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'long'
        });
    }, [event]);

    const formattedTime = useMemo(() => {
        if (!event) return '';
        const start = new Date(event.startAt);
        const h = String(start.getHours()).padStart(2, '0');
        const m = String(start.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }, [event]);

    const duration = useMemo(() => {
        if (!event) return '';
        const start = new Date(event.startAt);
        const end = new Date(event.endAt);
        const diff = end.getTime() - start.getTime();
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);

        if (hours > 0 && mins > 0) return `${hours}h${mins}`;
        if (hours > 0) return `${hours}h`;
        return `${mins}min`;
    }, [event]);

    // Handle close
    const handleClose = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
    }, [onClose]);

    // Scroll handler
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollY.value = e.contentOffset.y;
        },
    });

    // Animated styles
    const overlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            animationProgress.value,
            [0, 1],
            [0, 1]
        ),
    }));

    const containerStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: interpolate(
                    animationProgress.value,
                    [0, 1],
                    [SCREEN_HEIGHT, 0]
                ),
            },
            {
                scale: interpolate(
                    animationProgress.value,
                    [0, 1],
                    [0.95, 1]
                ),
            },
        ],
        opacity: interpolate(
            animationProgress.value,
            [0, 1],
            [0, 1]
        ),
    }));

    // Hero section animations (subtle fade on scroll)
    const heroStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            scrollY.value,
            [0, 100],
            [1, 0.92],
            Extrapolate.CLAMP
        ),
    }));

    // Description fade in on scroll
    const descriptionStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            scrollY.value,
            [0, 50],
            [0.7, 1],
            Extrapolate.CLAMP
        ),
        transform: [{
            translateY: interpolate(
                scrollY.value,
                [0, 50],
                [10, 0],
                Extrapolate.CLAMP
            ),
        }],
    }));

    if (!shouldRender || !event) return null;

    const themeColor = event.colorHex || '#FF9F6E';

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Animated Overlay */}
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={[styles.overlay, overlayStyle]}>
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                </Animated.View>
            </TouchableWithoutFeedback>

            {/* Main Container */}
            <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
                <View style={[styles.content, { paddingTop: insets.top }]}>
                    {/* Close Button - Fixed Top Right */}
                    <TouchableOpacity
                        style={[styles.closeButton, { top: insets.top + 16 }]}
                        onPress={handleClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View style={styles.closeButtonInner}>
                            <Ionicons name="close" size={24} color="#666" />
                        </View>
                    </TouchableOpacity>

                    {/* Scrollable Content */}
                    <Animated.ScrollView
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        bounces={true}
                    >
                        {/* Hero Section */}
                        <Animated.View style={[styles.heroSection, heroStyle]}>
                            {/* Title */}
                            <Text style={styles.title}>{event.title}</Text>

                            {/* Description RIGHT AFTER TITLE */}
                            {event.description && (
                                <Text style={styles.description}>{event.description}</Text>
                            )}

                            {/* Context Line */}
                            <View style={styles.contextRow}>
                                <Ionicons name="calendar-outline" size={16} color="#666" />
                                <Text style={styles.contextText}>{formattedDate}</Text>
                                <Text style={styles.contextSeparator}>·</Text>
                                <Ionicons name="time-outline" size={16} color="#666" />
                                <Text style={styles.contextText}>{formattedTime}</Text>
                                <Text style={styles.contextSeparator}>·</Text>
                                <Text style={styles.contextText}>{duration}</Text>
                            </View>

                            {/* Theme Tag */}
                            {event.theme && (
                                <View style={[styles.themeTag, { backgroundColor: themeColor + '20', borderColor: themeColor }]}>
                                    <Text style={[styles.themeTagText, { color: themeColor }]}>
                                        {event.theme}
                                    </Text>
                                </View>
                            )}
                        </Animated.View>

                        {/* Media Stack */}
                        {event.media && event.media.length > 0 && (
                            <MediaStackView media={event.media} />
                        )}

                        {/* Details Section */}
                        <View style={styles.detailsSection}>
                            {/* Creator */}
                            <View style={styles.metaRow}>
                                <Ionicons name="person-outline" size={18} color="#999" />
                                <Text style={styles.metaLabel}>Créateur</Text>
                                <Text style={styles.metaValue}>
                                    {creatorUser?.displayName || creatorUser?.username || 'Utilisateur'}
                                </Text>
                            </View>

                            {/* Location if present */}
                            {event.location && (
                                <View style={styles.metaRow}>
                                    <Ionicons name="location-outline" size={18} color="#999" />
                                    <Text style={styles.metaLabel}>Lieu</Text>
                                    <Text style={styles.metaValue}>{event.location}</Text>
                                </View>
                            )}

                            {/* Visibility */}
                            {event.visibility && (
                                <View style={styles.metaRow}>
                                    <Ionicons
                                        name={
                                            event.visibility === 'PRIVATE' ? 'lock-closed-outline' :
                                                event.visibility === 'FRIENDS' ? 'people-outline' :
                                                    'globe-outline'
                                        }
                                        size={18}
                                        color="#999"
                                    />
                                    <Text style={styles.metaLabel}>Visibilité</Text>
                                    <Text style={styles.metaValue}>
                                        {event.visibility === 'PRIVATE' ? 'Privé' :
                                            event.visibility === 'FRIENDS' ? 'Amis' :
                                                'Public'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Bottom Spacing */}
                        <View style={{ height: 60 }} />
                    </Animated.ScrollView>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 100,
    },
    closeButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 60, // Space for close button
    },

    // Hero Section
    heroSection: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: '#1A1A1A',
        lineHeight: 36,
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    contextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    contextText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666',
    },
    contextSeparator: {
        fontSize: 15,
        color: '#CCC',
        marginHorizontal: 2,
    },
    themeTag: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 4,
    },
    themeTagText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Media Section (Placeholder)
    mediaSection: {
        marginBottom: 32,
        padding: 20,
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 16,
        color: '#999',
    },

    // Description Section
    descriptionSection: {
        marginBottom: 32,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
        fontWeight: '400',
    },

    // Details Section
    detailsSection: {
        gap: 16,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    metaLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        flex: 1,
    },
    metaValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
    },
});
