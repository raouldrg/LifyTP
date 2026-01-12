import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const GRID_COLUMNS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - (GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS;

interface PhotoGridProps {
    photos: string[]; // Array of local URIs or URLs
    onAdd: () => void;
    onRemove: (index: number) => void;
    maxPhotos?: number;
}

export default function PhotoGrid({ photos, onAdd, onRemove, maxPhotos = 10 }: PhotoGridProps) {
    const canAddMore = photos.length < maxPhotos;

    const handleAdd = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onAdd();
    };

    const handleRemove = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onRemove(index);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="images-outline" size={20} color="#666" />
                    <Text style={styles.headerTitle}>Photos</Text>
                </View>
                <Text style={styles.counter}>
                    {photos.length}/{maxPhotos}
                </Text>
            </View>

            {/* Grid */}
            <View style={styles.grid}>
                {/* Existing photos */}
                {photos.map((uri, index) => (
                    <View key={`photo-${index}`} style={styles.photoContainer}>
                        <Image source={{ uri }} style={styles.photo} />
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemove(index)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View style={styles.removeButtonInner}>
                                <Ionicons name="close" size={16} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Add button (if space available) */}
                {canAddMore && (
                    <TouchableOpacity
                        key="add-button"
                        style={[styles.photoContainer, styles.addButton]}
                        onPress={handleAdd}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add" size={32} color="#CCC" />
                        <Text style={styles.addText}>Ajouter</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Helper text */}
            {photos.length === 0 && (
                <Text style={styles.helperText}>
                    Ajoutez jusqu'à {maxPhotos} photos pour votre événement
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    counter: {
        fontSize: 15,
        fontWeight: '500',
        color: '#999',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GRID_GAP,
    },
    photoContainer: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    photo: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F5F5F5',
    },
    removeButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        zIndex: 10,
    },
    removeButtonInner: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButton: {
        backgroundColor: '#F8F8F8',
        borderWidth: 2,
        borderColor: '#E5E5E5',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#999',
        marginTop: 4,
    },
    helperText: {
        fontSize: 13,
        color: '#999',
        marginTop: 8,
        textAlign: 'center',
    },
});
