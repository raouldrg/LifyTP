import React, { useEffect, useState, useRef, memo, useCallback } from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    Share,
    Animated,
    Pressable,
} from "react-native";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { FeedEvent } from "../services/eventService";
import { resolveImageUrl } from "../services/api";
import { getAllThemes } from "../services/themeService";
import { resolveTheme, UserTheme, DEFAULT_THEMES } from "../constants/eventThemes";
import * as Haptics from "expo-haptics";

interface FeedEventItemProps {
    event: FeedEvent;
    index: number;
    onPressProfile?: () => void;
    onPressComment?: () => void;
}

// Format date: "jeu. 25 déc • 16:30"
function formatEventDate(startAt: string, endAt?: string): string {
    const start = new Date(startAt);
    const day = start.toLocaleDateString('fr-FR', { weekday: 'short' });
    const date = start.getDate();
    const month = start.toLocaleDateString('fr-FR', { month: 'short' });
    const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let result = `${day} ${date} ${month} • ${time}`;

    if (endAt) {
        const end = new Date(endAt);
        const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        result += ` – ${endTime}`;
    }

    return result;
}

// Format relative time
function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (mins < 1) return "à l'instant";
    if (mins < 60) return `${mins} min`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return "hier";
    return `${days}j`;
}

export const FeedEventItem = memo(function FeedEventItem({
    event,
    index,
    onPressProfile,
    onPressComment
}: FeedEventItemProps) {
    const [allThemes, setAllThemes] = useState<UserTheme[]>(DEFAULT_THEMES);
    const [isLiked, setIsLiked] = useState(false);
    const avatarUri = resolveImageUrl(event.owner.avatarUrl);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const likeScale = useRef(new Animated.Value(1)).current;
    const commentScale = useRef(new Animated.Value(1)).current;
    const shareScale = useRef(new Animated.Value(1)).current;

    // Entrance animation with stagger
    useEffect(() => {
        const delay = Math.min(index * 80, 400);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 300,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Load themes
    useEffect(() => {
        getAllThemes().then(setAllThemes);
    }, []);

    const resolvedTheme = resolveTheme(
        { themeId: event.themeId, colorHex: event.colorHex },
        allThemes
    );

    // Press handlers
    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
        }).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
        }).start();
    }, []);

    // Action button press animation helper
    const createPressAnimation = useCallback((scaleRef: Animated.Value) => ({
        onPressIn: () => {
            Animated.spring(scaleRef, {
                toValue: 0.9,
                useNativeDriver: true,
                tension: 150,
                friction: 10,
            }).start();
        },
        onPressOut: () => {
            Animated.spring(scaleRef, {
                toValue: 1,
                useNativeDriver: true,
                tension: 150,
                friction: 10,
            }).start();
        }
    }), []);

    const handleLike = useCallback(() => {
        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setIsLiked(prev => !prev);

        // Enhanced pop animation for like
        Animated.sequence([
            Animated.timing(likeScale, {
                toValue: 1.4,
                duration: 120,
                useNativeDriver: true,
            }),
            Animated.spring(likeScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 180,
                friction: 6,
            }),
        ]).start();
    }, []);

    const handleComment = useCallback(() => {
        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Scale animation
        Animated.sequence([
            Animated.timing(commentScale, {
                toValue: 1.15,
                duration: 80,
                useNativeDriver: true,
            }),
            Animated.spring(commentScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 200,
                friction: 8,
            }),
        ]).start();

        // Navigate to comments if handler provided
        onPressComment?.();
    }, [onPressComment]);

    const handleShare = useCallback(async () => {
        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Scale animation
        Animated.sequence([
            Animated.timing(shareScale, {
                toValue: 1.15,
                duration: 80,
                useNativeDriver: true,
            }),
            Animated.spring(shareScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 200,
                friction: 8,
            }),
        ]).start();

        try {
            await Share.share({
                message: `${event.title}\n📅 ${formatEventDate(event.startAt, event.endAt)}\n\nVia Lify`,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    }, [event]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [
                        { translateY },
                        { scale: scaleAnim },
                    ],
                },
            ]}
        >
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.pressable}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onPressProfile} activeOpacity={0.7}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitial}>
                                    {event.owner.username?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.headerMeta}>
                        <View style={styles.headerTop}>
                            <TouchableOpacity onPress={onPressProfile} activeOpacity={0.7}>
                                <Text style={styles.username}>{event.owner.username}</Text>
                            </TouchableOpacity>
                            <Text style={styles.timeAgo}>{formatTimeAgo(event.createdAt)}</Text>
                        </View>
                        <Text style={styles.headerActionText}>a ajouté un évènement</Text>
                    </View>

                    <TouchableOpacity style={styles.menuButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#C7C7CC" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title}>{event.title}</Text>

                    <View style={styles.dateRow}>
                        <Ionicons name="time-outline" size={14} color="#8E8E93" />
                        <Text style={styles.dateText}>{formatEventDate(event.startAt, event.endAt)}</Text>
                    </View>

                    <View style={[styles.themePill, { backgroundColor: resolvedTheme.colorHex + '12' }]}>
                        <View style={[styles.themeDot, { backgroundColor: resolvedTheme.colorHex }]} />
                        <Text style={[styles.themeText, { color: resolvedTheme.colorHex }]}>
                            {resolvedTheme.name}
                        </Text>
                    </View>

                    {event.description && (
                        <Text style={styles.description} numberOfLines={2}>
                            {event.description}
                        </Text>
                    )}
                </View>

                {/* Actions - Redesigned with icon + text */}
                <View style={styles.actions}>
                    {/* Like - Primary action, slightly more prominent */}
                    <Pressable
                        style={styles.actionButton}
                        onPress={handleLike}
                        {...createPressAnimation(likeScale)}
                    >
                        <Animated.View style={[styles.actionContent, { transform: [{ scale: likeScale }] }]}>
                            <Ionicons
                                name={isLiked ? "heart" : "heart-outline"}
                                size={22}
                                color={isLiked ? theme.colors.accent : "#AEAEB2"}
                            />
                            <Text style={[
                                styles.actionLabel,
                                isLiked && styles.actionLabelActive
                            ]}>
                                J'aime
                            </Text>
                        </Animated.View>
                    </Pressable>

                    {/* Comment */}
                    <Pressable
                        style={styles.actionButton}
                        onPress={handleComment}
                        {...createPressAnimation(commentScale)}
                    >
                        <Animated.View style={[styles.actionContent, { transform: [{ scale: commentScale }] }]}>
                            <Ionicons
                                name="chatbubble-outline"
                                size={20}
                                color="#AEAEB2"
                            />
                            <Text style={styles.actionLabel}>Commenter</Text>
                        </Animated.View>
                    </Pressable>

                    {/* Share */}
                    <Pressable
                        style={styles.actionButton}
                        onPress={handleShare}
                        {...createPressAnimation(shareScale)}
                    >
                        <Animated.View style={[styles.actionContent, { transform: [{ scale: shareScale }] }]}>
                            <Ionicons
                                name="arrow-redo-outline"
                                size={20}
                                color="#AEAEB2"
                            />
                            <Text style={styles.actionLabel}>Partager</Text>
                        </Animated.View>
                    </Pressable>
                </View>
            </Pressable>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
    },
    pressable: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    avatarPlaceholder: {
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8E8E93',
    },
    headerMeta: {
        flex: 1,
        paddingTop: 1,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    username: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
        letterSpacing: -0.2,
    },
    timeAgo: {
        fontSize: 13,
        color: '#AEAEB2',
    },
    headerActionText: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 1,
    },
    menuButton: {
        padding: 4,
        marginLeft: 8,
    },
    content: {
        marginLeft: 50,
        marginBottom: 14,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1A1A1A',
        letterSpacing: -0.3,
        marginBottom: 6,
        lineHeight: 22,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 5,
    },
    dateText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    themePill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        marginBottom: 8,
    },
    themeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginRight: 5,
    },
    themeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    description: {
        fontSize: 14,
        color: '#8E8E93',
        lineHeight: 19,
    },
    // Redesigned action section
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        paddingTop: 4,
        paddingBottom: 4,
    },
    actionButton: {
        paddingVertical: 8,
        paddingHorizontal: 2,
    },
    actionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#636366',
    },
    actionLabelActive: {
        color: theme.colors.accent,
    },
});
