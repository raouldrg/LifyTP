import React, { forwardRef } from 'react';
import { StyleSheet, Text, View, Image, Pressable, Animated as RNAnimated } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    withSpring,
    FadeInDown,
    Easing,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { resolveImageUrl } from '../services/api';
import { theme } from '../theme';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getConversationPreview } from '../utils/getConversationPreview';

interface ConversationUser {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
}

export interface Message {
    id: string;
    content?: string | null;
    type: 'TEXT' | 'IMAGE' | 'AUDIO';
    senderId: string;
    read: boolean;
    createdAt: string;
    deletedAt?: string | null;
}

export interface Conversation {
    id: string;
    userAId: string;
    userBId: string;
    userA: ConversationUser;
    userB: ConversationUser;
    messages: Message[];
    unreadCount: number;
    updatedAt: string;
    isMuted?: boolean;
}

interface ConversationItemProps {
    conversation: Conversation;
    currentUserId: string;
    index: number;
    isTyping?: boolean;  // External typing indicator
    onPress: (convo: Conversation) => void;
    onDelete: (convo: Conversation) => void;
    onMute: (convo: Conversation) => void;
    onSwipeableOpen: (tag: Swipeable) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ConversationItem = forwardRef<Swipeable, ConversationItemProps>(({
    conversation,
    currentUserId,
    index,
    isTyping = false,
    onPress,
    onDelete,
    onMute,
    onSwipeableOpen,
}, ref) => {
    // Row Enter Animation
    const scale = useSharedValue(1);

    const otherUser = conversation.userAId === currentUserId
        ? conversation.userB
        : conversation.userA;

    // Display name with fallback
    const displayName = otherUser?.displayName || otherUser?.username || "Utilisateur";

    const lastMessage = conversation.messages?.[0];
    const isUnread = conversation.unreadCount > 0;
    const isMe = lastMessage?.senderId === currentUserId;
    const isMuted = conversation.isMuted;

    // Format time
    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) {
            return format(date, 'HH:mm', { locale: fr });
        } else if (isYesterday(date)) {
            return 'Hier';
        } else if (isThisWeek(date)) {
            return format(date, 'EEEE', { locale: fr });
        } else {
            return format(date, 'dd/MM', { locale: fr });
        }
    };

    // Get message preview using centralized function
    const preview = getConversationPreview({
        lastMessage,
        currentUserId,
        otherUsername: otherUser?.username,
        isTyping,
    });

    const avatarUri = resolveImageUrl(otherUser?.avatarUrl)
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.username || 'U')}&background=FFA07A&color=fff&size=112`;

    // Press animations
    const handlePressIn = () => {
        scale.value = withTiming(0.98, { duration: 80 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    };

    const handlePress = () => {
        if (!ref) {
            // Safe check if ref is not attached yet (shouldn't happen with forwardRef usually)
        }
        // We rely on parent to close others, but here we just navigate
        onPress(conversation);
    };

    const animatedRowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Right Actions (Mute + Delete)
    const renderRightActions = (
        progress: RNAnimated.AnimatedInterpolation<number>,
        dragX: RNAnimated.AnimatedInterpolation<number>
    ) => {
        // We expect a total width of approx 160-180 for two actions
        // But for "bubbles", we usually want them fixed width and sticking together or slightly apart.
        const trans = dragX.interpolate({
            inputRange: [-180, 0],
            outputRange: [0, 180],
            extrapolate: 'clamp',
        });

        const handleDelete = () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDelete(conversation);
        };

        const handleMute = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onMute(conversation);
            if (ref && 'current' in ref && ref.current) {
                ref.current.close();
            }
        };

        return (
            <View style={{ width: 180, flexDirection: 'row', paddingLeft: 8 }}>
                {/* Mute Action */}
                <RNAnimated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
                    <Pressable
                        style={[styles.rightAction, { backgroundColor: '#8E8E93' }]}
                        onPress={handleMute}
                    >
                        <Ionicons
                            name={isMuted ? "notifications-off" : "notifications"}
                            size={20}
                            color="#fff"
                            style={{ marginBottom: 2 }}
                        />
                        <Text style={styles.actionText}>{isMuted ? "On" : "Muet"}</Text>
                    </Pressable>
                </RNAnimated.View>

                {/* Delete Action */}
                <RNAnimated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
                    <Pressable
                        style={[styles.rightAction, { backgroundColor: '#FF3B30' }]}
                        onPress={handleDelete}
                    >
                        <Ionicons name="trash" size={20} color="#fff" style={{ marginBottom: 2 }} />
                        <Text style={styles.actionText}>Suppr.</Text>
                    </Pressable>
                </RNAnimated.View>
            </View>
        );
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 35).duration(250).easing(Easing.out(Easing.cubic))}
        >
            <Swipeable
                ref={ref}
                renderRightActions={renderRightActions}
                onSwipeableWillOpen={() => onSwipeableOpen(ref as any)} // Cast generic logic
                rightThreshold={40}
                friction={2}
                overshootRight={false} // Apple-like: no crazy overshoot that reveals white space
            >
                <AnimatedPressable
                    style={[styles.container, animatedRowStyle]}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={handlePress}
                >
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {/* Top row */}
                        <View style={styles.topRow}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Text
                                    style={[styles.username, isUnread && styles.unreadUsername]}
                                    numberOfLines={1}
                                >
                                    {displayName}
                                </Text>
                                {isMuted && (
                                    <Ionicons name="notifications-off" size={14} color="#C7C7CC" style={{ marginLeft: 6 }} />
                                )}
                            </View>
                            <Text style={[styles.time, isUnread && styles.unreadTime]}>
                                {lastMessage ? formatMessageTime(lastMessage.createdAt) : ""}
                            </Text>
                        </View>

                        {/* Bottom row */}
                        <View style={styles.bottomRow}>
                            <Text
                                style={[
                                    styles.preview,
                                    isUnread && styles.unreadPreview,
                                    preview.isTyping && styles.typingPreview,
                                    preview.isDeleted && styles.deletedPreview,
                                ]}
                                numberOfLines={1}
                            >
                                {preview.text}
                            </Text>
                            {isUnread && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>
                                        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Chevron */}
                    <Ionicons name="chevron-forward" size={18} color="#C7C7CC" style={styles.chevron} />
                </AnimatedPressable>
            </Swipeable>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20, // Revert to inner padding as Swipeable wraps it
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    },
    avatarContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F0F0F0',
    },
    content: {
        flex: 1,
        marginLeft: 14,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        flexShrink: 1,
    },
    unreadUsername: {
        fontWeight: '700',
    },
    time: {
        fontSize: 13,
        color: '#8E8E93',
        marginLeft: 8,
    },
    unreadTime: {
        color: theme.colors.accent,
        fontWeight: '600',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    preview: {
        fontSize: 15,
        color: '#8E8E93',
        flex: 1,
        marginRight: 8,
    },
    unreadPreview: {
        color: '#1A1A1A',
        fontWeight: '500',
    },
    typingPreview: {
        color: theme.colors.accent,
        fontStyle: 'italic',
    },
    deletedPreview: {
        fontStyle: 'italic',
    },
    unreadBadge: {
        backgroundColor: theme.colors.accent,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    chevron: {
        marginLeft: 4,
    },
    // Right Actions
    rightAction: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
        marginRight: 6,
        borderRadius: 18,
    },
    actionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: 'transparent',
        paddingTop: 2,
    },
});

