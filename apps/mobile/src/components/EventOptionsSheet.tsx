import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MENU_WIDTH = 250;
const MENU_HEIGHT = 120; // Approx

interface EventOptionsSheetProps {
    visible: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    title?: string;
    anchor?: { x: number, y: number } | null;
}

export const EventOptionsSheet = ({ visible, onClose, onEdit, onDelete, title, anchor }: EventOptionsSheetProps) => {
    const scale = useSharedValue(0.8);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 200 });
            scale.value = withSpring(1, { damping: 15, stiffness: 150 });
        } else {
            opacity.value = withTiming(0, { duration: 150 });
            scale.value = withTiming(0.8, { duration: 150 });
        }
    }, [visible]);

    // Calculate Position
    let top = (SCREEN_HEIGHT - MENU_HEIGHT) / 2;
    let left = (SCREEN_WIDTH - MENU_WIDTH) / 2;

    // Transform origin for animation
    let transformOriginY = 0;

    if (anchor) {
        // Default: Show below the touch point
        top = anchor.y + 10;
        left = anchor.x - (MENU_WIDTH / 2); // Center horizontally on touch

        // Check bounds
        if (left < 10) left = 10;
        if (left + MENU_WIDTH > SCREEN_WIDTH - 10) left = SCREEN_WIDTH - MENU_WIDTH - 10;

        // Check vertical bounds (if clicked near bottom, show above)
        if (top + MENU_HEIGHT > SCREEN_HEIGHT - 50) {
            top = anchor.y - MENU_HEIGHT - 10;
            transformOriginY = MENU_HEIGHT; // Animate from bottom
        }
    }

    const rStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateY: 0 },
            { scale: scale.value }
        ]
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    {/* Full screen blur bg */}
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                    <Animated.View style={[styles.menuContainer, { top, left }, rStyle]}>
                        {title && (
                            <View style={styles.header}>
                                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                            </View>
                        )}

                        <View style={styles.optionsWrapper}>
                            <TouchableOpacity style={styles.optionRow} onPress={onEdit} activeOpacity={0.7}>
                                <Text style={styles.optionText}>Modifier</Text>
                                <Ionicons name="pencil-outline" size={20} color="#000" />
                            </TouchableOpacity>

                            <View style={styles.separator} />

                            <TouchableOpacity style={styles.optionRow} onPress={onDelete} activeOpacity={0.7}>
                                <Text style={[styles.optionText, styles.destructiveText]}>Supprimer</Text>
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    menuContainer: {
        position: 'absolute',
        width: MENU_WIDTH,
        backgroundColor: 'rgba(250, 250, 250, 0.95)',
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        padding: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center',
        backgroundColor: 'rgba(240,240,240,0.5)'
    },
    headerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    optionsWrapper: {},
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: 'transparent'
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.06)',
        marginLeft: 16,
        marginRight: 16
    },
    optionText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#000'
    },
    destructiveText: {
        color: '#FF3B30'
    }
});
