import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { resolveImageUrl } from '../services/api';
import { theme } from '../theme';

interface AvatarProps {
    avatarUrl?: string | null;
    avatarColor?: string | null;
    username?: string;
    displayName?: string;
    size?: number;
    style?: ViewStyle;
    textStyle?: TextStyle;
    onPress?: () => void;
    showBorder?: boolean;
}

const DEFAULT_AVATAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#1ABC9C', '#F1C40F'
];

export function getInitial(name?: string): string {
    return (name || '?').charAt(0).toUpperCase();
}

export function getDefaultAvatarColor(name?: string): string {
    if (!name) return DEFAULT_AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % DEFAULT_AVATAR_COLORS.length);
    return DEFAULT_AVATAR_COLORS[index];
}

export default function Avatar({
    avatarUrl,
    avatarColor,
    username,
    displayName,
    size = 40,
    style,
    textStyle,
    onPress,
    showBorder = false
}: AvatarProps) {
    const uri = resolveImageUrl(avatarUrl);
    const initial = getInitial(displayName || username);
    const backgroundColor = avatarColor || getDefaultAvatarColor(username);

    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            style={[
                styles.container,
                { width: size, height: size, borderRadius: size / 2 },
                showBorder && styles.border,
                style
            ]}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
        >
            {uri ? (
                <Image
                    source={{ uri }}
                    style={{ width: size, height: size, borderRadius: size / 2 }}
                />
            ) : (
                <View style={[
                    styles.placeholder,
                    { width: size, height: size, borderRadius: size / 2, backgroundColor }
                ]}>
                    <Text style={[styles.initials, { fontSize: size * 0.4 }, textStyle]}>
                        {initial}
                    </Text>
                </View>
            )}
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    initials: {
        color: '#FFF',
        fontWeight: '600',
    },
    border: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
});
