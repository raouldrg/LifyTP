import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { resolveImageUrl } from '../services/api';
import { getInitial, getDefaultAvatarColor } from './Avatar';
import Constants from 'expo-constants';

interface AvatarViewerModalProps {
    visible: boolean;
    onClose: () => void;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    username?: string;
    displayName?: string;
}

const { width } = Dimensions.get('window');

export default function AvatarViewerModal({
    visible,
    onClose,
    avatarUrl,
    avatarColor,
    username,
    displayName
}: AvatarViewerModalProps) {
    if (!visible) return null;

    const uri = resolveImageUrl(avatarUrl);
    const initial = getInitial(displayName || username);
    const backgroundColor = avatarColor || getDefaultAvatarColor(username);
    const size = width * 0.8;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <BlurView intensity={30} tint="dark" style={styles.container}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <View style={styles.content}>
                    {uri ? (
                        <Image
                            source={{ uri }}
                            style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
                        />
                    ) : (
                        <View style={[
                            styles.placeholder,
                            { width: size, height: size, borderRadius: size / 2, backgroundColor }
                        ]}>
                            <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
                                {initial}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.name}>{displayName || username}</Text>
                    <Text style={styles.username}>@{username}</Text>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close-circle" size={48} color="#FFF" />
                </TouchableOpacity>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none', // Allow clicks to pass through to backdrop for close, but we have close button too
    },
    image: {
        backgroundColor: '#222',
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    initials: {
        color: '#FFF',
        fontWeight: '700',
    },
    name: {
        marginTop: 24,
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
        textAlign: 'center',
    },
    username: {
        marginTop: 8,
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: Constants.statusBarHeight + 20,
        right: 20,
    }
});
