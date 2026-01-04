import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet,
    TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView,
    TouchableWithoutFeedback, Keyboard, Alert,
    Dimensions
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withTiming, runOnJS, interpolate, Easing
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { CalendarEvent, EventTheme } from '../types/events';
import {
    UserTheme, DEFAULT_THEMES, LIFY_THEME_COLORS,
    getThemeStyles, resolveEventColor, EVENT_THEMES
} from '../constants/eventThemes';
import {
    getAllThemes, saveUserTheme, themeNameExists, generateThemeId, deleteUserTheme
} from '../services/themeService';

interface EventEditSheetProps {
    visible: boolean;
    event: CalendarEvent | null;
    onClose: () => void;
    onSave: (event: CalendarEvent) => void;
    onDelete?: (eventId: string) => void;
}

// ----------------------------------------------------------------------
// HELPER: Reorder days to put selected day first (Rotation)
// ----------------------------------------------------------------------
const reorderDays = (days: Date[], selectedDate: Date) => {
    if (!days.length) return [];

    // Find index of selected day (by date comparison)
    const index = days.findIndex(d =>
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
    );

    if (index === -1) return days; // Should not happen if list covers range

    // Rotate: [ ...selectedAndAfter, ...before ]
    const part1 = days.slice(index);
    const part2 = days.slice(0, index);
    return part1.concat(part2);
};

// ----------------------------------------------------------------------
// COMPONENT: DragZone - Extracted to avoid hooks inside nested components
// ----------------------------------------------------------------------
interface DragZoneProps {
    type: 'hour' | 'minute';
    children: React.ReactNode;
    onDragChange: (type: 'hour' | 'minute', direction: number) => void;
}

const DragZone = ({ type, children, onDragChange }: DragZoneProps) => {
    const savedY = useSharedValue(0);

    const gesture = Gesture.Pan()
        .runOnJS(true)
        .onStart(() => { savedY.value = 0; })
        .onUpdate((e) => {
            const totalY = -e.translationY; // up is positive
            const delta = totalY - savedY.value;

            const THRESHOLD = 15; // px

            if (Math.abs(delta) > THRESHOLD) {
                const direction = Math.sign(delta);
                onDragChange(type, direction);
                savedY.value = totalY; // Consume
            }
        });

    return (
        <GestureDetector gesture={gesture}>
            <View style={localStyles.timeZoneTouch}>
                {children}
            </View>
        </GestureDetector>
    );
};

// Local styles for DragZone (needed before main styles are defined)
const localStyles = StyleSheet.create({
    timeZoneTouch: {
        paddingHorizontal: 4,
        paddingVertical: 8,
    },
});

// ----------------------------------------------------------------------
// COMPONENT: Draggable Time Input
// ----------------------------------------------------------------------
interface DraggableTimeInputProps {
    value: string; // "HH:MM"
    onChange: (val: string) => void;
    label: string;
}

const DraggableTimeInput = ({ value, onChange, label }: DraggableTimeInputProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
        // Validate HH:MM
        const [hStr, mStr] = tempValue.split(':');
        let h = parseInt(hStr || '0', 10);
        let m = parseInt(mStr || '0', 10);

        if (isNaN(h)) h = 0;
        if (isNaN(m)) m = 0;

        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));

        // Round m to nearest 5? Optionally. Let's keep strict user input or round.
        // Spec said "accept 930 => 09:30".
        if (!tempValue.includes(':') && tempValue.length >= 3) {
            // Try to parse "930" -> 09:30
            const raw = parseInt(tempValue, 10);
            if (!isNaN(raw)) {
                if (tempValue.length === 3) {
                    h = parseInt(tempValue.substring(0, 1), 10);
                    m = parseInt(tempValue.substring(1), 10);
                } else if (tempValue.length === 4) {
                    h = parseInt(tempValue.substring(0, 2), 10);
                    m = parseInt(tempValue.substring(2), 10);
                }
            }
        }

        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(formatted);
        setTempValue(formatted);
    };

    // Handle drag changes from external DragZone component
    const handleDragChange = useCallback((type: 'hour' | 'minute', direction: number) => {
        const [hStr, mStr] = value.split(':');
        let h = parseInt(hStr, 10);
        let m = parseInt(mStr, 10);

        if (type === 'hour') {
            h = Math.max(0, Math.min(23, h + direction));
        } else {
            let newM = m + (direction * 5);
            if (newM > 55) newM = 55;
            if (newM < 0) newM = 0;
            m = newM;
        }

        const nextVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (nextVal !== value) {
            onChange(nextVal);
        }
    }, [value, onChange]);

    if (isEditing) {
        return (
            <View style={styles.timeInputContainer}>
                <Text style={styles.subLabel}>{label}</Text>
                <TextInput
                    ref={inputRef}
                    style={[styles.displayTime, styles.inputEditing]}
                    value={tempValue}
                    onChangeText={setTempValue}
                    onBlur={handleBlur}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={5} // HH:MM
                />
            </View>
        );
    }

    const [hStr, mStr] = value.split(':');

    return (
        <View style={styles.timeInputContainer}>
            <Text style={styles.subLabel}>{label}</Text>
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => setIsEditing(true)}
            >
                <View style={styles.displayTimeContainer}>
                    {/* Hour Zone */}
                    <DragZone type="hour" onDragChange={handleDragChange}>
                        <Text style={styles.displayTime}>{hStr}</Text>
                    </DragZone>

                    <Text style={[styles.displayTime, { marginHorizontal: 2 }]}>:</Text>

                    {/* Minute Zone */}
                    <DragZone type="minute" onDragChange={handleDragChange}>
                        <Text style={styles.displayTime}>{mStr}</Text>
                    </DragZone>
                </View>
            </TouchableOpacity>
        </View>
    );
};


const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.9; // 90% of screen

export function EventEditSheet({ visible, event, onClose, onSave, onDelete }: EventEditSheetProps) {
    const insets = useSafeAreaInsets();

    // Mode detection: if event has an id, it's edit mode; otherwise it's create mode
    const isEditMode = Boolean(event?.id);

    // Animation state
    const [shouldRender, setShouldRender] = useState(false);
    const animationProgress = useSharedValue(0);

    // Handle visibility changes with smooth animation
    useEffect(() => {
        if (visible) {
            // Mount and animate in
            setShouldRender(true);
            animationProgress.value = withTiming(1, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            });
        } else {
            // Animate out, then unmount
            animationProgress.value = withTiming(0, {
                duration: 180,
                easing: Easing.in(Easing.cubic),
            }, (finished) => {
                if (finished) {
                    runOnJS(setShouldRender)(false);
                }
            });
        }
    }, [visible]);

    // Animated styles
    const overlayAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(animationProgress.value, [0, 1], [0, 0.28]),
    }));

    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(animationProgress.value, [0, 1], [SHEET_HEIGHT + insets.bottom, 0]) },
            { scale: interpolate(animationProgress.value, [0, 1], [0.98, 1]) },
        ],
    }));

    // Handle close with animation
    const handleClose = useCallback(() => {
        Keyboard.dismiss();
        onClose();
    }, [onClose]);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    // Theme state - new system
    const [availableThemes, setAvailableThemes] = useState<UserTheme[]>(DEFAULT_THEMES);
    const [selectedThemeId, setSelectedThemeId] = useState<string>(DEFAULT_THEMES[0].id);
    const [selectedColorHex, setSelectedColorHex] = useState<string>(DEFAULT_THEMES[0].colorHex);

    // Custom theme creation modal state
    const [showCreateTheme, setShowCreateTheme] = useState(false);
    const [newThemeName, setNewThemeName] = useState('');
    const [newThemeColor, setNewThemeColor] = useState<string | null>(null);
    const [isCreatingTheme, setIsCreatingTheme] = useState(false);

    // Legacy compatibility
    const [themeName, setThemeName] = useState<EventTheme>('Travail');

    const [startDate, setStartDate] = useState(new Date());
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState(new Date());
    const [endTime, setEndTime] = useState('10:00');

    // HELPER: Days for Date Picker (Horizontal)
    const getDays = (pivot: Date) => {
        const days = [];
        const start = new Date(pivot);
        start.setHours(0, 0, 0, 0);
        // Show -10 to +20 days
        // We actually want a stable list so user can scroll back/forth
        // But the requirement is "Selected First".
        // So we generate a range, then reorder.

        for (let i = -10; i < 20; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    // We keep a comprehensive list of days
    const [allDays, setAllDays] = useState<Date[]>([]);

    useEffect(() => {
        // Init days around "Now" or "Event Start"
        setAllDays(getDays(event ? new Date(event.startAt) : new Date()));
    }, [event, visible]);

    // Load all themes (default + custom) on mount
    useEffect(() => {
        if (visible) {
            getAllThemes().then(themes => {
                setAvailableThemes(themes);
            });
        }
    }, [visible]);

    // Handle theme deletion (only for custom themes)
    const handleDeleteTheme = useCallback((theme: UserTheme) => {
        if (theme.isDefault) return; // Cannot delete system themes

        Alert.alert(
            'Supprimer ce thème ?',
            `Le thème "${theme.name}" sera supprimé définitivement.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteUserTheme(theme.id);
                        // Reload themes
                        const updatedThemes = await getAllThemes();
                        setAvailableThemes(updatedThemes);
                        // If deleted theme was selected, switch to first default
                        if (selectedThemeId === theme.id) {
                            setSelectedThemeId(DEFAULT_THEMES[0].id);
                            setSelectedColorHex(DEFAULT_THEMES[0].colorHex);
                        }
                    }
                }
            ]
        );
    }, [selectedThemeId]);

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    // Derived Lists (Memoized Rotation)
    const startDateList = useMemo(() => reorderDays(allDays, startDate), [allDays, startDate]);
    const endDateList = useMemo(() => reorderDays(allDays, endDate), [allDays, endDate]);

    // INTELLIGENT LOGIC
    useEffect(() => {
        if (isSameDay(startDate, endDate)) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);

            const startM = (sh * 60) + sm;
            const endM = (eh * 60) + em;

            if (endM < startM) {
                // End time is before Start time -> Assume next day
                const nextDay = new Date(startDate);
                nextDay.setDate(nextDay.getDate() + 1);
                setEndDate(nextDay);
            }
        }
    }, [startTime, endTime, startDate]);

    // INIT FROM EVENT
    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setDescription(event.description || '');

            // Handle theme - new system with fallback
            const eventColor = resolveEventColor(event, availableThemes);
            setSelectedColorHex(eventColor);
            const matchingTheme = availableThemes.find(t => t.colorHex === eventColor);
            if (matchingTheme) {
                setSelectedThemeId(matchingTheme.id);
            }
            setThemeName(event.theme);

            const isISO = event.startAt.includes('T');

            let sDate = new Date();
            let eDate = new Date();
            let sTime = "09:00";
            let eTime = "10:00";

            if (isISO) {
                sDate = new Date(event.startAt);
                eDate = new Date(event.endAt);

                const sh = String(sDate.getHours()).padStart(2, '0');
                const sm = String(sDate.getMinutes()).padStart(2, '0');
                sTime = `${sh}:${sm}`;

                const eh = String(eDate.getHours()).padStart(2, '0');
                const em = String(eDate.getMinutes()).padStart(2, '0');
                eTime = `${eh}:${em}`;
            } else {
                sTime = event.startAt || "09:00";
                eTime = event.endAt || "10:00";
            }

            setStartDate(sDate);
            setEndDate(eDate);
            setStartTime(sTime);
            setEndTime(eTime);
        } else {
            // Defaults
            setTitle('');
            setDescription('');
            setSelectedThemeId(DEFAULT_THEMES[0].id);
            setSelectedColorHex(DEFAULT_THEMES[0].colorHex);
            setThemeName('Travail');
            setStartTime('09:00');
            setEndTime('10:00');
            const now = new Date();
            setStartDate(now);
            setEndDate(now);
        }
    }, [event, visible]);

    const handleSave = () => {
        if (!title.trim()) return;

        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);

        const startFull = new Date(startDate);
        startFull.setHours(sh || 0, sm || 0, 0, 0);

        const endFull = new Date(endDate);
        endFull.setHours(eh || 0, em || 0, 0, 0);

        if (endFull <= startFull) {
            Alert.alert("Erreur", "La date de fin doit être après la date de début.");
            return;
        }

        // Find selected theme for legacy compatibility
        const selectedTheme = availableThemes.find(t => t.id === selectedThemeId);
        const finalColor = selectedTheme?.colorHex || selectedColorHex;
        const legacyThemeName = selectedTheme?.name as EventTheme || 'Travail';

        const newEvent: CalendarEvent = {
            id: event?.id, // Keep undefined for new events, let API assign ID
            userId: 'current',
            title,
            description,
            theme: legacyThemeName,
            color: finalColor,
            themeId: selectedThemeId,
            colorHex: finalColor,
            startAt: startFull.toISOString(),
            endAt: endFull.toISOString(),
            dayIndex: (startFull.getDay() + 6) % 7,
        };
        onSave(newEvent);
        onClose();
    };

    // Display Info
    const getDurationText = () => {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);

        const startFull = new Date(startDate);
        startFull.setHours(sh || 0, sm || 0, 0, 0);

        const endFull = new Date(endDate);
        endFull.setHours(eh || 0, em || 0, 0, 0);

        const diffMs = endFull.getTime() - startFull.getTime();
        if (diffMs < 0) return "Fin avant début !";

        const diffMins = Math.floor(diffMs / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;

        const dateStr = startFull.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const timeStr = `${String(startFull.getHours()).padStart(2, '0')}:${String(startFull.getMinutes()).padStart(2, '0')}`;
        const endDateStr = endFull.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const endTimeStr = `${String(endFull.getHours()).padStart(2, '0')}:${String(endFull.getMinutes()).padStart(2, '0')}`;

        return `Du ${dateStr} ${timeStr} au ${endDateStr} ${endTimeStr} (${h}h${m > 0 ? m : ''})`;
    };

    // Don't render anything if not visible and not animating
    if (!shouldRender) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Animated Overlay */}
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={[styles.backdrop, overlayAnimatedStyle]} />
            </TouchableWithoutFeedback>

            {/* Animated Sheet */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.sheetContainer}
                pointerEvents="box-none"
            >
                <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                    {/* Handle Bar */}
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {isEditMode ? "Modifier l'événement" : 'Nouvel événement'}
                        </Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Ionicons name="close-circle" size={28} color="#E0E0E0" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                        {/* Title Input */}
                        <Text style={styles.label}>Titre</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Ex: Réunion équipe"
                            placeholderTextColor="#C7C7CC"
                        />

                        {/* DATE/TIME SECTION */}
                        <Text style={styles.sectionTitle}>Horaire</Text>

                        {/* START ROW: Time Left, Date List Right */}
                        <View style={styles.dateTimeRow}>
                            <DraggableTimeInput
                                label="Début"
                                value={startTime}
                                onChange={setStartTime}
                            />

                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.subLabel}>Date</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniDateScroll}>
                                    {startDateList.map((d, i) => {
                                        const selected = isSameDay(d, startDate);
                                        return (
                                            <TouchableOpacity
                                                key={i}
                                                onPress={() => setStartDate(d)}
                                                style={[styles.miniDatePill, selected && styles.miniDatePillSelected]}
                                            >
                                                <Text style={[styles.miniDateText, selected && styles.miniDateTextSelected]}>
                                                    {d.getDate()}/{d.getMonth() + 1}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </ScrollView>
                            </View>
                        </View>

                        {/* END ROW: Time Left, Date List Right */}
                        <View style={styles.dateTimeRow}>
                            <DraggableTimeInput
                                label="Fin"
                                value={endTime}
                                onChange={setEndTime}
                            />

                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.subLabel}>Date</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniDateScroll}>
                                    {endDateList.map((d, i) => {
                                        const selected = isSameDay(d, endDate);
                                        return (
                                            <TouchableOpacity
                                                key={i}
                                                onPress={() => setEndDate(d)}
                                                style={[styles.miniDatePill, selected && styles.miniDatePillSelected]}
                                            >
                                                <Text style={[styles.miniDateText, selected && styles.miniDateTextSelected]}>
                                                    {d.getDate()}/{d.getMonth() + 1}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </ScrollView>
                            </View>
                        </View>

                        {/* "Lify Orange" Recap */}
                        <View style={styles.feedbackContainer}>
                            <Ionicons name="time" size={18} color={theme.colors.accent} style={{ marginRight: 8 }} />
                            <Text style={styles.feedbackText}>{getDurationText()}</Text>
                        </View>


                        {/* Theme Selector - New System */}
                        <Text style={[styles.label, { marginTop: 16 }]}>Thème</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeScroll} keyboardShouldPersistTaps="handled">
                            {/* Sort themes: selected first */}
                            {[...availableThemes].sort((a, b) => {
                                if (a.id === selectedThemeId) return -1;
                                if (b.id === selectedThemeId) return 1;
                                return 0;
                            }).map((t) => {
                                const isSelected = selectedThemeId === t.id;
                                const color = t.colorHex;
                                const isCustom = !t.isDefault;
                                const showDeleteButton = showCreateTheme && isCustom;

                                return (
                                    <View key={t.id} style={styles.themePillWrapper}>
                                        {/* Delete X button - only in edit mode for custom themes */}
                                        {showDeleteButton && (
                                            <TouchableOpacity
                                                style={styles.themeDeleteBtn}
                                                onPress={() => handleDeleteTheme(t)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="close-circle" size={18} color="#E74C3C" />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedThemeId(t.id);
                                                setSelectedColorHex(t.colorHex);
                                            }}
                                            style={[
                                                styles.themePill,
                                                { backgroundColor: color + '33' },
                                                isSelected && styles.themePillSelected,
                                                isSelected && {
                                                    borderColor: color,
                                                    borderWidth: 2,
                                                    shadowColor: color,
                                                    shadowOpacity: 0.4,
                                                    shadowRadius: 6,
                                                    shadowOffset: { width: 0, height: 2 },
                                                    elevation: 4,
                                                }
                                            ]}
                                        >
                                            <Text style={[
                                                styles.themeText,
                                                { color: color },
                                                isSelected && { fontWeight: '700' }
                                            ]}>{t.name}</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                            {/* Add/Cancel Theme Chip */}
                            <TouchableOpacity
                                onPress={() => {
                                    setShowCreateTheme(!showCreateTheme);
                                    if (showCreateTheme) {
                                        // Reset form when canceling
                                        setNewThemeName('');
                                        setNewThemeColor(null);
                                    }
                                }}
                                style={[
                                    styles.themePill,
                                    styles.addThemePill,
                                    showCreateTheme && styles.cancelThemePill
                                ]}
                            >
                                <Ionicons
                                    name={showCreateTheme ? "close" : "add"}
                                    size={16}
                                    color={showCreateTheme ? "#E74C3C" : "#888"}
                                />
                                <Text style={[
                                    styles.addThemeText,
                                    showCreateTheme && { color: '#E74C3C' }
                                ]}>
                                    {showCreateTheme ? 'Annuler' : 'Ajouter'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Custom Theme Creation Section */}
                        {showCreateTheme && (
                            <View style={styles.createThemeContainer}>
                                <Text style={styles.createThemeTitle}>Nouveau thème</Text>

                                {/* Theme Name Input */}
                                <TextInput
                                    style={styles.createThemeInput}
                                    value={newThemeName}
                                    onChangeText={setNewThemeName}
                                    placeholder="Nom du thème"
                                    placeholderTextColor="#AAA"
                                    maxLength={20}
                                />

                                {/* Color Palette Grid */}
                                <Text style={styles.colorGridLabel}>Couleur</Text>
                                <View style={styles.colorGrid}>
                                    {LIFY_THEME_COLORS.map((lifyColor) => {
                                        const isColorSelected = newThemeColor === lifyColor.hex;
                                        return (
                                            <TouchableOpacity
                                                key={lifyColor.hex}
                                                onPress={() => setNewThemeColor(lifyColor.hex)}
                                                style={[
                                                    styles.colorCell,
                                                    { backgroundColor: lifyColor.hex },
                                                    isColorSelected && styles.colorCellSelected
                                                ]}
                                            >
                                                {isColorSelected && (
                                                    <Ionicons name="checkmark" size={18} color="#FFF" />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.createThemeActions}>
                                    <TouchableOpacity
                                        style={styles.cancelThemeBtn}
                                        onPress={() => {
                                            setShowCreateTheme(false);
                                            setNewThemeName('');
                                            setNewThemeColor(null);
                                        }}
                                    >
                                        <Text style={styles.cancelThemeText}>Annuler</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.createThemeBtn,
                                            (!newThemeName.trim() || newThemeName.trim().length < 2 || !newThemeColor) && styles.createThemeBtnDisabled
                                        ]}
                                        disabled={!newThemeName.trim() || newThemeName.trim().length < 2 || !newThemeColor || isCreatingTheme}
                                        onPress={async () => {
                                            const trimmedName = newThemeName.trim();
                                            if (trimmedName.length < 2 || !newThemeColor) return;

                                            setIsCreatingTheme(true);
                                            try {
                                                // Check for duplicate name
                                                const exists = await themeNameExists(trimmedName);
                                                if (exists) {
                                                    Alert.alert('Erreur', 'Un thème avec ce nom existe déjà.');
                                                    setIsCreatingTheme(false);
                                                    return;
                                                }

                                                // Create and save new theme
                                                const newTheme: UserTheme = {
                                                    id: generateThemeId(),
                                                    name: trimmedName,
                                                    colorHex: newThemeColor,
                                                };
                                                await saveUserTheme(newTheme);

                                                // Reload themes and select new one
                                                const updatedThemes = await getAllThemes();
                                                setAvailableThemes(updatedThemes);
                                                setSelectedThemeId(newTheme.id);
                                                setSelectedColorHex(newTheme.colorHex);

                                                // Reset modal
                                                setShowCreateTheme(false);
                                                setNewThemeName('');
                                                setNewThemeColor(null);
                                            } catch (error) {
                                                Alert.alert('Erreur', 'Impossible de créer le thème.');
                                            } finally {
                                                setIsCreatingTheme(false);
                                            }
                                        }}
                                    >
                                        <Text style={styles.createThemeBtnText}>
                                            {isCreatingTheme ? 'Création...' : 'Créer'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Description */}
                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Ajouter des détails..."
                            placeholderTextColor="#C7C7CC"
                            multiline
                            textAlignVertical="top"
                        />

                        {/* Actions */}
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>
                                {isEditMode ? 'Enregistrer' : 'Créer'}
                            </Text>
                        </TouchableOpacity>

                        {/* Delete button only visible in edit mode */}
                        {isEditMode && onDelete && event?.id && (
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => { onDelete(event!.id!); handleClose(); }}
                            >
                                <Text style={styles.deleteButtonText}>Supprimer</Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    sheetContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000', // Opacity is animated
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 12,
        height: SHEET_HEIGHT,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    handleContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#000',
    },
    content: {
        paddingBottom: 40,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginTop: 8,
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#000',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    textArea: {
        height: 80,
        paddingTop: 14,
    },
    // New Date/Time Styles
    dateTimeRow: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-end', // Align bottom so inputs align
    },
    subLabel: {
        fontSize: 12,
        color: '#AAA',
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase'
    },
    miniDateScroll: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 4,
        maxHeight: 52, // Fixed height for alignment
    },
    miniDatePill: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        marginRight: 4,
    },
    miniDatePillSelected: {
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    miniDateText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#999'
    },
    miniDateTextSelected: {
        color: '#000',
        fontWeight: '700'
    },

    // TIME INPUT STYLES
    timeInputContainer: {
        width: 100,
    },
    displayTimeContainer: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    displayTime: {
        fontSize: 22,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    timeZoneTouch: {
        paddingHorizontal: 4,
        paddingVertical: 2
    },
    inputEditing: {
        backgroundColor: '#FFF',
        borderColor: theme.colors.accent,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
    },

    // RECAP
    feedbackContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF5F0', // Very light orange Lify
        borderRadius: 16,
        marginBottom: 24,
    },
    feedbackText: {
        color: '#D45D00', // Darker Orange
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
        lineHeight: 18,
    },

    // Theme
    themeScroll: {
        marginBottom: 20,
        flexGrow: 0,
    },
    themePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginRight: 10,
        backgroundColor: '#FFF',
    },
    themePillSelected: {
        // Dynamic border color handled in render
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    themeText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
    },

    saveButton: {
        backgroundColor: '#000',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    deleteButton: {
        marginTop: 16,
        alignItems: 'center',
        padding: 12,
    },
    deleteButtonText: {
        color: '#FF3B30',
        fontSize: 15,
        fontWeight: '500',
    },

    // Add Theme Pill
    addThemePill: {
        backgroundColor: '#F5F5F5',
        borderStyle: 'dashed',
    },
    addThemeText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#888',
        marginLeft: 4,
    },

    // Custom Theme Creation
    createThemeContainer: {
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    createThemeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    createThemeInput: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E5E5E5',
        marginBottom: 16,
    },
    colorGridLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
        marginBottom: 10,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
        marginBottom: 16,
    },
    colorCell: {
        width: 44,
        height: 44,
        borderRadius: 10,
        margin: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorCellSelected: {
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    createThemeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelThemeBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    cancelThemeText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666',
    },
    createThemeBtn: {
        backgroundColor: '#000',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    createThemeBtnDisabled: {
        backgroundColor: '#CCC',
    },
    createThemeBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
    cancelThemePill: {
        backgroundColor: '#FFEBEB',
        borderColor: '#E74C3C',
        borderStyle: 'solid',
    },
    themePillWrapper: {
        position: 'relative',
        marginRight: 8,
    },
    themeDeleteBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        zIndex: 10,
        backgroundColor: '#FFF',
        borderRadius: 10,
    },
});
