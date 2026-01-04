/**
 * ChatContextMenu - Attached popover menu for message actions (iOS/Instagram style)
 * 
 * Features:
 * - Appears attached to the message (not bottom sheet)
 * - Measures position and adjusts placement
 * - Smooth fade + scale animation
 * - Dismisses on tap outside or scroll
 */

import React, { useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const MENU_WIDTH = 220;
const MENU_ITEM_HEIGHT = 44;
const REACTION_BAR_HEIGHT = 48;
const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;
const SPRING_CONFIG = { damping: 18, stiffness: 280 };

interface MessagePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ChatContextMenuProps {
    visible: boolean;
    messagePosition: MessagePosition | null;
    isMyMessage: boolean;
    hasText: boolean;
    selectedEmoji?: string | null;
    onClose: () => void;
    onCopy: () => void;
    onReply: () => void;
    onEdit?: () => void;
    onDelete: () => void;
    onSelectEmoji?: (emoji: string) => void;
}

export function ChatContextMenu({
    visible,
    messagePosition,
    isMyMessage,
    hasText,
    selectedEmoji,
    onClose,
    onCopy,
    onReply,
    onEdit,
    onDelete,
    onSelectEmoji,
}: ChatContextMenuProps) {
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    const scale = useSharedValue(0.98);
    const opacity = useSharedValue(0);

    // ALL hooks must be called before any conditional returns
    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1, SPRING_CONFIG);
            opacity.value = withTiming(1, { duration: 150 });
        } else {
            scale.value = withTiming(0.98, { duration: 100 });
            opacity.value = withTiming(0, { duration: 100 });
        }
    }, [visible]);

    const menuStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    // Calculate menu position - must be before early return but use safe defaults
    const menuPosition = useMemo(() => {
        if (!messagePosition) {
            return { menuTop: 100, menuLeft: 20, showAbove: true };
        }

        const itemCount = (hasText ? 1 : 0) + 1 + (isMyMessage && hasText && onEdit ? 1 : 0) + (isMyMessage ? 1 : 0); // Copy + Reply + Edit + Delete
        const menuHeight = itemCount * MENU_ITEM_HEIGHT + REACTION_BAR_HEIGHT + 24; // Add height for reactions row

        const spaceAbove = messagePosition.y - insets.top - 20;
        const spaceBelow = windowHeight - messagePosition.y - messagePosition.height - insets.bottom - 20;
        const showAbove = spaceAbove > menuHeight || spaceAbove > spaceBelow;

        let menuLeft = isMyMessage
            ? messagePosition.x + messagePosition.width - MENU_WIDTH
            : messagePosition.x;
        menuLeft = Math.max(12, Math.min(menuLeft, windowWidth - MENU_WIDTH - 12));

        const menuTop = showAbove
            ? messagePosition.y - menuHeight - 8
            : messagePosition.y + messagePosition.height + 8;

        return { menuTop, menuLeft, showAbove };
    }, [messagePosition, hasText, isMyMessage, insets, windowWidth, windowHeight]);

    // Early return AFTER all hooks
    if (!visible || !messagePosition) return null;

    const handleAction = (action: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action();
        onClose();
    };

    const handleEmojiPress = (emoji: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectEmoji?.(emoji);
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            {/* Backdrop */}
            <Pressable style={styles.backdrop} onPress={onClose}>
                <View style={styles.backdropOverlay} />
            </Pressable>

            {/* Menu popover */}
            <Animated.View
                style={[
                    styles.menuContainer,
                    menuStyle,
                    {
                        top: menuPosition.menuTop,
                        left: menuPosition.menuLeft,
                    }
                ]}
            >
                {/* Pointer arrow */}
                <View
                    style={[
                        styles.pointer,
                        menuPosition.showAbove ? styles.pointerBottom : styles.pointerTop,
                        {
                            [isMyMessage ? 'right' : 'left']: 20,
                        }
                    ]}
                />

                {/* Glass container */}
                {Platform.OS === 'ios' ? (
                    <BlurView
                        intensity={60}
                        tint="light"
                        style={styles.glassContainer}
                    >
                        <View style={styles.glassOverlay} />
                        {renderMenuItems()}
                    </BlurView>
                ) : (
                    <View style={styles.androidContainer}>
                        {renderMenuItems()}
                    </View>
                )}
            </Animated.View>
        </Modal>
    );

    function renderMenuItems() {
        return (
            <>
                {/* Emoji reactions row */}
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

                {/* Divider */}
                <View style={styles.divider} />

                {/* Menu items */}
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction(onReply)}
                >
                    <Ionicons name="arrow-undo-outline" size={18} color="#1A1A1A" />
                    <Text style={styles.menuItemText}>Répondre</Text>
                </TouchableOpacity>

                {hasText && (
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => handleAction(onCopy)}
                    >
                        <Ionicons name="copy-outline" size={18} color="#1A1A1A" />
                        <Text style={styles.menuItemText}>Copier</Text>
                    </TouchableOpacity>
                )}

                {isMyMessage && hasText && onEdit && (
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => handleAction(onEdit)}
                    >
                        <Ionicons name="pencil-outline" size={18} color="#1A1A1A" />
                        <Text style={styles.menuItemText}>Éditer</Text>
                    </TouchableOpacity>
                )}

                {isMyMessage && (
                    <TouchableOpacity
                        style={[styles.menuItem, styles.deleteItem]}
                        onPress={() => handleAction(onDelete)}
                    >
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        <Text style={[styles.menuItemText, styles.deleteText]}>Supprimer</Text>
                    </TouchableOpacity>
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
    },
    menuContainer: {
        position: 'absolute',
        width: MENU_WIDTH,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    glassContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    androidContainer: {
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.97)',
    },
    pointer: {
        position: 'absolute',
        width: 12,
        height: 12,
        backgroundColor: 'rgba(255,255,255,0.95)',
        transform: [{ rotate: '45deg' }],
        zIndex: -1,
    },
    pointerTop: {
        top: -6,
    },
    pointerBottom: {
        bottom: -6,
    },
    // Emoji reactions row
    emojiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    emojiButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiButtonSelected: {
        backgroundColor: 'rgba(255,160,122,0.25)',
    },
    emoji: {
        fontSize: 22,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginVertical: 4,
    },
    // Menu items
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    menuItemText: {
        fontSize: 15,
        color: '#1A1A1A',
        fontWeight: '500',
    },
    deleteItem: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0, 0, 0, 0.08)',
        marginTop: 4,
    },
    deleteText: {
        color: '#FF3B30',
    },
});
