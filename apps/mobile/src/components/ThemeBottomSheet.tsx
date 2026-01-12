import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

const COLOR_PALETTE = [
    '#FF9F6E', '#5B8DEF', '#6FCF97', '#F2C94C', '#EB5757',
    '#56CCF2', '#9B51E0', '#F4A6B8', '#AFCBFF', '#B7E4C7',
    '#F5E6CC', '#D7C6F2', '#A8E6CF', '#E0E0E0', '#BDBDBD',
];

interface ThemeBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onCreateTheme: (name: string, color: string) => void;
    existingThemeNames: string[];
}

export default function ThemeBottomSheet({
    visible,
    onClose,
    onCreateTheme,
    existingThemeNames
}: ThemeBottomSheetProps) {
    const [themeName, setThemeName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
    const [error, setError] = useState('');

    const handleCreate = () => {
        const trimmed = themeName.trim();

        // Validation: min 2 chars
        if (trimmed.length < 2) {
            setError('Le nom doit contenir au moins 2 caractères');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        // Validation: no duplicate (case-insensitive)
        const exists = existingThemeNames.some(
            name => name.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) {
            setError('Ce thème existe déjà');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        // Create theme
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCreateTheme(trimmed, selectedColor);
        handleClose();
    };

    const handleClose = () => {
        setThemeName('');
        setSelectedColor(COLOR_PALETTE[0]);
        setError('');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <Pressable style={styles.overlay} onPress={handleClose}>
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                </Pressable>

                <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
                    {/* Drag handle */}
                    <View style={styles.handle} />

                    {/* Title */}
                    <Text style={styles.title}>Nouveau thème</Text>

                    {/* Name input */}
                    <Text style={styles.label}>Nom du thème</Text>
                    <TextInput
                        style={[styles.input, error ? styles.inputError : null]}
                        value={themeName}
                        onChangeText={(text) => {
                            setThemeName(text);
                            setError('');
                        }}
                        placeholder="Ex: MMA, Concert, Études..."
                        placeholderTextColor="#B0B0B0"
                        maxLength={20}
                        returnKeyType="done"
                        onSubmitEditing={handleCreate}
                    />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    {/* Color picker */}
                    <Text style={[styles.label, { marginTop: 20 }]}>Couleur</Text>
                    <View style={styles.colorGrid}>
                        {COLOR_PALETTE.map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[
                                    styles.colorDot,
                                    { backgroundColor: color },
                                    selectedColor === color && styles.colorDotSelected,
                                ]}
                                onPress={() => {
                                    setSelectedColor(color);
                                    Haptics.selectionAsync();
                                }}
                            >
                                {selectedColor === color && (
                                    <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={handleClose}
                        >
                            <Text style={styles.buttonTextSecondary}>Annuler</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.buttonPrimary]}
                            onPress={handleCreate}
                        >
                            <Text style={styles.buttonTextPrimary}>Créer</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        elevation: 10,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 24,
        textAlign: 'center',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1A1A1A',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    inputError: {
        borderColor: '#EB5757',
    },
    errorText: {
        color: '#EB5757',
        fontSize: 13,
        marginTop: 6,
        marginLeft: 4,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 28,
    },
    colorDot: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorDotSelected: {
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonSecondary: {
        backgroundColor: '#F0F0F0',
    },
    buttonPrimary: {
        backgroundColor: theme.colors.accent,
        shadowColor: theme.colors.accent,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    buttonTextSecondary: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    buttonTextPrimary: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
});
