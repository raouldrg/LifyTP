import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    TextInput,
    Image,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api, resolveImageUrl, uploadAvatar } from '../services/api';
import { theme } from '../theme';
import ProfileAvatarPickerModal from '../components/profile/ProfileAvatarPickerModal';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { user, refreshUser } = useAuth();

    // Form state
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
    const [avatarChanged, setAvatarChanged] = useState(false);
    const [username, setUsername] = useState(user?.username || '');  // @ handle
    const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');  // Pseudo
    const [bio, setBio] = useState(user?.bio || '');
    const [isSaving, setIsSaving] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [avatarColor, setAvatarColor] = useState(user?.avatarColor || null);

    // Original values for comparison
    const originalUsername = user?.username || '';
    const originalDisplayName = user?.displayName || user?.username || '';
    const originalBio = user?.bio || '';
    const originalAvatarUrl = user?.avatarUrl || '';

    // Cooldown calculations from server data
    const lastUsernameChange = user?.lastUsernameChange
        ? new Date(user.lastUsernameChange).getTime()
        : null;
    const lastDisplayNameChange = user?.lastDisplayNameChange
        ? new Date(user.lastDisplayNameChange).getTime()
        : null;

    const canChangeUsername = useMemo(() => {
        if (!lastUsernameChange) return true;
        return Date.now() - lastUsernameChange > SIX_MONTHS_MS;
    }, [lastUsernameChange]);

    const canChangeDisplayName = useMemo(() => {
        if (!lastDisplayNameChange) return true;
        return Date.now() - lastDisplayNameChange > ONE_DAY_MS;
    }, [lastDisplayNameChange]);

    const getNextUsernameChangeDate = () => {
        if (!lastUsernameChange) return null;
        const nextDate = new Date(lastUsernameChange + SIX_MONTHS_MS);
        const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return { date: nextDate, daysLeft };
    };

    const getNextDisplayNameChangeDate = () => {
        if (!lastDisplayNameChange) return null;
        const nextDate = new Date(lastDisplayNameChange + ONE_DAY_MS);
        const hoursLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60));
        return { date: nextDate, hoursLeft };
    };

    // Check if there are any changes
    const hasChanges = useMemo(() => {
        return (
            avatarChanged ||
            username !== originalUsername ||
            displayName !== originalDisplayName ||
            bio !== originalBio ||
            avatarColor !== (user?.avatarColor || null)
        );
    }, [avatarChanged, username, originalUsername, displayName, originalDisplayName, bio, originalBio, avatarColor]);

    // Check if any change is blocked
    const hasBlockedChanges = useMemo(() => {
        const usernameChanged = username !== originalUsername;
        const displayNameChanged = displayName !== originalDisplayName;

        return (usernameChanged && !canChangeUsername) ||
            (displayNameChanged && !canChangeDisplayName);
    }, [username, originalUsername, displayName, originalDisplayName, canChangeUsername, canChangeDisplayName]);

    const canSave = hasChanges && !hasBlockedChanges && !isSaving;

    const handleAvatarSave = (url: string | null, color: string | null) => {
        if (url) {
            // User picked an image
            setAvatarUrl(url);
            setAvatarColor(null);
            setAvatarChanged(true);
        } else {
            // User picked default (or just removed image)
            setAvatarUrl('');
            setAvatarColor(color);
            setAvatarChanged(false); // Because we don't need to upload a file, we just save the color
            // However, we need to make sure 'avatarUrl' state reflects emptiness so UI updates.
        }
        // Note: hasChanges will recalculate based on these new values vs original
    };

    const handleSave = async () => {
        if (!canSave) return;

        // Validate
        if (!displayName.trim()) {
            Alert.alert('Erreur', 'Le pseudo ne peut pas être vide.');
            return;
        }

        if (bio.length > 250) {
            Alert.alert('Erreur', 'La description ne peut pas dépasser 250 caractères.');
            return;
        }

        const usernameChanged = username !== originalUsername;
        const displayNameChanged = displayName !== originalDisplayName;

        // Warning for username (handle) change
        if (usernameChanged) {
            Alert.alert(
                '⚠️ Attention',
                'Vous êtes sur le point de modifier votre @. Cette action ne sera possible qu\'une fois tous les 6 mois.\n\nÊtes-vous sûr de vouloir continuer ?',
                [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Confirmer', style: 'destructive', onPress: () => performSave() }
                ]
            );
        } else {
            performSave();
        }
    };

    const performSave = async () => {
        setIsSaving(true);
        try {
            let newAvatarUrl: string | null | undefined = user?.avatarUrl;

            // 1. Handle File Upload if changed (and exists)
            if (avatarChanged && avatarUrl && avatarUrl.startsWith('file://')) {
                try {
                    const uploadResult = await uploadAvatar(avatarUrl);
                    if (uploadResult?.url) {
                        newAvatarUrl = uploadResult.url;
                        // Directly update avatarUrl API separate from other profile data?
                        // The original code did: api.post('/auth/onboarding/update', { avatarUrl })
                        // Let's stick to that for the upload part.
                        await api.post('/auth/onboarding/update', { avatarUrl: newAvatarUrl });
                    }
                } catch (e) {
                    console.error('Avatar upload failed:', e);
                    Alert.alert('Erreur', 'Impossible de télécharger la photo.');
                    setIsSaving(false);
                    return;
                }
            }
            // 2. Handle Avatar Removal (user cleared it or picked color)
            else if (!avatarUrl && user?.avatarUrl) {
                // User removed the photo (or picked color which cleared it)
                newAvatarUrl = null;
                // We need to send this update.
                // We can do it in the main patch call or separate. 
                // Let's do it in main patch to be atomic if possible, but /users/me supports it.
            }

            // Build update payload
            const updateData: any = {};

            if (bio !== originalBio) {
                updateData.bio = bio;
            }

            if (username !== originalUsername) {
                updateData.username = username;
            }

            if (displayName !== originalDisplayName) {
                updateData.displayName = displayName;
            }

            // Check if avatarUrl needs update in the main payload (removal or just ensuring sync)
            if (newAvatarUrl !== user?.avatarUrl) {
                updateData.avatarUrl = newAvatarUrl;
            }

            // Check avatarColor
            if (avatarColor !== user?.avatarColor) {
                updateData.avatarColor = avatarColor;
            }

            // Only call API if there's data to update
            if (Object.keys(updateData).length > 0) {
                await api.patch('/users/me', updateData);
            }

            // Refresh user data
            await refreshUser();

            Alert.alert('Succès', 'Votre profil a été mis à jour.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            console.error('Failed to save profile:', error);
            const message = error.response?.data?.error || 'Impossible de sauvegarder le profil.';
            Alert.alert('Erreur', message);
        } finally {
            setIsSaving(false);
        }
    };

    const resolvedAvatarUrl = avatarChanged ? avatarUrl : resolveImageUrl(avatarUrl);
    const usernameInfo = getNextUsernameChangeDate();
    const displayNameInfo = getNextDisplayNameChangeDate();

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Modifier le profil</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                    disabled={!canSave}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                        <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
                            Enregistrer
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Avatar Section */}
                    <View style={styles.avatarSection}>
                        <TouchableOpacity onPress={() => setShowAvatarModal(true)} style={styles.avatarContainer}>
                            {resolvedAvatarUrl ? (
                                <Image source={{ uri: resolvedAvatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, avatarColor ? { backgroundColor: avatarColor } : {}]}>
                                    <Text style={styles.avatarInitials}>
                                        {(displayName || username || 'U').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.editBadge}>
                                <Ionicons name="camera" size={14} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.avatarHint}>Appuyez pour changer la photo</Text>
                        <Text style={styles.avatarNoLimit}>✓ Modifiable sans limite</Text>
                    </View>

                    {/* Form Fields */}
                    <View style={styles.formSection}>
                        {/* Username (@) - 6 month cooldown */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.fieldHeader}>
                                <Text style={styles.fieldLabel}>Nom d'utilisateur (@)</Text>
                                {!canChangeUsername && (
                                    <View style={styles.lockedBadge}>
                                        <Ionicons name="lock-closed" size={12} color="#8E8E93" />
                                        <Text style={styles.lockedText}>6 mois</Text>
                                    </View>
                                )}
                            </View>
                            <View style={[styles.inputContainer, !canChangeUsername && styles.inputLocked]}>
                                <Text style={styles.atSymbol}>@</Text>
                                <TextInput
                                    style={styles.input}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="username"
                                    placeholderTextColor="#C7C7CC"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={canChangeUsername}
                                />
                            </View>
                            {!canChangeUsername && usernameInfo && (
                                <Text style={styles.fieldHintLocked}>
                                    🔒 Prochaine modification dans {usernameInfo.daysLeft} jours
                                </Text>
                            )}
                            {canChangeUsername && (
                                <Text style={styles.fieldWarning}>
                                    ⚠️ Modifiable 1 fois tous les 6 mois
                                </Text>
                            )}
                        </View>

                        {/* Display Name (Pseudo) - 1 day cooldown */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.fieldHeader}>
                                <Text style={styles.fieldLabel}>Pseudo</Text>
                                {!canChangeDisplayName && (
                                    <View style={styles.lockedBadge}>
                                        <Ionicons name="lock-closed" size={12} color="#8E8E93" />
                                        <Text style={styles.lockedText}>24h</Text>
                                    </View>
                                )}
                            </View>
                            <View style={[styles.inputContainer, !canChangeDisplayName && styles.inputLocked]}>
                                <TextInput
                                    style={[styles.input, { paddingLeft: 0 }]}
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                    placeholder="Votre pseudo"
                                    placeholderTextColor="#C7C7CC"
                                    editable={canChangeDisplayName}
                                />
                            </View>
                            {!canChangeDisplayName && displayNameInfo && (
                                <Text style={styles.fieldHintLocked}>
                                    🔒 Prochaine modification dans {displayNameInfo.hoursLeft}h
                                </Text>
                            )}
                            {canChangeDisplayName && (
                                <Text style={styles.fieldHint}>
                                    ℹ️ Modifiable 1 fois par jour
                                </Text>
                            )}
                        </View>

                        {/* Bio - No limit */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.fieldHeader}>
                                <Text style={styles.fieldLabel}>Description</Text>
                                <Text style={[styles.charCount, bio.length > 250 && styles.charCountOver]}>
                                    {bio.length}/250
                                </Text>
                            </View>
                            <View style={styles.textAreaContainer}>
                                <TextInput
                                    style={styles.textArea}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="Parlez de vous..."
                                    placeholderTextColor="#C7C7CC"
                                    multiline
                                    numberOfLines={4}
                                    maxLength={250}
                                    textAlignVertical="top"
                                />
                            </View>
                            <Text style={styles.fieldHintSuccess}>
                                ✓ Modifiable sans limite
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <ProfileAvatarPickerModal
                visible={showAvatarModal}
                onClose={() => setShowAvatarModal(false)}
                onSave={handleAvatarSave}
                currentAvatarUrl={avatarUrl || null} // pass current local state, which might be ''
                currentAvatarColor={avatarColor}
                username={username || user?.username}
            />
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
    saveButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.accent,
    },
    saveButtonTextDisabled: {
        color: '#C7C7CC',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 140,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.colors.accent + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        fontSize: 36,
        fontWeight: '600',
        color: theme.colors.accent,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    avatarHint: {
        marginTop: 12,
        fontSize: 14,
        color: '#8E8E93',
    },
    avatarNoLimit: {
        marginTop: 4,
        fontSize: 12,
        color: '#34C759',
    },
    formSection: {
        paddingHorizontal: 20,
    },
    fieldContainer: {
        marginBottom: 28,
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    fieldLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    lockedText: {
        fontSize: 11,
        color: '#8E8E93',
        marginLeft: 4,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
    },
    inputLocked: {
        backgroundColor: '#F0F0F0',
    },
    atSymbol: {
        fontSize: 16,
        color: '#8E8E93',
        marginRight: 2,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        paddingLeft: 0,
    },
    fieldHint: {
        marginTop: 8,
        fontSize: 12,
        color: '#8E8E93',
    },
    fieldHintLocked: {
        marginTop: 8,
        fontSize: 12,
        color: '#E74C3C',
    },
    fieldHintSuccess: {
        marginTop: 8,
        fontSize: 12,
        color: '#34C759',
    },
    fieldWarning: {
        marginTop: 8,
        fontSize: 12,
        color: '#FF9500',
    },
    charCount: {
        fontSize: 13,
        color: '#8E8E93',
    },
    charCountOver: {
        color: '#E74C3C',
    },
    textAreaContainer: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 14,
        minHeight: 120,
    },
    textArea: {
        fontSize: 16,
        color: '#000',
        lineHeight: 22,
        minHeight: 90,
    },
});
