import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Share } from "react-native";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { FeedEvent } from "../services/eventService";
import { resolveImageUrl } from "../services/api";
import { getAllThemes } from "../services/themeService";
import { resolveTheme, UserTheme, DEFAULT_THEMES } from "../constants/eventThemes";

interface EventFeedCardProps {
    event: FeedEvent;
    onPress?: () => void;
}

// Format date for display: "jeu. 25 déc • 16:30 – 17:30"
function formatEventDateTime(startAt: string, endAt?: string): string {
    const start = new Date(startAt);
    const dayName = start.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dayNum = start.getDate();
    const month = start.toLocaleDateString('fr-FR', { month: 'short' });
    const startTime = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let result = `${dayName} ${dayNum} ${month} • ${startTime}`;

    if (endAt) {
        const end = new Date(endAt);
        const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        result += ` – ${endTime}`;
    }

    return result;
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return "à l'instant";
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays === 1) return "hier";
    return `il y a ${diffDays}j`;
}

export function EventFeedCard({ event, onPress }: EventFeedCardProps) {
    const [allThemes, setAllThemes] = useState<UserTheme[]>(DEFAULT_THEMES);
    const [isLiked, setIsLiked] = useState(false);
    const avatarUri = resolveImageUrl(event.owner.avatarUrl);

    // Load all themes (default + custom)
    useEffect(() => {
        getAllThemes().then(setAllThemes);
    }, []);

    // Resolve theme
    const resolvedTheme = resolveTheme(
        { themeId: event.themeId, colorHex: event.colorHex },
        allThemes
    );

    const handleLike = () => {
        setIsLiked(!isLiked);
        // TODO: API call when backend ready
    };

    const handleComment = () => {
        // TODO: Navigate to comments
    };

    const handleShare = async () => {
        try {
            const dateStr = formatEventDateTime(event.startAt, event.endAt);
            await Share.share({
                message: `${event.title}\n📅 ${dateStr}\n\nPartagé via Lify`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onPress} style={styles.avatarTouchable}>
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

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={onPress}>
                        <Text style={styles.username}>{event.owner.username}</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionText}>a ajouté un évènement à son Lify</Text>
                </View>

                <Text style={styles.timeAgo}>{formatRelativeTime(event.createdAt)}</Text>

                <TouchableOpacity style={styles.menuButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#C7C7CC" />
                </TouchableOpacity>
            </View>

            {/* Event Body */}
            <View style={styles.eventBody}>
                {/* Title */}
                <Text style={styles.eventTitle}>{event.title}</Text>

                {/* Date/Time with icon */}
                <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={15} color={theme.colors.text.secondary} />
                    <Text style={styles.eventDateTime}>{formatEventDateTime(event.startAt, event.endAt)}</Text>
                </View>

                {/* Theme pill */}
                <View style={[styles.themePill, { backgroundColor: resolvedTheme.colorHex + '15' }]}>
                    <View style={[styles.themeDot, { backgroundColor: resolvedTheme.colorHex }]} />
                    <Text style={[styles.themeText, { color: resolvedTheme.colorHex }]}>
                        {resolvedTheme.name}
                    </Text>
                </View>

                {/* Description */}
                {event.description && (
                    <Text style={styles.eventDescription} numberOfLines={2}>
                        {event.description}
                    </Text>
                )}
            </View>

            {/* Footer Actions */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <Ionicons
                        name={isLiked ? "heart" : "heart-outline"}
                        size={20}
                        color={isLiked ? theme.colors.accent : theme.colors.text.secondary}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
                    <Ionicons name="chatbubble-outline" size={19} color={theme.colors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                    <Ionicons name="arrow-redo-outline" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
        // Soft shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 10,
    },
    avatarTouchable: {
        marginRight: 10,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    avatarPlaceholder: {
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.colors.text.secondary,
    },
    headerContent: {
        flex: 1,
        paddingTop: 2,
    },
    username: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.primary,
        letterSpacing: -0.2,
    },
    actionText: {
        fontSize: 13,
        color: theme.colors.text.secondary,
        marginTop: 1,
    },
    timeAgo: {
        fontSize: 12,
        color: '#AEAEB2',
        marginRight: 6,
        marginTop: 2,
    },
    menuButton: {
        padding: 4,
    },
    eventBody: {
        paddingHorizontal: 14,
        paddingBottom: 12,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.primary,
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 6,
    },
    eventDateTime: {
        fontSize: 14,
        color: theme.colors.text.secondary,
    },
    themePill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        marginBottom: 10,
    },
    themeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    themeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    eventDescription: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0, 0, 0, 0.06)',
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
});
