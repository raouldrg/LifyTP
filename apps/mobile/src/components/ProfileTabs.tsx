import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface ProfileTabsProps {
    activeTab: 'timeline' | 'info';
    onTabChange: (tab: 'timeline' | 'info') => void;
}

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
    return (
        <View style={styles.container}>
            <View style={styles.tabsWrapper}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'timeline' && styles.activeTab]}
                    onPress={() => onTabChange('timeline')}
                >
                    <Text style={[styles.tabText, activeTab === 'timeline' && styles.activeTabText]}>Timeline</Text>
                    {activeTab === 'timeline' && <View style={styles.activeDot} />}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'info' && styles.activeTab]}
                    onPress={() => onTabChange('info')}
                >
                    <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Infos</Text>
                    {activeTab === 'info' && <View style={styles.activeDot} />}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        alignItems: 'center',
    },
    tabsWrapper: {
        flexDirection: 'row',
        backgroundColor: '#FAFAFA', // Subtle pill container bg? Or just clean
        borderRadius: 20,
        padding: 4,
        gap: 8,
    },
    tab: {
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    activeTab: {
        backgroundColor: '#FFF', // Card like lift? Or just text. Let's go minimal text + dot.
        // Actually user asked for "Pill segmented control"
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#999',
    },
    activeTabText: {
        color: theme.colors.primary, // #1A1A1A
        fontWeight: '700',
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFA07A', // Accent
        marginTop: 4,
    }
});
