/**
 * ChatInputBar - Premium input bar with WhatsApp-like voice recording UX
 * 
 * Features:
 * - Hold-to-record with long press gesture
 * - Slide left to cancel (trash indicator in the input bar)
 * - Slide up to lock (padlock above mic)
 * - Locked mode with send/delete buttons
 * - Real-time waveform visualization
 * - Clear visual feedback at every state
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Text,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Extrapolation,
    runOnJS,
    Easing,
    SharedValue,
    withRepeat,
    withSequence,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { useAudioRecording } from '../../hooks/useAudioRecording';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animation configs
const SPRING_CONFIG = { damping: 18, stiffness: 200 };
const TIMING_CONFIG = { duration: 200, easing: Easing.out(Easing.cubic) };

// Gesture thresholds
const SLIDE_TO_CANCEL_THRESHOLD = -100; // px left
const SLIDE_TO_LOCK_THRESHOLD = -80;    // px up
const LONG_PRESS_DURATION = 150;        // ms

interface ChatInputBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onAttach: () => void;
    onCameraPress?: () => void;
    // Audio recording callbacks
    onStartRecording: () => void;
    onStopRecording: () => Promise<void>;
    onCancelRecording: () => void;
    onLockRecording?: () => void;
    // State
    sending?: boolean;
    hasContent: boolean;
    inputRef?: React.RefObject<TextInput | null>;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Waveform bar component - animated based on metering
const WaveformBar = ({
    index,
    metering,
    isActive
}: {
    index: number;
    metering: SharedValue<number>;
    isActive: boolean;
}) => {
    const randomFactor = useRef(0.5 + Math.random() * 0.5).current;

    const animatedStyle = useAnimatedStyle(() => {
        const m = Math.max(metering.value, -60);
        const baseScale = interpolate(m, [-60, -10, 0], [0.3, 0.8, 1.4], Extrapolation.CLAMP);
        const scale = baseScale * randomFactor + 0.1;

        return {
            height: 16 * scale,
            opacity: isActive ? interpolate(m, [-60, -30], [0.5, 1], Extrapolation.CLAMP) : 0.3,
        };
    });

    return (
        <Animated.View style={[styles.waveformBar, animatedStyle]} />
    );
};

// Recording dot with pulse animation
const RecordingDot = () => {
    const pulse = useSharedValue(1);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.3, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: interpolate(pulse.value, [1, 1.3], [1, 0.7]),
    }));

    return (
        <Animated.View style={[styles.recordingDot, animatedStyle]} />
    );
};

export function ChatInputBar({
    value,
    onChangeText,
    onSend,
    onAttach,
    onCameraPress,
    onStartRecording,
    onStopRecording,
    onCancelRecording,
    onLockRecording,
    sending = false,
    hasContent,
    inputRef,
}: ChatInputBarProps) {
    const insets = useSafeAreaInsets();
    const localInputRef = useRef<TextInput>(null);
    const effectiveRef = inputRef || localInputRef;

    // Audio recording state from hook
    const recording = useAudioRecording();

    // Animation values
    const plusScale = useSharedValue(1);
    const sendScale = useSharedValue(1);
    const micScale = useSharedValue(1);
    const recordingProgress = useSharedValue(0);
    const slideX = useSharedValue(0);
    const slideY = useSharedValue(0);
    const metering = useSharedValue(-160);

    // Update metering animation value from store
    useEffect(() => {
        metering.value = withTiming(recording.metering, { duration: 80 });
    }, [recording.metering]);

    // Animate recording UI in/out
    useEffect(() => {
        if (recording.isActive) {
            recordingProgress.value = withTiming(1, TIMING_CONFIG);
        } else {
            recordingProgress.value = withTiming(0, TIMING_CONFIG);
            slideX.value = withSpring(0, SPRING_CONFIG);
            slideY.value = withSpring(0, SPRING_CONFIG);
            micScale.value = withSpring(1, SPRING_CONFIG);
        }
    }, [recording.isActive]);

    // Button handlers
    const handlePlusPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        plusScale.value = withSpring(0.85, SPRING_CONFIG);
        setTimeout(() => {
            plusScale.value = withSpring(1, SPRING_CONFIG);
        }, 100);
        onAttach();
    }, [onAttach]);

    const handleSend = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sendScale.value = withSpring(0.85, SPRING_CONFIG);
        setTimeout(() => {
            sendScale.value = withSpring(1, SPRING_CONFIG);
        }, 100);
        onSend();
    }, [onSend]);

    // Handle cancel gesture activation
    const handleCancelGestureChange = useCallback((active: boolean) => {
        recording.setCancelGestureActive(active);
    }, [recording.setCancelGestureActive]);

    // Handle lock gesture activation
    const handleLockGestureChange = useCallback((active: boolean) => {
        recording.setLockGestureActive(active);
    }, [recording.setLockGestureActive]);

    // Mic pan gesture for slide-to-cancel and slide-to-lock
    const micPanGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (recording.isRecording) {
                slideX.value = Math.min(0, event.translationX);
                slideY.value = Math.min(0, event.translationY);

                // Check cancel threshold (slide left)
                const shouldCancel = slideX.value < SLIDE_TO_CANCEL_THRESHOLD;
                if (shouldCancel !== recording.isCancelGestureActive) {
                    runOnJS(handleCancelGestureChange)(shouldCancel);
                }

                // Check lock threshold (slide up)
                const shouldLock = slideY.value < SLIDE_TO_LOCK_THRESHOLD && !shouldCancel;
                if (shouldLock !== recording.isLockGestureActive) {
                    runOnJS(handleLockGestureChange)(shouldLock);
                }
            }
        })
        .onEnd(() => {
            if (recording.isRecording) {
                if (recording.isCancelGestureActive) {
                    runOnJS(onCancelRecording)();
                } else if (recording.isLockGestureActive && onLockRecording) {
                    runOnJS(onLockRecording)();
                } else {
                    runOnJS(onStopRecording)();
                }
            }

            slideX.value = withSpring(0, SPRING_CONFIG);
            slideY.value = withSpring(0, SPRING_CONFIG);
        });

    // Long press gesture to start recording
    const micLongPressGesture = Gesture.LongPress()
        .minDuration(LONG_PRESS_DURATION)
        .onStart(() => {
            micScale.value = withSpring(1.3, SPRING_CONFIG);
            runOnJS(onStartRecording)();
        });

    // Combine gestures
    const composedMicGesture = Gesture.Simultaneous(micPanGesture, micLongPressGesture);

    // Animated styles
    const plusStyle = useAnimatedStyle(() => ({
        transform: [{ scale: plusScale.value }],
    }));

    const sendStyle = useAnimatedStyle(() => ({
        transform: [{ scale: sendScale.value }],
    }));

    const micStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: micScale.value },
            { translateX: slideX.value * 0.3 },
            { translateY: slideY.value * 0.3 },
        ],
    }));

    const textInputStyle = useAnimatedStyle(() => ({
        opacity: interpolate(recordingProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    }));

    const recordingBarStyle = useAnimatedStyle(() => ({
        opacity: recordingProgress.value,
        transform: [
            {
                translateY: interpolate(
                    recordingProgress.value,
                    [0, 1],
                    [10, 0],
                    Extrapolation.CLAMP
                )
            },
        ],
    }));

    // Determine button state
    const showSendButton = hasContent && !recording.isActive;
    const isLocked = recording.isLocked;
    const isUploading = recording.isUploading;
    const isCanceling = recording.isCanceling;
    const isRecordingActive = recording.isRecording || recording.isLocked;
    const showRecordingUI = recording.isActive && !isCanceling;

    const formattedDuration = recording.formattedDuration;

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {/* Lock zone - floating above the input bar when recording */}
            {isRecordingActive && !isUploading && !isLocked && (
                <View style={styles.lockZoneContainer}>
                    <Animated.View
                        style={[
                            styles.lockZone,
                            recording.isLockGestureActive && styles.lockZoneActive
                        ]}
                    >
                        <Ionicons
                            name={recording.isLockGestureActive ? "lock-closed" : "lock-open-outline"}
                            size={18}
                            color={recording.isLockGestureActive ? '#FFFFFF' : '#8E8E93'}
                        />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.lockZoneLine,
                            { opacity: recording.isLockGestureActive ? 1 : 0.3 }
                        ]}
                    />
                </View>
            )}

            {/* Main floating pill */}
            <View style={styles.pillContainer}>
                <View style={[
                    styles.pill,
                    isRecordingActive && styles.pillRecording,
                    isCanceling && styles.pillCanceling,
                ]}>
                    {/* Plus button - hidden during recording */}
                    {!recording.isActive && (
                        <AnimatedTouchable
                            onPress={handlePlusPress}
                            style={[styles.iconButton, plusStyle]}
                            activeOpacity={0.7}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons
                                name="add"
                                size={26}
                                color={theme.colors.accent}
                            />
                        </AnimatedTouchable>
                    )}

                    {/* Cancel button - shows during recording on left side */}
                    {isRecordingActive && !isUploading && (
                        <View
                            style={[
                                styles.cancelButton,
                                recording.isCancelGestureActive && styles.cancelButtonActive
                            ]}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={20}
                                color={recording.isCancelGestureActive ? '#FFFFFF' : '#8E8E93'}
                            />
                        </View>
                    )}

                    {/* Text input / Recording indicator */}
                    <View style={styles.inputWrapper}>
                        {showRecordingUI ? (
                            <Animated.View style={[styles.recordingIndicator, recordingBarStyle]}>
                                {isUploading ? (
                                    <View style={styles.uploadingContainer}>
                                        <ActivityIndicator color="#FFA07A" size="small" />
                                        <Text style={styles.uploadingText}>Envoi...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <RecordingDot />
                                        <Text style={styles.recordingTimer}>
                                            {formattedDuration}
                                        </Text>
                                        <View style={styles.waveformContainer}>
                                            {[...Array(14)].map((_, i) => (
                                                <WaveformBar
                                                    key={i}
                                                    index={i}
                                                    metering={metering}
                                                    isActive={isRecordingActive}
                                                />
                                            ))}
                                        </View>
                                        {!isLocked && (
                                            <Text style={styles.slideHint}>
                                                {recording.isCancelGestureActive
                                                    ? '← Relâchez'
                                                    : '← Glissez'}
                                            </Text>
                                        )}
                                    </>
                                )}
                            </Animated.View>
                        ) : isCanceling ? (
                            <View style={styles.canceledContainer}>
                                <Ionicons name="trash-outline" size={16} color="#8E8E93" />
                                <Text style={styles.canceledText}>Annulé</Text>
                            </View>
                        ) : (
                            <Animated.View style={textInputStyle}>
                                <TextInput
                                    ref={effectiveRef}
                                    style={styles.textInput}
                                    value={value}
                                    onChangeText={onChangeText}
                                    placeholder="Message..."
                                    placeholderTextColor="#8E8E93"
                                    multiline
                                    maxLength={2000}
                                    returnKeyType="default"
                                    blurOnSubmit={false}
                                />
                            </Animated.View>
                        )}
                    </View>

                    {/* Right button: Send, Locked controls, or Mic */}
                    {showSendButton ? (
                        <AnimatedTouchable
                            onPress={handleSend}
                            style={[styles.sendButton, sendStyle]}
                            activeOpacity={0.7}
                            disabled={sending}
                        >
                            {sending ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                            )}
                        </AnimatedTouchable>
                    ) : isLocked && !isUploading ? (
                        <View style={styles.lockedButtons}>
                            <TouchableOpacity
                                onPress={onCancelRecording}
                                style={styles.lockedCancelButton}
                            >
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onStopRecording()}
                                style={styles.lockedSendButton}
                            >
                                <Ionicons name="send" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    ) : !isCanceling && !isUploading ? (
                        <GestureDetector gesture={composedMicGesture}>
                            <Animated.View
                                style={[
                                    styles.micButton,
                                    micStyle,
                                    recording.isRecording && styles.micButtonRecording,
                                    recording.isCancelGestureActive && styles.micButtonCanceling,
                                    recording.isLockGestureActive && styles.micButtonLocking,
                                ]}
                            >
                                <Ionicons
                                    name="mic"
                                    size={20}
                                    color={recording.isRecording ? '#FFFFFF' : theme.colors.accent}
                                />
                            </Animated.View>
                        </GestureDetector>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 12,
        paddingTop: 8,
        backgroundColor: '#FFFFFF',
    },
    lockZoneContainer: {
        alignItems: 'flex-end',
        paddingRight: 28,
        marginBottom: 8,
    },
    lockZone: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(142, 142, 147, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockZoneActive: {
        backgroundColor: '#007AFF',
    },
    lockZoneLine: {
        width: 2,
        height: 12,
        backgroundColor: '#8E8E93',
        marginTop: 4,
        borderRadius: 1,
    },
    pillContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 24,
        paddingHorizontal: 6,
        paddingVertical: 6,
        minHeight: 48,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
    },
    pillRecording: {
        borderColor: 'rgba(255, 59, 48, 0.25)',
        backgroundColor: 'rgba(255, 59, 48, 0.03)',
    },
    pillCanceling: {
        borderColor: 'rgba(142, 142, 147, 0.3)',
        backgroundColor: 'rgba(142, 142, 147, 0.05)',
    },
    iconButton: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 19,
        marginLeft: 2,
    },
    cancelButtonActive: {
        backgroundColor: '#FF3B30',
    },
    inputWrapper: {
        flex: 1,
        justifyContent: 'center',
        minHeight: 36,
    },
    textInput: {
        fontSize: 16,
        color: '#1A1A1A',
        paddingHorizontal: 8,
        paddingVertical: 8,
        maxHeight: 100,
        lineHeight: 20,
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 4,
        gap: 8,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF3B30',
    },
    recordingTimer: {
        fontSize: 15,
        color: '#FF3B30',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        minWidth: 38,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 2,
        height: 28,
        overflow: 'hidden',
    },
    waveformBar: {
        width: 3,
        backgroundColor: '#FF3B30',
        borderRadius: 2,
    },
    slideHint: {
        fontSize: 12,
        color: '#8E8E93',
        marginLeft: 4,
    },
    uploadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    uploadingText: {
        fontSize: 14,
        color: '#8E8E93',
        fontWeight: '500',
    },
    canceledContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        gap: 8,
    },
    canceledText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    sendButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: theme.colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    micButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 160, 122, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    micButtonRecording: {
        backgroundColor: '#FF3B30',
    },
    micButtonCanceling: {
        backgroundColor: '#8E8E93',
    },
    micButtonLocking: {
        backgroundColor: '#007AFF',
    },
    lockedButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    lockedCancelButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 59, 48, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockedSendButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: theme.colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
