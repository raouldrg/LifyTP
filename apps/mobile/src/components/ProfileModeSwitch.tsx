import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface ProfileModeSwitchProps {
    mode: 'own' | 'tagged';
    onModeChange: (mode: 'own' | 'tagged') => void;
    style?: StyleProp<ViewStyle>;
}

export function ProfileModeSwitch({ mode, onModeChange, style }: ProfileModeSwitchProps) {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.switchWrapper}>
                {/* Mode 1: Lify */}
                <TouchableOpacity
                    style={styles.switchItem}
                    onPress={() => onModeChange('own')}
                >
                    <View style={styles.contentContainer}>
                        <View style={styles.logoContainer}>
                            <Text style={[styles.logoText, mode === 'own' && styles.activeLogoText]}>L</Text>
                            <View style={[styles.logoDot, mode === 'own' && styles.activeLogoDot]} />
                        </View>
                        {mode === 'own' && <View style={styles.underline} />}
                    </View>
                </TouchableOpacity>

                {/* Vertical Divider (Optional, removing for flat clean look) */}
                {/* <View style={styles.divider} /> */}

                {/* Mode 2: Tagged */}
                <TouchableOpacity
                    style={styles.switchItem}
                    onPress={() => onModeChange('tagged')}
                >
                    <View style={styles.contentContainer}>
                        <Ionicons
                            name="pricetag" // Solid when active usually better, keeping outline/filled logic if desired. Let's use name swap? Or color.
                            size={20}
                            color={mode === 'tagged' ? theme.colors.primary : '#CCC'}
                        />
                        {mode === 'tagged' && <View style={styles.underline} />}
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        // No padding, full width
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.03)',
    },
    switchWrapper: {
        flexDirection: 'row',
        width: '100%',
        height: 48, // Taller touch target
    },
    switchItem: {
        flex: 1, // 50% width
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: { // Holds content and underline
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        width: '100%', // clickable area
    },
    underline: {
        position: 'absolute',
        bottom: 0,
        height: 2, // Minimal underline
        width: '40%', // Not full width of item, just 40%
        backgroundColor: theme.colors.accent || '#FFA07A',
        borderRadius: 1,
    },
    // Logo Styles
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    logoText: {
        fontSize: 20, // Slightly larger
        fontWeight: '800',
        color: '#CCC',
        fontFamily: 'System',
    },
    activeLogoText: {
        color: theme.colors.primary,
    },
    logoDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CCC',
        marginLeft: 2,
    },
    activeLogoDot: {
        backgroundColor: theme.colors.accent || '#FFA07A',
    }
});
