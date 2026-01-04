/**
 * ChatReplyBanner - Shows above input when replying to a message
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

interface Message {
    id: string;
    senderId: string;
    content?: string;
    type: 'TEXT' | 'IMAGE' | 'AUDIO';
    sender?: { username?: string };
}

interface ChatReplyBannerProps {
    message: Message;
    senderName: string;
    onClose: () => void;
}

export function ChatReplyBanner({ message, senderName, onClose }: ChatReplyBannerProps) {
    const getPreviewText = () => {
        if (message.type === 'IMAGE') return '📷 Photo';
        if (message.type === 'AUDIO') return '🎤 Message vocal';
        return message.content?.slice(0, 50) || '';
    };

    return (
        <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOutDown.duration(150)}
            style={styles.container}
        >
            <View style={styles.accentBar} />
            <View style={styles.content}>
                <Text style={styles.replyingTo} numberOfLines={1}>
                    Réponse à <Text style={styles.senderName}>{senderName}</Text>
                </Text>
                <Text style={styles.preview} numberOfLines={1}>
                    {getPreviewText()}
                </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#8E8E93" />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    accentBar: {
        width: 3,
        height: 36,
        backgroundColor: '#FFA07A',
        borderRadius: 2,
        marginRight: 10,
    },
    content: {
        flex: 1,
    },
    replyingTo: {
        fontSize: 13,
        color: '#8E8E93',
    },
    senderName: {
        fontWeight: '600',
        color: '#FFA07A',
    },
    preview: {
        fontSize: 14,
        color: '#1A1A1A',
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
        marginLeft: 8,
    },
});
