import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Switch,
    Alert,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api, resolveImageUrl } from '../services/api';
import { theme } from '../theme';

type ControlItem = {
    key: string;
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
    right?: 'chevron' | 'switch';
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    danger?: boolean;
};

type ControlSection = {
    title: string;
    items: ControlItem[];
};

export default function ProfileControlCenterScreen() {
    const navigation = useNavigation<any>();
    const { user, updateUser, signOut } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);

    // Read privacy state...
    const isPrivate = user?.isPrivate ?? false;

    // Handle privacy toggle - call API and update AuthContext
    const handlePrivacyToggle = async (value: boolean) => {
        if (isUpdating) return;

        setIsUpdating(true);
        const previousValue = isPrivate;

        // Optimistic update
        updateUser({ isPrivate: value });

        try {
            console.log(`[ControlCenter] Toggling isPrivate to ${value} for user ${user?.id}`);
            const res = await api.patch('/users/me', { isPrivate: value });

            // Update with server response to ensure consistency
            if (res.data.user) {
                updateUser(res.data.user);
                console.log(`[ControlCenter] Server confirmed isPrivate=${res.data.user.isPrivate}`);
            }
        } catch (error) {
            console.error('[ControlCenter] Failed to update privacy setting:', error);
            // Revert on error
            updateUser({ isPrivate: previousValue });
            Alert.alert('Erreur', 'Impossible de modifier le paramètre de confidentialité');
        } finally {
            setIsUpdating(false);
        }
    };

    // Handle logout with confirmation
    const handleLogout = () => {
        Alert.alert(
            'Se déconnecter ?',
            'Vous serez déconnecté de votre compte.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Déconnexion',
                    style: 'destructive',
                    onPress: () => signOut()
                }
            ]
        );
    };


    const sections: ControlSection[] = [
        {
            title: 'Compte',
            items: [
                // ... other items
                {
                    key: 'edit_profile',
                    title: 'Modifier le profil',
                    subtitle: 'Avatar, pseudo, bio',
                    icon: 'person-outline',
                    right: 'chevron',
                    onPress: () => navigation.navigate('EditProfile')
                },
                {
                    key: 'change_password',
                    title: 'Modifier le mot de passe',
                    subtitle: 'Sécurisez votre compte',
                    icon: 'lock-closed-outline',
                    right: 'chevron',
                    onPress: () => navigation.navigate('ChangePassword')
                },
                {
                    key: 'privacy',
                    title: 'Profil privé',
                    subtitle: isPrivate
                        ? 'Seules les personnes approuvées voient vos événements'
                        : 'Tout le monde peut voir vos événements',
                    icon: isPrivate ? 'eye-off-outline' : 'eye-outline',
                    right: 'switch',
                    switchValue: isPrivate,
                    onSwitchChange: handlePrivacyToggle
                }
            ]
        },
        {
            title: 'Contenu',
            items: [
                {
                    key: 'liked_items',
                    title: 'Éléments likés',
                    subtitle: 'Vos favoris',
                    icon: 'heart-outline',
                    right: 'chevron',
                    onPress: () => navigation.navigate('LikedItems')
                }
            ]
        },
        {
            title: 'Session',
            items: [
                {
                    key: 'logout',
                    title: 'Déconnexion',
                    subtitle: 'Se déconnecter du compte',
                    icon: 'log-out-outline',
                    right: 'chevron',
                    onPress: handleLogout,
                    danger: true
                }
            ]
        }
    ];

    const renderItem = (item: ControlItem) => (
        <TouchableOpacity
            key={item.key}
            style={[styles.itemRow, item.danger && styles.itemRowDanger]}
            onPress={item.onPress}
            activeOpacity={item.right === 'switch' ? 1 : 0.7}
            disabled={item.right === 'switch'}
        >
            <View style={[styles.iconContainer, item.danger && styles.iconContainerDanger]}>
                <Ionicons
                    name={item.icon}
                    size={22}
                    color={item.danger ? '#E74C3C' : theme.colors.accent}
                />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, item.danger && styles.itemTitleDanger]}>
                    {item.title}
                </Text>
                {item.subtitle && (
                    <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                )}
            </View>
            {item.right === 'chevron' && (
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            )}
            {item.right === 'switch' && (
                <Switch
                    value={item.switchValue}
                    onValueChange={item.onSwitchChange}
                    trackColor={{ false: '#E0E0E0', true: theme.colors.accent }}
                    thumbColor="#FFF"
                />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Centre de contrôle</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* User Mini Header - Clickable to open Account Switcher */}
                {user && (
                    <TouchableOpacity
                        style={styles.userHeader}
                        onPress={() => navigation.navigate('AccountSwitcher')}
                        activeOpacity={0.7}
                    >
                        {resolveImageUrl(user.avatarUrl) ? (
                            <Image
                                source={{ uri: resolveImageUrl(user.avatarUrl)! }}
                                style={styles.userAvatar}
                            />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitials}>
                                    {(user.displayName || user.username || 'U').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user.displayName || user.username}</Text>
                            <Text style={styles.userHandle}>@{user.username}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                    </TouchableOpacity>
                )}

                {/* Sections */}
                {sections.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.sectionContent}>
                            {section.items.map(renderItem)}
                        </View>
                    </View>
                ))}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Lify v1.0.0</Text>
                </View>
                {/* ... footer ... */}
            </ScrollView>


        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFF',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    scrollContent: {
        paddingBottom: 140,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    userAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F0F0F0',
    },
    avatarFallback: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.colors.accent + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        fontSize: 26,
        fontWeight: '600',
        color: theme.colors.accent,
    },
    userInfo: {
        marginLeft: 16,
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000',
    },
    userHandle: {
        fontSize: 15,
        color: '#8E8E93',
        marginTop: 3,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    sectionContent: {
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        marginHorizontal: 16,
        overflow: 'hidden',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    itemRowDanger: {
        borderBottomWidth: 0,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: theme.colors.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    iconContainerDanger: {
        backgroundColor: '#FEE2E2',
    },
    itemContent: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
    },
    itemTitleDanger: {
        color: '#DC2626',
    },
    itemSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 3,
        lineHeight: 17,
    },
    footer: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 40,
    },
    footerText: {
        fontSize: 13,
        color: '#C7C7CC',
        fontWeight: '500',
    },
});
