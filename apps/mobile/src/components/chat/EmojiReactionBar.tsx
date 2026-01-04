/**
 * EmojiReactionBar - iMessage-style emoji reaction picker
 * 
 * Features:
 * - Anchored popover above/below message bubble
 * - Quick emojis: ❤️ 😂 😮 😢 😡 👍
 * - Haptic feedback on open and select
 * - Smooth scale + fade animations
 * - Flips position based on screen bounds
 */

import React, { useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;
const BAR_HEIGHT = 44;
const EMOJI_SIZE = 28;
const BAR_PADDING = 8;

interface MessagePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface EmojiReactionBarProps {
    visible: boolean;
    messagePosition: MessagePosition | null;
    isMyMessage: boolean;
    selectedEmoji?: string | null;
    onSelectEmoji: (emoji: string) => void;
    onClose: () => void;
}

export function EmojiReactionBar({
    visible,
    messagePosition,
    isMyMessage,
    selectedEmoji,
    onSelectEmoji,
    onClose,
}: EmojiReactionBarProps) {
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    const scale = useSharedValue(0.9);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
            opacity.value = withTiming(1, { duration: 150 });
        } else {
            scale.value = withTiming(0.9, { duration: 100 });
            opacity.value = withTiming(0, { duration: 100 });
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    // Calculate position
    const barWidth = QUICK_EMOJIS.length * (EMOJI_SIZE + 12) + BAR_PADDING * 2;

    const getPosition = () => {
        if (!messagePosition) {
            return { top: 100, left: 20, showAbove: true };
        }

        const spaceAbove = messagePosition.y - insets.top - 20;
        const showAbove = spaceAbove > BAR_HEIGHT + 16;

        let left = isMyMessage
            ? messagePosition.x + messagePosition.width - barWidth
            : messagePosition.x;

        // Keep within screen bounds
        left = Math.max(12, Math.min(left, windowWidth - barWidth - 12));

        const top = showAbove
            ? messagePosition.y - BAR_HEIGHT - 12
            : messagePosition.y + messagePosition.height + 8;

        return { top, left, showAbove };
    };

    if (!visible || !messagePosition) return null;

    const { top, left, showAbove } = getPosition();

    const handleEmojiPress = (emoji: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectEmoji(emoji);
        onClose();
    };

    const renderBar = () => (
        <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                    key={emoji}
                    onPress={() => handleEmojiPress(emoji)}
                    style={[
                        styles.emojiButton,
                        selectedEmoji === emoji && styles.emojiButtonSelected,
                    ]}
                    activeOpacity={0.7}
                >
                    <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <Animated.View
            style={[
                styles.container,
                animatedStyle,
                {
                    top,
                    left,
                },
            ]}
        >
            {Platform.OS === 'ios' ? (
                <BlurView
                    intensity={60}
                    tint="light"
                    style={styles.blurContainer}
                >
                    <View style={styles.glassOverlay} />
                    {renderBar()}
                </BlurView>
            ) : (
                <View style={styles.androidContainer}>
                    {renderBar()}
                </View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 1000,
    },
    blurContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.6)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
    },
    androidContainer: {
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.97)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    emojiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: BAR_PADDING,
        paddingVertical: 8,
        gap: 4,
    },
    emojiButton: {
        width: EMOJI_SIZE + 8,
        height: EMOJI_SIZE + 8,
        borderRadius: (EMOJI_SIZE + 8) / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiButtonSelected: {
        backgroundColor: 'rgba(255,160,122,0.25)',
    },
    emoji: {
        fontSize: EMOJI_SIZE,
    },
});
