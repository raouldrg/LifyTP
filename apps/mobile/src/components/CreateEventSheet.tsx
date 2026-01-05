import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet,
    TextInput, TouchableOpacity, Pressable,
    KeyboardAvoidingView, Platform, ScrollView, FlatList,
    Keyboard, Modal, Dimensions, Switch
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../theme';
import { CalendarEvent } from '../types/events';
import { UserTheme, DEFAULT_THEMES } from '../constants/eventThemes';
import { getAllThemes } from '../services/themeService';
import * as Haptics from 'expo-haptics';

// ============================================================
// TYPES
// ============================================================

interface CreateEventSheetProps {
    visible: boolean;
    initialDate?: Date;
    initialTime?: string;
    onClose: () => void;
    onSave: (event: CalendarEvent) => void;
}

type DurationPreset = '15m' | '30m' | '45m' | '1h' | '1h30' | '2h' | 'custom';
type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type VisibilityType = 'private' | 'friends' | 'public';

const DURATION_PRESETS: { key: DurationPreset; label: string; minutes: number }[] = [
    { key: '15m', label: '15m', minutes: 15 },
    { key: '30m', label: '30m', minutes: 30 },
    { key: '45m', label: '45m', minutes: 45 },
    { key: '1h', label: '1h', minutes: 60 },
    { key: '1h30', label: '1h30', minutes: 90 },
    { key: '2h', label: '2h', minutes: 120 },
];

const RECURRENCE_OPTIONS: { key: RecurrenceType; label: string }[] = [
    { key: 'daily', label: 'Quotidien' },
    { key: 'weekly', label: 'Hebdo' },
    { key: 'monthly', label: 'Mensuel' },
    { key: 'yearly', label: 'Annuel' },
];

const FOOTER_HEIGHT = 90;
const RECENT_THEMES_KEY = '@lify/recent_theme_ids';
const DATE_ITEM_WIDTH = 70; // Width of each date pill

// Generate date array around a center date
const generateDateRange = (centerDate: Date, daysBack: number, daysForward: number) => {
    const days: { date: Date; key: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = -daysBack; i <= daysForward; i++) {
        const d = new Date(centerDate);
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);
        days.push({ date: d, key: d.toISOString() });
    }
    return days;
};

// ============================================================
// COMPONENT
// ============================================================

export function CreateEventSheet({ visible, initialDate, initialTime, onClose, onSave }: CreateEventSheetProps) {
    const insets = useSafeAreaInsets();
    const dateListRef = useRef<FlatList>(null);
    const titleInputRef = useRef<TextInput>(null);

    // ============================================================
    // FORM STATE
    // ============================================================
    const [title, setTitle] = useState('');
    const [availableThemes, setAvailableThemes] = useState<UserTheme[]>(DEFAULT_THEMES);
    const [recentThemeIds, setRecentThemeIds] = useState<string[]>([]);
    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dateRange, setDateRange] = useState(() => generateDateRange(new Date(), 30, 90));
    const [startTime, setStartTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<DurationPreset>('30m');
    const [customDurationMinutes, setCustomDurationMinutes] = useState(60);
    const [showCustomDuration, setShowCustomDuration] = useState(false);
    const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
    const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly');
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [visibility, setVisibility] = useState<VisibilityType>('private');
    const [monthOverlay, setMonthOverlay] = useState<string | null>(null);
    const monthOverlayTimeout = useRef<NodeJS.Timeout | null>(null);

    // ============================================================
    // SORTED THEMES - Recent first
    // ============================================================
    const sortedThemes = useMemo(() => {
        const recent: UserTheme[] = [];
        const others: UserTheme[] = [];

        for (const theme of availableThemes) {
            if (recentThemeIds.includes(theme.id)) {
                recent.push(theme);
            } else {
                others.push(theme);
            }
        }

        // Sort recent by order in recentThemeIds
        recent.sort((a, b) => recentThemeIds.indexOf(a.id) - recentThemeIds.indexOf(b.id));

        return [...recent, ...others];
    }, [availableThemes, recentThemeIds]);

    // ============================================================
    // COMPUTED VALUES
    // ============================================================
    const durationMinutes = useMemo(() => {
        if (selectedDuration === 'custom') return customDurationMinutes;
        return DURATION_PRESETS.find(p => p.key === selectedDuration)?.minutes || 30;
    }, [selectedDuration, customDurationMinutes]);

    const { startDateTime, endDateTime } = useMemo(() => {
        const start = new Date(selectedDate);
        start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        return { startDateTime: start, endDateTime: end };
    }, [selectedDate, startTime, durationMinutes]);

    const recapText = useMemo(() => {
        const dayName = startDateTime.toLocaleDateString('fr-FR', { weekday: 'short' });
        const datePart = startDateTime.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const startStr = startDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const endStr = endDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const h = Math.floor(durationMinutes / 60);
        const m = durationMinutes % 60;
        const durationStr = h > 0 ? (m > 0 ? `${h}h${m}` : `${h}h`) : `${m}min`;

        return `${dayName} ${datePart} · ${startStr} → ${endStr} · ${durationStr}`;
    }, [startDateTime, endDateTime, durationMinutes]);

    const isValidDuration = durationMinutes >= 5 && durationMinutes <= 7 * 24 * 60;
    const canSave = title.trim().length > 0 && isValidDuration;

    // ============================================================
    // INITIALIZATION
    // ============================================================
    useEffect(() => {
        if (visible) {
            // Load themes and recent theme IDs
            Promise.all([
                getAllThemes(),
                AsyncStorage.getItem(RECENT_THEMES_KEY)
            ]).then(([themes, recentJson]) => {
                setAvailableThemes(themes);
                if (recentJson) {
                    try {
                        setRecentThemeIds(JSON.parse(recentJson));
                    } catch { }
                }
            });

            // Set initial date and generate range around it
            const initial = initialDate || new Date();
            setSelectedDate(initial);
            setDateRange(generateDateRange(initial, 30, 90));

            if (initialTime) {
                const [h, m] = initialTime.split(':').map(Number);
                const time = new Date();
                time.setHours(h, m, 0, 0);
                setStartTime(time);
            }

            setTitle('');
            setSelectedThemeId(null);
            setSelectedDuration('30m');
            setRecurrenceEnabled(false);
            setDetailsExpanded(false);
            setDescription('');
            setLocation('');
            setShowTimePicker(false);

            // Scroll to selected date and autofocus
            setTimeout(() => {
                // Find index of selected date (it's at position 30 since we generate -30 to +90)
                dateListRef.current?.scrollToIndex({ index: 30, animated: false, viewPosition: 0 });
                titleInputRef.current?.focus();
            }, 200);
        }
    }, [visible, initialDate, initialTime]);

    // ============================================================
    // HANDLERS
    // ============================================================
    const handleClose = useCallback(() => {
        Keyboard.dismiss();
        setShowTimePicker(false);
        onClose();
    }, [onClose]);

    const dismissKeyboardAndPicker = useCallback(() => {
        Keyboard.dismiss();
        setShowTimePicker(false);
    }, []);

    // Save theme as recent when selected
    const handleThemeSelect = useCallback(async (themeId: string) => {
        const newId = selectedThemeId === themeId ? null : themeId;
        setSelectedThemeId(newId);
        Haptics.selectionAsync();

        if (newId) {
            // Add to recent, dedupe, limit to 6
            const updated = [newId, ...recentThemeIds.filter(id => id !== newId)].slice(0, 6);
            setRecentThemeIds(updated);
            await AsyncStorage.setItem(RECENT_THEMES_KEY, JSON.stringify(updated));
        }
    }, [selectedThemeId, recentThemeIds]);

    // Handle month change overlay
    const handleDateViewableChange = useCallback(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const firstVisible = viewableItems[0].item.date as Date;
            const monthLabel = firstVisible.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

            setMonthOverlay(prev => {
                if (prev !== monthLabel) {
                    // Clear existing timeout
                    if (monthOverlayTimeout.current) clearTimeout(monthOverlayTimeout.current);
                    // Hide after 2s
                    monthOverlayTimeout.current = setTimeout(() => setMonthOverlay(null), 2000);
                    return monthLabel;
                }
                return prev;
            });
        }
    }, []);

    const handleTimeChange = useCallback((_: any, date?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (date) {
            // Round to nearest 5 minutes
            const minutes = Math.round(date.getMinutes() / 5) * 5;
            date.setMinutes(minutes);
            setStartTime(date);
        }
    }, []);

    const handleSave = useCallback(() => {
        if (!canSave) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const selectedTheme = availableThemes.find(t => t.id === selectedThemeId);

        const newEvent: CalendarEvent = {
            userId: 'current',
            title: title.trim(),
            description: description.trim() || undefined,
            theme: selectedTheme?.name || 'Autre',
            color: selectedTheme?.colorHex || '#BDBDBD',
            themeId: selectedThemeId || undefined,
            colorHex: selectedTheme?.colorHex || undefined,
            startAt: startDateTime.toISOString(),
            endAt: endDateTime.toISOString(),
            dayIndex: (startDateTime.getDay() + 6) % 7,
        };

        onSave(newEvent);
        handleClose();
    }, [canSave, title, description, selectedThemeId, availableThemes, startDateTime, endDateTime, onSave, handleClose]);

    // Render date item for FlatList
    const renderDateItem = useCallback(({ item }: { item: { date: Date; key: string } }) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        const selectedNorm = new Date(selectedDate);
        selectedNorm.setHours(0, 0, 0, 0);

        const isToday = itemDate.getTime() === today.getTime();
        const isSelected = itemDate.getTime() === selectedNorm.getTime();
        const label = isToday ? "Auj." : item.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

        return (
            <TouchableOpacity
                onPress={() => {
                    setSelectedDate(item.date);
                    Haptics.selectionAsync();
                }}
                style={[
                    styles.datePill,
                    isSelected && styles.datePillSelected,
                    isToday && !isSelected && styles.datePillToday
                ]}
            >
                <Text style={[styles.datePillText, isSelected && styles.datePillTextSelected]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    }, [selectedDate]);

    // ============================================================
    // RENDER
    // ============================================================
    if (!visible) return null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Close button - top right */}
            <TouchableOpacity
                style={[styles.closeBtn, { top: insets.top + 12 }]}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex1}
                keyboardVerticalOffset={0}
            >
                <Pressable style={styles.flex1} onPress={dismissKeyboardAndPicker}>
                    <ScrollView
                        style={styles.flex1}
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: FOOTER_HEIGHT + insets.bottom }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        onScrollBeginDrag={dismissKeyboardAndPicker}
                    >
                        {/* 1. TITLE - First element with autofocus */}
                        <TextInput
                            ref={titleInputRef}
                            style={styles.titleInput}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Titre de l'événement"
                            placeholderTextColor="#B0B0B0"
                            returnKeyType="done"
                            blurOnSubmit={true}
                        />

                        {/* 2. THEME TAGS - Recent first, compact iOS style */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.themeScroll}
                            contentContainerStyle={styles.themeTags}
                        >
                            {sortedThemes.map(t => {
                                const isSelected = selectedThemeId === t.id;
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        onPress={() => handleThemeSelect(t.id)}
                                        style={[
                                            styles.themeTag,
                                            { borderColor: t.colorHex },
                                            isSelected && { backgroundColor: t.colorHex + '30' }
                                        ]}
                                    >
                                        <View style={[styles.themeTagDot, { backgroundColor: t.colorHex }]} />
                                        <Text style={[styles.themeTagText, { color: t.colorHex }]}>
                                            {t.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* 3. DATE - Infinite scroll with month overlay */}
                        <View style={styles.dateContainer}>
                            <Text style={styles.sectionLabel}>Date</Text>
                            {monthOverlay && (
                                <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.monthOverlay}>
                                    <Text style={styles.monthOverlayText}>{monthOverlay}</Text>
                                </Animated.View>
                            )}
                        </View>
                        <FlatList
                            ref={dateListRef}
                            horizontal
                            data={dateRange}
                            keyExtractor={(item) => item.key}
                            renderItem={renderDateItem}
                            showsHorizontalScrollIndicator={false}
                            style={styles.dateScroll}
                            contentContainerStyle={styles.datePills}
                            getItemLayout={(_, index) => ({ length: DATE_ITEM_WIDTH, offset: DATE_ITEM_WIDTH * index, index })}
                            onViewableItemsChanged={handleDateViewableChange}
                            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                            initialScrollIndex={30}
                            onScrollToIndexFailed={() => { }}
                        />

                        {/* 4. TIME - Tap to toggle iOS picker */}
                        <Text style={styles.sectionLabel}>Heure de début</Text>
                        <TouchableOpacity
                            style={styles.timePickerBtn}
                            onPress={() => setShowTimePicker(prev => !prev)}
                        >
                            <Text style={styles.timeValue}>
                                {startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <Ionicons name={showTimePicker ? "chevron-up" : "time-outline"} size={20} color="#888" />
                        </TouchableOpacity>

                        {showTimePicker && (
                            <DateTimePicker
                                value={startTime}
                                mode="time"
                                is24Hour={true}
                                minuteInterval={5}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleTimeChange}
                                style={styles.timePicker}
                            />
                        )}

                        {/* 5. DURATION - Single line horizontal scroll */}
                        <Text style={styles.sectionLabel}>Durée</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.durationScroll}
                            contentContainerStyle={styles.durationRow}
                        >
                            {DURATION_PRESETS.map(preset => {
                                const isSelected = selectedDuration === preset.key;
                                return (
                                    <TouchableOpacity
                                        key={preset.key}
                                        onPress={() => {
                                            setSelectedDuration(preset.key);
                                            Haptics.selectionAsync();
                                        }}
                                        style={[styles.durationBtn, isSelected && styles.durationBtnSelected]}
                                    >
                                        <Text style={[styles.durationBtnText, isSelected && styles.durationBtnTextSelected]}>
                                            {preset.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity
                                onPress={() => setShowCustomDuration(true)}
                                style={[styles.durationBtn, selectedDuration === 'custom' && styles.durationBtnSelected]}
                            >
                                <Text style={[styles.durationBtnText, selectedDuration === 'custom' && styles.durationBtnTextSelected]}>
                                    {selectedDuration === 'custom' ? `${Math.floor(customDurationMinutes / 60)}h${customDurationMinutes % 60 || ''}` : 'Autre..'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* RECAP BANNER - Centered */}
                        <View style={styles.recapBanner}>
                            <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
                            <Text style={styles.recapText}>{recapText}</Text>
                        </View>

                        {/* 6. RECURRENCE - Simple toggle + 4 options */}
                        <View style={styles.recurrenceRow}>
                            <View style={styles.recurrenceLeft}>
                                <Ionicons name="repeat" size={18} color="#666" />
                                <Text style={styles.recurrenceLabel}>Récurrence</Text>
                            </View>
                            <Switch
                                value={recurrenceEnabled}
                                onValueChange={(v) => {
                                    setRecurrenceEnabled(v);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                trackColor={{ false: '#E0E0E0', true: theme.colors.accent + '60' }}
                                thumbColor={recurrenceEnabled ? theme.colors.accent : '#F0F0F0'}
                            />
                        </View>

                        {recurrenceEnabled && (
                            <Animated.View entering={FadeIn.duration(150)} style={styles.recurrenceOptions}>
                                {RECURRENCE_OPTIONS.map(opt => {
                                    const isSelected = recurrenceType === opt.key;
                                    return (
                                        <TouchableOpacity
                                            key={opt.key}
                                            onPress={() => {
                                                setRecurrenceType(opt.key);
                                                Haptics.selectionAsync();
                                            }}
                                            style={[styles.recurrenceBtn, isSelected && styles.recurrenceBtnSelected]}
                                        >
                                            <Text style={[styles.recurrenceBtnText, isSelected && styles.recurrenceBtnTextSelected]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </Animated.View>
                        )}

                        {/* 7. DETAILS - Collapsed */}
                        <TouchableOpacity
                            style={styles.detailsToggle}
                            onPress={() => {
                                setDetailsExpanded(!detailsExpanded);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Text style={styles.detailsToggleText}>Détails</Text>
                            <Ionicons name={detailsExpanded ? "chevron-up" : "chevron-down"} size={18} color="#888" />
                        </TouchableOpacity>

                        {detailsExpanded && (
                            <Animated.View entering={FadeIn.duration(150)} style={styles.detailsSection}>
                                <TextInput
                                    style={styles.descriptionInput}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Description..."
                                    placeholderTextColor="#B0B0B0"
                                    multiline
                                />
                                <TextInput
                                    style={styles.locationInput}
                                    value={location}
                                    onChangeText={setLocation}
                                    placeholder="Lieu..."
                                    placeholderTextColor="#B0B0B0"
                                />
                            </Animated.View>
                        )}
                    </ScrollView>
                </Pressable>

                {/* STICKY FOOTER */}
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!canSave}
                        style={[styles.createBtn, !canSave && styles.createBtnDisabled]}
                    >
                        <Text style={[styles.createBtnText, !canSave && styles.createBtnTextDisabled]}>
                            Créer l'événement
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Custom Duration Modal */}
            <Modal visible={showCustomDuration} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Durée personnalisée</Text>
                        <Text style={styles.modalHint}>Min: 5min · Max: 1 semaine</Text>

                        <View style={styles.durationPickerRow}>
                            <View style={styles.durationPickerCol}>
                                <TouchableOpacity onPress={() => setCustomDurationMinutes(prev => Math.min(prev + 60, 10080))} style={styles.durationPickerBtn}>
                                    <Ionicons name="chevron-up" size={24} color="#666" />
                                </TouchableOpacity>
                                <Text style={styles.durationPickerValue}>{Math.floor(customDurationMinutes / 60)}h</Text>
                                <TouchableOpacity onPress={() => setCustomDurationMinutes(prev => Math.max(prev - 60, 5))} style={styles.durationPickerBtn}>
                                    <Ionicons name="chevron-down" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.durationPickerCol}>
                                <TouchableOpacity onPress={() => setCustomDurationMinutes(prev => Math.min(prev + 5, 10080))} style={styles.durationPickerBtn}>
                                    <Ionicons name="chevron-up" size={24} color="#666" />
                                </TouchableOpacity>
                                <Text style={styles.durationPickerValue}>{customDurationMinutes % 60}m</Text>
                                <TouchableOpacity onPress={() => setCustomDurationMinutes(prev => Math.max(prev - 5, 5))} style={styles.durationPickerBtn}>
                                    <Ionicons name="chevron-down" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setShowCustomDuration(false)} style={styles.modalCancel}>
                                <Text style={styles.modalCancelText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedDuration('custom');
                                    setShowCustomDuration(false);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }}
                                style={styles.modalConfirm}
                            >
                                <Text style={styles.modalConfirmText}>OK</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    flex1: {
        flex: 1,
    },
    closeBtn: {
        position: 'absolute',
        right: 16,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },

    // Title
    titleInput: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1A1A1A',
        paddingVertical: 12,
        marginTop: 40,
    },

    // Section Label
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
        marginTop: 20,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Theme Tags - Compact
    themeScroll: {
        marginTop: 8,
    },
    themeTags: {
        flexDirection: 'row',
        gap: 8,
    },
    themeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        gap: 5,
    },
    themeTagDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    themeTagText: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Date Container with overlay
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    monthOverlay: {
        backgroundColor: theme.colors.accent + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    monthOverlayText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.accent,
        textTransform: 'capitalize',
    },

    // Date Pills
    dateScroll: {
        marginBottom: 4,
    },
    datePills: {
        flexDirection: 'row',
        gap: 6,
    },
    datePill: {
        width: DATE_ITEM_WIDTH - 6, // Account for gap
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
    },
    datePillSelected: {
        backgroundColor: theme.colors.accent,
    },
    datePillToday: {
        borderWidth: 1,
        borderColor: theme.colors.accent,
    },
    datePillText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666',
    },
    datePillTextSelected: {
        color: '#FFF',
        fontWeight: '600',
    },

    // Time Picker
    timePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 12,
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
    },
    timeValue: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1A1A1A',
        fontVariant: ['tabular-nums'],
    },
    timePicker: {
        height: 120,
        marginTop: 8,
    },

    // Duration - Single line
    durationScroll: {
        marginBottom: 4,
    },
    durationRow: {
        flexDirection: 'row',
        gap: 8,
    },
    durationBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
    },
    durationBtnSelected: {
        backgroundColor: theme.colors.accent,
    },
    durationBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    durationBtnTextSelected: {
        color: '#FFF',
    },

    // Recap Banner
    recapBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginVertical: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: theme.colors.accent + '15',
        borderRadius: 10,
    },
    recapText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.accent,
        textAlign: 'center',
    },

    // Recurrence
    recurrenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    recurrenceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recurrenceLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#444',
    },
    recurrenceOptions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 8,
    },
    recurrenceBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
    },
    recurrenceBtnSelected: {
        backgroundColor: theme.colors.accent,
    },
    recurrenceBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
    },
    recurrenceBtnTextSelected: {
        color: '#FFF',
    },

    // Details
    detailsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#EEE',
    },
    detailsToggleText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#888',
    },
    detailsSection: {
        gap: 12,
        paddingBottom: 16,
    },
    descriptionInput: {
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#1A1A1A',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    locationInput: {
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#1A1A1A',
    },

    // Footer
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: '#FFF',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#EEE',
    },
    createBtn: {
        backgroundColor: theme.colors.accent,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    createBtnDisabled: {
        backgroundColor: '#E0E0E0',
    },
    createBtnText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
    },
    createBtnTextDisabled: {
        color: '#AAA',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 24,
        width: '80%',
        maxWidth: 300,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'center',
    },
    modalHint: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginTop: 4,
    },
    durationPickerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        marginTop: 20,
    },
    durationPickerCol: {
        alignItems: 'center',
    },
    durationPickerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    durationPickerValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1A1A1A',
        marginVertical: 8,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
    modalConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFF',
    },
});
