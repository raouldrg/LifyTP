import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Lify Design Constants
const MENU_WIDTH = 200;
const ITEM_HEIGHT = 52;
const MENU_HEIGHT = ITEM_HEIGHT * 2 + 4; // Compact, elegant
const MARGIN = 12;
const CARET_SIZE = 10;
const BORDER_RADIUS = 18;

// Lify Colors
const LIFY_ORANGE = '#FFA07A';
const WARM_WHITE = '#FFF8F3';
const SOFT_RED = '#FF6B6B';

interface LayoutRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface EventPopoverProps {
    visible: boolean;
    anchor: LayoutRect | null;
    onEdit: () => void;
    onDelete: () => void;
    onClose: () => void;
}

export const EventPopover = ({ visible, anchor, onEdit, onDelete, onClose }: EventPopoverProps) => {
    const scale = useSharedValue(0.92);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-4);

    const [layout, setLayout] = useState({ top: 0, left: 0, showLeft: false, caretTop: 0 });
    const [editPressed, setEditPressed] = useState(false);
    const [deletePressed, setDeletePressed] = useState(false);

    useEffect(() => {
        if (visible && anchor) {
            // Haptic feedback on open
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Smooth entrance animation
            opacity.value = withTiming(1, { duration: 200 });
            scale.value = withSpring(1, { damping: 16, stiffness: 200 });
            translateY.value = withSpring(0, { damping: 16, stiffness: 200 });

            // Calculate positioning
            const spaceOnRight = SCREEN_WIDTH - (anchor.x + anchor.width);
            const showOnLeft = spaceOnRight < (MENU_WIDTH + MARGIN + 20);

            let left = 0;
            if (showOnLeft) {
                left = anchor.x - MENU_WIDTH - MARGIN;
            } else {
                left = anchor.x + anchor.width + MARGIN;
            }

            // Vertical centering on pill
            const pillCenterY = anchor.y + (anchor.height / 2);
            let top = pillCenterY - (MENU_HEIGHT / 2);

            // Clamp to screen
            if (top < 60) top = 60;
            if (top + MENU_HEIGHT > SCREEN_HEIGHT - 60) top = SCREEN_HEIGHT - MENU_HEIGHT - 60;

            // Caret positioning
            let caretTop = pillCenterY - top - (CARET_SIZE / 2);
            if (caretTop < BORDER_RADIUS) caretTop = BORDER_RADIUS;
            if (caretTop > MENU_HEIGHT - BORDER_RADIUS - CARET_SIZE) {
                caretTop = MENU_HEIGHT - BORDER_RADIUS - CARET_SIZE;
            }

            setLayout({ top, left, showLeft: showOnLeft, caretTop });
        } else {
            opacity.value = withTiming(0, { duration: 150 });
            scale.value = withTiming(0.92, { duration: 150 });
            translateY.value = withTiming(-4, { duration: 150 });
        }
    }, [visible, anchor]);

    const rStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { scale: scale.value },
            { translateY: translateY.value }
        ]
    }));

    if (!visible || !anchor) return null;

    const handleEdit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit();
    };

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDelete();
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Subtle overlay */}
            <TouchableOpacity
                style={[StyleSheet.absoluteFill, styles.overlay]}
                activeOpacity={1}
                onPress={onClose}
            />

            <Animated.View
                style={[
                    styles.popover,
                    { top: layout.top, left: layout.left },
                    rStyle
                ]}
            >
                {/* Card Content */}
                <View style={styles.card}>
                    {/* Edit Option */}
                    <TouchableOpacity
                        style={[
                            styles.row,
                            editPressed && styles.rowPressed
                        ]}
                        onPress={handleEdit}
                        onPressIn={() => setEditPressed(true)}
                        onPressOut={() => setEditPressed(false)}
                        activeOpacity={1}
                    >
                        <View style={styles.orangeAccent} />
                        <Text style={styles.label}>Modifier</Text>
                        <Ionicons name="pencil-outline" size={19} color="#1A1A1A" />
                    </TouchableOpacity>

                    {/* Subtle Separator */}
                    <View style={styles.separator} />

                    {/* Delete Option */}
                    <TouchableOpacity
                        style={[
                            styles.row,
                            deletePressed && styles.rowPressedDelete
                        ]}
                        onPress={handleDelete}
                        onPressIn={() => setDeletePressed(true)}
                        onPressOut={() => setDeletePressed(false)}
                        activeOpacity={1}
                    >
                        <View style={[styles.orangeAccent, { opacity: 0 }]} />
                        <Text style={[styles.label, styles.destructive]}>Supprimer</Text>
                        <Ionicons name="trash-outline" size={19} color={SOFT_RED} />
                    </TouchableOpacity>
                </View>

                {/* Caret (Arrow Pointer) */}
                <View
                    style={[
                        styles.caret,
                        {
                            top: layout.caretTop,
                            [layout.showLeft ? 'right' : 'left']: -7,
                            borderLeftWidth: layout.showLeft ? 7 : 0,
                            borderRightWidth: layout.showLeft ? 0 : 7,
                            borderRightColor: layout.showLeft ? 'transparent' : WARM_WHITE,
                            borderLeftColor: layout.showLeft ? WARM_WHITE : 'transparent',
                        }
                    ]}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    popover: {
        position: 'absolute',
        width: MENU_WIDTH,
        height: MENU_HEIGHT,
        zIndex: 9999,
    },
    card: {
        flex: 1,
        backgroundColor: WARM_WHITE,
        borderRadius: BORDER_RADIUS,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        // Premium soft shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 12,
        overflow: 'hidden',
    },
    row: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingLeft: 6, // Space for accent bar
    },
    rowPressed: {
        backgroundColor: `${LIFY_ORANGE}15`, // Very light orange on press
    },
    rowPressedDelete: {
        backgroundColor: `${SOFT_RED}08`,
    },
    orangeAccent: {
        width: 3,
        height: 24,
        backgroundColor: LIFY_ORANGE,
        borderRadius: 2,
        marginRight: 12,
        opacity: 0.7,
    },
    label: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        letterSpacing: -0.2,
    },
    destructive: {
        color: SOFT_RED,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.04)',
        marginHorizontal: 18,
        marginLeft: 24, // Offset for accent
    },
    caret: {
        position: 'absolute',
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderTopWidth: 5,
        borderBottomWidth: 5,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        // Soft shadow for caret
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    }
});
