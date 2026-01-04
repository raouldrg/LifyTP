import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { getInitial } from './Avatar';

interface DefaultAvatarPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelectColor: (color: string) => void;
    username?: string; // For preview
}

const PALETTE = [
    '#FF6B6B', '#FF8E72', '#FFA07A', '#F1C40F', '#F39C12',
    '#2ECC71', '#27AE60', '#1ABC9C', '#16A085', '#3498DB',
    '#2980B9', '#9B59B6', '#8E44AD', '#34495E', '#95A5A6',
    '#E74C3C', '#C0392B', '#D35400', '#7F8C8D', '#000000'
];

export default function DefaultAvatarPicker({
    visible,
    onClose,
    onSelectColor,
    username
}: DefaultAvatarPickerProps) {
    const initial = getInitial(username);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Choisir une couleur</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                <View style={styles.previewContainer}>
                    <View style={[styles.previewAvatar, { backgroundColor: '#E0E0E0' }]}>
                        <Text style={styles.previewText}>{initial}</Text>
                    </View>
                    <Text style={styles.previewLabel}>Aperçu : Sélectionnez une couleur</Text>
                </View>

                <ScrollView contentContainerStyle={styles.grid}>
                    {PALETTE.map((color) => (
                        <TouchableOpacity
                            key={color}
                            style={[styles.colorOption, { backgroundColor: color }]}
                            onPress={() => onSelectColor(color)}
                            activeOpacity={0.8}
                        >
                            {/* We could add checkmark if selected, but we don't track state here */}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
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
        padding: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#EEE',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    previewContainer: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: '#F9F9F9',
    },
    previewAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    previewText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#FFF',
    },
    previewLabel: {
        color: '#888',
        fontSize: 14,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 20,
        justifyContent: 'center',
        gap: 20,
    },
    colorOption: {
        width: 60,
        height: 60,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    }
});
