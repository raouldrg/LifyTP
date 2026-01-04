import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    SafeAreaView,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { CalendarEvent } from '../types/events';
import { getEvents, apiEventToCalendarEvent } from '../services/eventService';
import { DEFAULT_THEMES, resolveEventColor, resolveTheme, UserTheme } from '../constants/eventThemes';
import { getAllThemes } from '../services/themeService';
import { EventEditSheet } from '../components/EventEditSheet';
import { updateEvent, deleteEvent as deleteEventApi } from '../services/eventService';

export default function MyEventsScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    // State
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const [allThemes, setAllThemes] = useState<UserTheme[]>(DEFAULT_THEMES);

    // Event Edit Sheet
    const [isSheetVisible, setSheetVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Hide tab bar when event sheet is visible
    useEffect(() => {
        const parent = navigation.getParent();
        if (isSheetVisible) {
            parent?.setOptions({ tabBarStyle: { display: 'none' } });
        } else {
            parent?.setOptions({ tabBarStyle: undefined });
        }
    }, [isSheetVisible, navigation]);

    // Load all events and themes
    useEffect(() => {
        loadAllEvents();
        getAllThemes().then(setAllThemes);
    }, []);

    const loadAllEvents = async () => {
        try {
            setIsLoading(true);
            // Load events for a wide range (1 year back and forward)
            const now = new Date();
            const from = new Date(now.getFullYear() - 1, 0, 1).toISOString();
            const to = new Date(now.getFullYear() + 1, 11, 31).toISOString();
            const apiEvents = await getEvents(from, to);
            const calendarEvents = apiEvents.map(apiEventToCalendarEvent);
            setEvents(calendarEvents);
        } catch (error) {
            console.error('[MY_EVENTS] Error loading events:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get unique themes from events (resolved names)
    const availableThemeNames = useMemo(() => {
        const themeNames = new Set<string>();
        events.forEach(e => {
            const resolved = resolveTheme(e, allThemes);
            themeNames.add(resolved.name);
        });
        return Array.from(themeNames);
    }, [events, allThemes]);

    // Filter events
    const filteredEvents = useMemo(() => {
        let result = [...events];

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(e =>
                e.title?.toLowerCase().includes(query) ||
                e.description?.toLowerCase().includes(query)
            );
        }

        // Filter by theme (using resolved name)
        if (selectedTheme) {
            result = result.filter(e => {
                const resolved = resolveTheme(e, allThemes);
                return resolved.name === selectedTheme;
            });
        }

        // Sort chronologically (most recent first)
        result.sort((a, b) => {
            const dateA = new Date(a.startAt).getTime();
            const dateB = new Date(b.startAt).getTime();
            return dateB - dateA;
        });

        return result;
    }, [events, searchQuery, selectedTheme]);

    // Format date for display
    const formatEventDate = (isoString: string) => {
        const date = new Date(isoString);
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('fr-FR', options);
    };

    // Handle event press
    const handleEventPress = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setSheetVisible(true);
    };

    // Handle save
    const handleSaveEvent = async (e: CalendarEvent) => {
        try {
            if (e.id) {
                await updateEvent(e.id, {
                    title: e.title,
                    description: e.description,
                    startAt: e.startAt,
                    endAt: e.endAt,
                    themeId: e.themeId,
                    colorHex: e.colorHex,
                });
            }
            loadAllEvents();
        } catch (error) {
            console.error('[MY_EVENTS] Error saving event:', error);
        }
    };

    // Handle delete
    const handleDeleteEvent = async (id: string) => {
        try {
            await deleteEventApi(id);
            loadAllEvents();
        } catch (error) {
            console.error('[MY_EVENTS] Error deleting event:', error);
        }
    };

    // Render event item
    const renderEventItem = ({ item }: { item: CalendarEvent }) => {
        const resolved = resolveTheme(item, allThemes);
        const eventColor = resolved.colorHex;
        const bgColor = eventColor + '20';

        return (
            <TouchableOpacity
                style={[styles.eventItem, { borderLeftColor: eventColor, backgroundColor: bgColor }]}
                onPress={() => handleEventPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.eventHeader}>
                    <Text style={[styles.eventTitle, { color: eventColor }]} numberOfLines={1}>
                        {item.title || 'Sans titre'}
                    </Text>
                    <View style={[styles.themeBadge, { backgroundColor: eventColor }]}>
                        <Text style={styles.themeBadgeText}>{resolved.name}</Text>
                    </View>
                </View>
                <Text style={styles.eventDate}>{formatEventDate(item.startAt)}</Text>
                {item.description ? (
                    <Text style={styles.eventDescription} numberOfLines={2}>
                        {item.description}
                    </Text>
                ) : null}
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
                <Text style={styles.headerTitle}>Mes événements</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher..."
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Theme Filters */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersContainer}
                contentContainerStyle={styles.filtersContent}
            >
                <TouchableOpacity
                    style={[styles.filterPill, !selectedTheme && styles.filterPillActive]}
                    onPress={() => setSelectedTheme(null)}
                >
                    <Text style={[styles.filterPillText, !selectedTheme && styles.filterPillTextActive]}>
                        Tous
                    </Text>
                </TouchableOpacity>
                {availableThemeNames.map((themeName: string) => (
                    <TouchableOpacity
                        key={themeName}
                        style={[styles.filterPill, selectedTheme === themeName && styles.filterPillActive]}
                        onPress={() => setSelectedTheme(selectedTheme === themeName ? null : themeName)}
                    >
                        <Text style={[styles.filterPillText, selectedTheme === themeName && styles.filterPillTextActive]}>
                            {themeName}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Events List */}
            <FlatList
                data={filteredEvents}
                renderItem={renderEventItem}
                keyExtractor={(item) => item.id || item.startAt}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={48} color="#CCC" />
                        <Text style={styles.emptyText}>
                            {isLoading ? 'Chargement...' : 'Aucun événement'}
                        </Text>
                    </View>
                }
            />

            {/* Event Edit Sheet */}
            {isSheetVisible && (
                <View style={styles.sheetOverlay}>
                    <EventEditSheet
                        visible={isSheetVisible}
                        event={selectedEvent}
                        onClose={() => setSheetVisible(false)}
                        onSave={handleSaveEvent}
                        onDelete={handleDeleteEvent}
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 8,
        paddingHorizontal: 12,
        height: 44,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    filtersContainer: {
        height: 50,
        marginTop: 8,
        flexGrow: 0,
    },
    filtersContent: {
        paddingHorizontal: 16,
        alignItems: 'center',
        height: 50,
    },
    filterPill: {
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    filterPillActive: {
        backgroundColor: '#FF7A45',
        borderColor: '#FF7A45',
    },
    filterPillText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#555',
    },
    filterPillTextActive: {
        color: '#FFF',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 100,
    },
    eventItem: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    eventHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    themeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    themeBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFF',
        textTransform: 'uppercase',
    },
    eventDate: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    eventDescription: {
        fontSize: 13,
        color: '#888',
        lineHeight: 18,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginTop: 12,
    },
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 200,
    },
});
