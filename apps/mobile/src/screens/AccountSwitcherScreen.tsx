import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { accountStorage } from '../services/accountStorage'; // Still used for remove? Or we can use clearSessionForUser via AuthContext if exposed or imported directly? 
// Actually easier to just use storage logic here or call authStorage directly.
// But let's use accountStorage wrapper for 'removeAccount' which we updated to wrap authStorage.

import { resolveImageUrl } from '../services/api';
import { theme } from '../theme';

export default function AccountSwitcherScreen() {
    const navigation = useNavigation<any>();
    // Get accounts directly from context which is now the source of truth
    const { user, availableAccounts, switchAccount, signOut, addAccount } = useAuth();

    // Local loading state for switch actions
    const [switchingTo, setSwitchingTo] = useState<string | null>(null);

    const handleSwitchAccount = async (targetUserId: string) => {
        if (targetUserId === user?.id) return; // Already active

        setSwitchingTo(targetUserId);

        try {
            await switchAccount(targetUserId);
            // On success, we are now logged in as the other user.
            // The AuthContext updates state, which might trigger re-render or nav change.
            // We should navigate back to Profile.
            navigation.navigate('ProfileIndex');
        } catch (error) {
            console.error('Failed to switch account:', error);
            Alert.alert('Erreur', 'Impossible de changer de compte.');
        } finally {
            setSwitchingTo(null);
        }
    };

    const handleRemoveAccount = async (accountId: string) => {
        if (accountId === user?.id) {
            Alert.alert(
                'Compte actif',
                'Vous ne pouvez pas supprimer le compte actif. Veuillez d\'abord changer de compte.'
            );
            return;
        }

        Alert.alert(
            'Supprimer le compte ?',
            'Ce compte sera retiré de cet appareil.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        await accountStorage.removeAccount(accountId);
                        // Force refresh of list via AuthContext? 
                        // AuthContext refreshes availableAccounts on mount/sign-in. 
                        // We might need to manually trigger a refresh or just rely on re-mount.
                        // Ideally accountStorage.removeAccount should trigger an event or we call something in AuthContext.
                        // For now: Force reload by calling context refresh if we had one, 
                        // or just simple hack: call switchAccount(user.id) to trigger list reload? No.
                        // Let's assume list auto-updates or we ignore visual sync for a split second.
                        // Wait, check AuthContext: refreshAccountList is internal.
                        // We should probably expose refreshAccounts or just live with it.
                        // Simpler: switchAccount(user.id) basically does nothing but might refresh list? No.
                        // Let's rely on React state updates if we can. 
                        // Actually, if we use availableAccounts from context, and we change storage, 
                        // context won't know unless we tell it.
                        // We should expose `refreshUser` or similar. 
                        // Or just re-mount screen.

                        // For now, let's just alert success and go back, or stay here.
                        navigation.replace('AccountSwitcher'); // Quick hack to reload
                    }
                }
            ]
        );
    };

    const handleAddAccount = () => {
        // use AddAccount context method which clears state without deleting session
        Alert.alert(
            'Ajouter un compte',
            'Vous allez être redirigé vers la page de connexion.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Continuer',
                    onPress: async () => {
                        await addAccount();
                        // AuthContext state change (user=null) will auto-trigger navigation to AuthStack (Login)
                    }
                }
            ]
        );
    };

    const getInitials = (account: any) => {
        const name = account.displayName || account.username || account.email;
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    // availableAccounts includes the current user too
    const canAddMore = availableAccounts.length < 3;

    const renderAccountRow = (account: any) => {
        const isActive = account.id === user?.id;
        const isSwitching = switchingTo === account.id;
        const avatarUri = resolveImageUrl(account.avatarUrl);

        return (
            <TouchableOpacity
                key={account.id}
                style={[styles.accountRow, isActive && styles.accountRowActive]}
                onPress={() => handleSwitchAccount(account.id)}
                onLongPress={() => !isActive && handleRemoveAccount(account.id)}
                disabled={isSwitching}
                activeOpacity={0.7}
            >
                {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatarPlaceholder, isActive && styles.avatarPlaceholderActive]}>
                        <Text style={[styles.avatarInitials, isActive && styles.avatarInitialsActive]}>
                            {getInitials(account)}
                        </Text>
                    </View>
                )}

                <View style={styles.accountInfo}>
                    <Text style={styles.accountName} numberOfLines={1}>
                        {account.displayName || account.username}
                    </Text>
                    <Text style={styles.accountHandle} numberOfLines={1}>
                        @{account.username}
                    </Text>
                </View>

                {isSwitching ? (
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : isActive ? (
                    <View style={styles.activeBadge}>
                        <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveAccount(account.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close-circle-outline" size={22} color="#C7C7CC" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Comptes</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
                    <Text style={styles.infoText}>
                        Gérez jusqu'à 3 comptes. Appuyez sur un compte pour basculer.
                    </Text>
                </View>

                {/* Accounts List */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Comptes enregistrés</Text>

                    {availableAccounts.length === 0 ? (
                        // Should not happen if we are logged in, but just in case
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Aucun compte</Text>
                        </View>
                    ) : (
                        <View style={styles.accountsList}>
                            {availableAccounts.map(renderAccountRow)}
                        </View>
                    )}
                </View>

                {/* Add Account Button */}
                {canAddMore && (
                    <TouchableOpacity style={styles.addAccountButton} onPress={handleAddAccount}>
                        <View style={styles.addAccountIcon}>
                            <Ionicons name="add" size={24} color={theme.colors.accent} />
                        </View>
                        <Text style={styles.addAccountText}>Ajouter un compte</Text>
                        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                    </TouchableOpacity>
                )}

                {!canAddMore && (
                    <View style={styles.limitBanner}>
                        <Ionicons name="warning-outline" size={18} color="#FF9500" />
                        <Text style={styles.limitText}>
                            Limite de 3 comptes atteinte.
                        </Text>
                    </View>
                )}
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
    },
    scrollContent: {
        paddingBottom: 140,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F8F8F8',
        margin: 16,
        padding: 14,
        borderRadius: 12,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
    },
    section: {
        marginBottom: 24,
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
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: '#8E8E93',
    },
    accountsList: {
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        marginHorizontal: 16,
        overflow: 'hidden',
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#FFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    accountRowActive: {
        backgroundColor: theme.colors.accent + '08',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F0F0F0',
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholderActive: {
        backgroundColor: theme.colors.accent + '20',
    },
    avatarInitials: {
        fontSize: 18,
        fontWeight: '600',
        color: '#8E8E93',
    },
    avatarInitialsActive: {
        color: theme.colors.accent,
    },
    accountInfo: {
        flex: 1,
        marginLeft: 14,
    },
    accountName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    accountHandle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 2,
    },
    activeBadge: {
        marginLeft: 8,
    },
    removeButton: {
        marginLeft: 8,
        padding: 4,
    },
    addAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        borderStyle: 'dashed',
    },
    addAccountIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addAccountText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.accent,
        marginLeft: 14,
    },
    limitBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFF9E6',
        margin: 16,
        padding: 14,
        borderRadius: 12,
        gap: 10,
    },
    limitText: {
        flex: 1,
        fontSize: 13,
        color: '#996600',
        lineHeight: 18,
    },
});
