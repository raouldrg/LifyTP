import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    SafeAreaView,
    ScrollView,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme';

interface ProfileAvatarPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (url: string | null, color: string | null) => void;
    currentAvatarUrl?: string | null;
    currentAvatarColor?: string | null;
    username?: string;
}

const DEFAULT_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB',
    '#E67E22', '#2ECC71', '#1ABC9C', '#34495E'
];

export default function ProfileAvatarPickerModal({
    visible,
    onClose,
    onSave,
    currentAvatarUrl,
    currentAvatarColor,
    username
}: ProfileAvatarPickerModalProps) {
    const [mode, setMode] = useState<'image' | 'default'>('image');
    const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
    const [tempColor, setTempColor] = useState<string>(DEFAULT_COLORS[0]);

    // Initialize state when modal opens
    useEffect(() => {
        if (visible) {
            // User requested to always land on Default Avatar view
            setMode('default');
            setTempColor(currentAvatarColor || DEFAULT_COLORS[0]);

            // If there is an existing image, we store it in temp in case they switch to "Photo" tab
            if (currentAvatarUrl) {
                setTempAvatarUrl(currentAvatarUrl);
            } else {
                setTempAvatarUrl(null);
            }
        }
    }, [visible, currentAvatarUrl, currentAvatarColor]);

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Nous avons besoin d\'accéder à vos photos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setTempAvatarUrl(result.assets[0].uri);
            setMode('image');
        }
    };

    const handleSave = () => {
        if (mode === 'image') {
            // If mode is image but no URL (shouldn't happen if UI logic is strict, but safety check)
            // If user explicitly picked 'image' but has no image, maybe fallback to default?
            // But lets assume if they picked image mode they want the image.
            onSave(tempAvatarUrl, null); // Color null when using image? Or keep it? Request said "Colors ignored at display" but mostly we can just pass null to be clean or keep backend logic handling. Plan said "Color always kept but ignored". Let's update implementation plan logic: "Photo = profilePictureUrl = URL". 
        } else {
            // Default mode
            onSave(null, tempColor);
        }
        onClose();
    };

    const hasChanges = () => {
        if (mode === 'image') {
            return tempAvatarUrl !== currentAvatarUrl;
        } else {
            // mode default
            // Changed if it was image before OR if color is different
            return !!currentAvatarUrl || tempColor !== currentAvatarColor;
        }
    };

    // Determine what to show in preview
    const previewUrl = mode === 'image' ? tempAvatarUrl : null;
    const previewColor = mode === 'default' ? tempColor : null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet" // iOS native sheet look, nice on phones
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Photo de profil</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>

                    {/* Preview Block */}
                    <View style={styles.previewContainer}>
                        <View style={styles.previewCircle}>
                            {previewUrl ? (
                                <Image source={{ uri: previewUrl }} style={styles.previewImage} />
                            ) : (
                                <View style={[styles.previewPlaceholder, { backgroundColor: previewColor || theme.colors.accent }]}>
                                    <Text style={styles.previewInitials}>
                                        {(username || 'U').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.previewLabel}>Aperçu</Text>
                    </View>

                    {/* Mode Selection Cards */}
                    <View style={styles.cardsContainer}>
                        <TouchableOpacity
                            style={[
                                styles.optionCard,
                                mode === 'default' && styles.optionCardSelected
                            ]}
                            onPress={() => setMode('default')}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons
                                    name="person-outline"
                                    size={24}
                                    color={mode === 'default' ? theme.colors.accent : '#000'}
                                />
                                {mode === 'default' && (
                                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                                )}
                            </View>
                            <Text style={[styles.cardTitle, mode === 'default' && styles.cardTitleSelected]}>
                                Avatar par défaut
                            </Text>
                            <Text style={styles.cardSubtitle}>Lettre & Couleur</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.optionCard,
                                mode === 'image' && styles.optionCardSelected
                            ]}
                            onPress={handlePickImage}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons
                                    name="image-outline"
                                    size={24}
                                    color={mode === 'image' ? theme.colors.accent : '#000'}
                                />
                                {mode === 'image' && (
                                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                                )}
                            </View>
                            <Text style={[styles.cardTitle, mode === 'image' && styles.cardTitleSelected]}>
                                Choisir une photo
                            </Text>
                            <Text style={styles.cardSubtitle}>Depuis la galerie</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Color Grid - Only if Default Mode */}
                    {mode === 'default' && (
                        <View style={styles.colorSection}>
                            <Text style={styles.sectionTitle}>Couleur de fond</Text>
                            <View style={styles.colorGrid}>
                                {DEFAULT_COLORS.map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[
                                            styles.colorOption,
                                            { backgroundColor: color },
                                            tempColor === color && styles.colorOptionSelected
                                        ]}
                                        onPress={() => setTempColor(color)}
                                    >
                                        {tempColor === color && (
                                            <Ionicons name="checkmark" size={20} color="#FFF" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, !hasChanges() && mode === 'default' && !currentAvatarUrl && styles.saveButtonDisabled]} // Disable if no change roughly speaking, but "Done" is fine too.
                        onPress={handleSave}
                    >
                        <Text style={styles.saveButtonText}>
                            Enregistrer
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5EA',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    previewContainer: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    previewCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        backgroundColor: '#FFF'
    },
    previewImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    previewPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewInitials: {
        fontSize: 48,
        fontWeight: '600',
        color: '#FFF',
    },
    previewLabel: {
        fontSize: 14,
        color: '#8E8E93',
        fontWeight: '500',
    },
    cardsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 30,
    },
    optionCard: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionCardSelected: {
        backgroundColor: '#FFF',
        borderColor: theme.colors.accent,
        shadowColor: theme.colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
    },
    cardTitleSelected: {
        color: theme.colors.accent,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
    },
    colorSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1C1C1E',
        marginBottom: 16,
        marginLeft: 4,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    colorOption: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorOptionSelected: {
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    footer: {
        padding: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E5EA',
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '600',
    }
});
