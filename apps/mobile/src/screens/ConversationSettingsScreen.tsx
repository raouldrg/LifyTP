/**
 * ConversationSettingsScreen - Modern "Conversation Info" screen
 * 
 * Design principles:
 * - 100% white background (no gray zones)
 * - Spacing-based visual hierarchy (no separators)
 * - Calm, premium, minimal aesthetic
 * - Danger communicated through color, not labels
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../theme';
import { resolveImageUrl } from '../services/api';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

interface SettingRowProps {
    icon: string;
    iconColor?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
}

function SettingRow({
    icon,
    iconColor = '#1A1A1A',
    title,
    subtitle,
    onPress,
    rightElement,
    destructive,
}: SettingRowProps) {
    const content = (
        <View style={styles.row}>
            <View style={[
                styles.iconCircle,
                destructive && styles.iconCircleDestructive
            ]}>
                <Ionicons
                    name={icon as any}
                    size={18}
                    color={destructive ? '#FF3B30' : iconColor}
                />
            </View>
            <View style={styles.rowContent}>
                <Text style={[
                    styles.rowTitle,
                    destructive && styles.destructiveText
                ]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={styles.rowSubtitle}>{subtitle}</Text>
                )}
            </View>
            {rightElement || (onPress && (
                <Ionicons name="chevron-forward" size={16} color="#D1D1D6" />
            ))}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
                activeOpacity={0.5}
            >
                {content}
            </TouchableOpacity>
        );
    }
    return content;
}

export default function ConversationSettingsScreen({ route, navigation }: any) {
    const { otherUser } = route.params || {};
    const [isMuted, setIsMuted] = useState(false);

    // Username (identifiant) et displayName (pseudo)
    const username = otherUser?.username || 'utilisateur';
    const displayName = otherUser?.displayName || otherUser?.username || 'Utilisateur';

    const avatarUri = resolveImageUrl(otherUser?.avatarUrl)
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=FFA07A&color=fff&size=200`;

    const handleMuteToggle = useCallback((value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsMuted(value);
    }, []);

    const handleViewProfile = useCallback(() => {
        if (otherUser?.id) {
            navigation.navigate('UserProfile', { userId: otherUser.id });
        }
    }, [navigation, otherUser]);

    const handleSearchConversation = useCallback(() => {
        Alert.alert('Recherche', 'Bientôt disponible');
    }, []);

    const handleBlock = useCallback(() => {
        Alert.alert(
            'Bloquer',
            `Bloquer ${displayName} ? Cette personne ne pourra plus vous contacter.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Bloquer',
                    style: 'destructive',
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Utilisateur bloqué');
                    }
                }
            ]
        );
    }, [displayName]);

    const handleReport = useCallback(() => {
        Alert.alert(
            'Signaler',
            'Signaler cette conversation ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Signaler',
                    style: 'destructive',
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Merci', 'Votre signalement a été envoyé.');
                    }
                }
            ]
        );
    }, []);

    const handleClearConversation = useCallback(() => {
        Alert.alert(
            'Effacer la conversation',
            'Tous les messages seront supprimés de votre côté. Cette action est irréversible.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Effacer',
                    style: 'destructive',
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        navigation.goBack();
                    }
                }
            ]
        );
    }, [navigation]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header - Clean, only back button */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Hero */}
                <Animated.View entering={FadeIn.duration(400)} style={styles.profileSection}>
                    <TouchableOpacity onPress={handleViewProfile} activeOpacity={0.8}>
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    </TouchableOpacity>
                    <Text style={styles.profileName}>{displayName}</Text>
                    <Text style={styles.profileHandle}>@{username}</Text>
                    <TouchableOpacity onPress={handleViewProfile}>
                        <Text style={styles.profileLink}>Voir le profil</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Options */}
                <View style={styles.section}>
                    <SettingRow
                        icon={isMuted ? 'notifications-off' : 'notifications'}
                        iconColor="#FF9500"
                        title="Notifications"
                        subtitle={isMuted ? "Désactivées" : "Activées"}
                        rightElement={
                            <Switch
                                value={!isMuted}
                                onValueChange={(v) => handleMuteToggle(!v)}
                                trackColor={{ false: '#E9E9EB', true: theme.colors.accent }}
                                thumbColor="#FFFFFF"
                                ios_backgroundColor="#E9E9EB"
                            />
                        }
                    />
                    <SettingRow
                        icon="search"
                        iconColor="#5856D6"
                        title="Rechercher"
                        subtitle="Dans la conversation"
                        onPress={handleSearchConversation}
                    />
                </View>

                {/* Privacy - No title, spacing creates hierarchy */}
                <View style={styles.section}>
                    <SettingRow
                        icon="hand-left"
                        title="Bloquer"
                        onPress={handleBlock}
                        destructive
                    />
                    <SettingRow
                        icon="flag"
                        title="Signaler"
                        onPress={handleReport}
                        destructive
                    />
                </View>

                {/* Delete - Standalone, danger implied by color */}
                <View style={styles.section}>
                    <SettingRow
                        icon="trash"
                        title="Effacer la conversation"
                        onPress={handleClearConversation}
                        destructive
                    />
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        height: 52,
        backgroundColor: '#FFFFFF',
        // No border - clean design
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1A1A1A',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    // Profile Hero
    profileSection: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 32,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#F5F5F5',
        marginBottom: 14,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 2,
    },
    profileHandle: {
        fontSize: 15,
        color: '#8E8E93',
        marginBottom: 8,
    },
    profileLink: {
        fontSize: 15,
        color: theme.colors.accent,
        fontWeight: '500',
    },
    // Sections - spacing only, no titles
    section: {
        marginBottom: 28,
    },
    // Row
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    iconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    iconCircleDestructive: {
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
    },
    rowContent: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    rowSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 1,
    },
    destructiveText: {
        color: '#FF3B30',
    },
});
