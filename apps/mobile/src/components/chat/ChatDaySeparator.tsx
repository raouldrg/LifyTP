/**
 * ChatDaySeparator - Displays day separators between messages
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isToday, isYesterday, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChatDaySeparatorProps {
    date: Date;
}

export function ChatDaySeparator({ date }: ChatDaySeparatorProps) {
    const getDateLabel = () => {
        if (isToday(date)) return "Aujourd'hui";
        if (isYesterday(date)) return 'Hier';
        return format(date, 'EEE d MMM', { locale: fr });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.text}>{getDateLabel()}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    text: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        // No background, no padding, no border - just text
    },
});

