import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';

export default function LikedItemsScreen() {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Éléments likés</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Ionicons name="heart-outline" size={64} color={theme.colors.accent} />
                <Text style={styles.title}>Bientôt disponible</Text>
                <Text style={styles.subtitle}>
                    Vos éléments favoris apparaîtront ici dans une prochaine mise à jour.
                </Text>
            </View>
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
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#000',
        marginTop: 20,
    },
    subtitle: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22,
    },
});
