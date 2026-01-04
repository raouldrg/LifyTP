import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { resolveImageUrl } from '../services/api';

interface User {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    [key: string]: any;
}

interface ActionButton {
    label: string;
    style: 'danger' | 'neutral';
    loading?: boolean;
    onPress: (user: User) => void;
}

interface UserListItemProps {
    user: User;
    onPress: (user: User) => void;
    actionButton?: ActionButton;
}

export function UserListItem({ user, onPress, actionButton }: UserListItemProps) {
    const handleActionPress = () => {
        if (actionButton && !actionButton.loading) {
            actionButton.onPress(user);
        }
    };

    const displayName = user.displayName || user.username;

    return (
        <Pressable style={styles.userCard} onPress={() => onPress(user)}>
            <Image
                source={{ uri: resolveImageUrl(user.avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=64` }}
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.displayName}>{displayName}</Text>
                {user.username && <Text style={styles.username}>@{user.username}</Text>}
                {user.bio && <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text>}
            </View>

            {actionButton ? (
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        actionButton.style === 'danger' ? styles.actionButtonDanger : styles.actionButtonNeutral,
                        actionButton.loading && styles.actionButtonDisabled
                    ]}
                    onPress={handleActionPress}
                    disabled={actionButton.loading}
                    activeOpacity={0.7}
                >
                    {actionButton.loading ? (
                        <ActivityIndicator size="small" color={actionButton.style === 'danger' ? '#E53935' : theme.colors.text.secondary} />
                    ) : (
                        <Text style={[
                            styles.actionButtonText,
                            actionButton.style === 'danger' ? styles.actionButtonTextDanger : styles.actionButtonTextNeutral
                        ]}>
                            {actionButton.label}
                        </Text>
                    )}
                </TouchableOpacity>
            ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    userCard: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.03)",
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#E0E0E0",
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    displayName: {
        fontSize: 16,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    username: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 1,
    },
    bio: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
    // Action button styles
    actionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        minWidth: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonDanger: {
        backgroundColor: 'rgba(229, 57, 53, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(229, 57, 53, 0.3)',
    },
    actionButtonNeutral: {
        backgroundColor: '#F2F2F7',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: "600",
    },
    actionButtonTextDanger: {
        color: '#E53935',
    },
    actionButtonTextNeutral: {
        color: theme.colors.text.primary,
    },
});
