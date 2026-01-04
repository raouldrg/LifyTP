/**
 * ChatMessageItem - Premium message bubble with iMessage/Instagram-inspired design
 * 
 * Features:
 * - Swipe right → Reply
 * - Swipe left → Show time (simple gray text)
 * - Long press → Popover context menu attached to message
 * - Sent messages: Lify orange gradient (text, image, AND audio)
 * - Received messages: Neutral gray
 * - Adaptive bubble size (fit-content)
 * - Audio: adaptive colors (white icons on sent, orange icons on received)
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolation,
    FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { resolveImageUrl } from '../../services/api';
import { AudioPlayerStore, AudioPlayerState } from '../../stores/AudioPlayerStore';
import { Waveform } from '../Waveform';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_REPLY_THRESHOLD = 50;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.72;

// Lify orange gradient
const LIFY_GRADIENT_COLORS = ['#FFB899', '#FFA07A'] as const;

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

interface MessageReaction {
    id: string;
    userId: string;
    emoji: string;
}

interface Message {
    id: string;
    conversationId?: string;
    senderId: string;
    content?: string;
    type: 'TEXT' | 'IMAGE' | 'AUDIO';
    mediaUrl?: string;
    duration?: number;
    createdAt: string;
    editedAt?: string | null;
    deletedAt?: string | null;
    read?: boolean;
    delivered?: boolean;
    replyTo?: {
        id: string;
        content?: string;
        type: string;
        sender?: { username?: string; id?: string };
    };
    reactions?: MessageReaction[];
    status?: MessageStatus;
    tempId?: string;
}

interface MessagePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ChatMessageItemProps {
    message: Message;
    isMe: boolean;
    isLastSentMessage?: boolean;
    isMostRecentMessage?: boolean;
    formatTime: (date: string) => string;
    onImagePress: (url: string) => void;
    onReply: (message: Message) => void;
    onLongPress: (message: Message, position: MessagePosition) => void;
    onReplyTap?: (replyToId: string) => void;
    currentUserId?: string; // To determine which reaction is mine
}

// Audio player - adapts colors based on sent/received
const AudioPlayerUI = React.memo(({ uri, isMe, duration }: { uri: string; isMe: boolean; duration?: number }) => {
    const [playerState, setPlayerState] = useState<AudioPlayerState | null>(null);
    const [speed, setSpeed] = useState(1);
    const [levels] = useState(() => Array.from({ length: 18 }, () => 0.2 + Math.random() * 0.6));

    const fullUri = uri.startsWith('http') ? uri : `${resolveImageUrl(uri) || ''}`;

    useEffect(() => {
        const unsubscribe = AudioPlayerStore.subscribe((state) => {
            setPlayerState(state);
        });
        return unsubscribe;
    }, []);

    const isThisAudio = playerState?.currentUri === fullUri;
    const isThisPlaying = isThisAudio && playerState?.isPlaying;
    const hasEnded = isThisAudio && playerState?.hasEnded;
    const currentTime = isThisAudio ? playerState!.currentTime : 0;
    const progress = isThisAudio ? playerState!.progress : 0;
    const displayDuration = isThisAudio && playerState!.duration > 0
        ? playerState!.duration
        : (duration || 0);

    const handleToggle = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await AudioPlayerStore.togglePlayPause(fullUri, duration);
    }, [fullUri, duration]);

    const handleSpeedChange = useCallback(async () => {
        const speeds = [1, 1.5, 2];
        const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
        const nextSpeed = speeds[nextIndex];
        setSpeed(nextSpeed);
        await AudioPlayerStore.setSpeed(nextSpeed);
    }, [speed]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const displayTime = isThisPlaying || (currentTime > 0 && !hasEnded)
        ? formatTime(currentTime)
        : formatTime(displayDuration);

    // Icon: play triangle, pause bars, or refresh
    const playIcon = isThisPlaying ? 'pause' : hasEnded ? 'refresh' : 'play';

    // Colors adapt based on sent (orange gradient) or received (gray)
    const iconColor = isMe ? '#FFFFFF' : '#FFA07A';
    const waveformBgColor = isMe ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)';
    const waveformActiveColor = isMe ? '#FFFFFF' : '#FFA07A';
    const textColor = isMe ? 'rgba(255,255,255,0.9)' : '#636366';
    const buttonBgColor = isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255, 160, 122, 0.15)';
    const speedBgColor = isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)';

    return (
        <View style={audioStyles.container}>
            {/* Play button */}
            <TouchableOpacity onPress={handleToggle} style={audioStyles.playButton}>
                <View style={[audioStyles.playButtonCircle, { backgroundColor: buttonBgColor }]}>
                    <Ionicons
                        name={playIcon}
                        size={18}
                        color={iconColor}
                        style={playIcon === 'play' ? { marginLeft: 2 } : undefined}
                    />
                </View>
            </TouchableOpacity>

            {/* Waveform */}
            <View style={audioStyles.waveformWrapper}>
                <Waveform
                    levels={levels}
                    color={waveformBgColor}
                    activeColor={waveformActiveColor}
                    progress={progress}
                    isPlaying={isThisPlaying || false}
                />
            </View>

            <Text style={[audioStyles.duration, { color: textColor }]}>{displayTime}</Text>

            <TouchableOpacity onPress={handleSpeedChange} style={[audioStyles.speedButton, { backgroundColor: speedBgColor }]}>
                <Text style={[audioStyles.speedText, { color: textColor }]}>{speed}x</Text>
            </TouchableOpacity>
        </View>
    );
});

// Status indicator
const MessageStatusIndicator = React.memo(({ status, isMe, show }: { status?: MessageStatus; isMe: boolean; show: boolean }) => {
    if (!isMe || !show) return null;

    switch (status) {
        case 'sending':
            return <Text style={[statusStyles.text, { color: '#8E8E93' }]}>Envoi...</Text>;
        case 'sent':
            return <Text style={[statusStyles.text, { color: '#8E8E93' }]}>Envoyé</Text>;
        case 'delivered':
            return <Text style={[statusStyles.text, { color: '#8E8E93' }]}>Distribué</Text>;
        case 'read':
            return <Text style={[statusStyles.text, { color: '#34C759' }]}>Lu</Text>;
        case 'error':
            return <Text style={[statusStyles.text, { color: '#FF3B30' }]}>Erreur</Text>;
        default:
            return <Text style={[statusStyles.text, { color: '#8E8E93' }]}>Envoyé</Text>;
    }
});

// Main component
export const ChatMessageItem = React.memo(function ChatMessageItem({
    message,
    isMe,
    isLastSentMessage = false,
    isMostRecentMessage = false,
    formatTime,
    onImagePress,
    onReply,
    onLongPress,
    onReplyTap,
    currentUserId,
}: ChatMessageItemProps) {
    const translateX = useSharedValue(0);
    const showTime = useSharedValue(0);
    const hasTriggeredReplyHaptic = useSharedValue(false);
    const bubbleRef = useRef<View>(null);

    const triggerReply = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onReply(message);
    }, [onReply, message]);

    const triggerHapticLight = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const pan = Gesture.Pan()
        .activeOffsetX([-25, 25])
        .failOffsetY([-15, 15])
        .minPointers(1)
        .maxPointers(1)
        .onUpdate((e) => {
            if (e.translationX > 0) {
                const clampedX = Math.min(e.translationX * 0.6, SWIPE_REPLY_THRESHOLD + 40);
                translateX.value = clampedX;

                if (e.translationX > SWIPE_REPLY_THRESHOLD && !hasTriggeredReplyHaptic.value) {
                    hasTriggeredReplyHaptic.value = true;
                    runOnJS(triggerHapticLight)();
                } else if (e.translationX <= SWIPE_REPLY_THRESHOLD) {
                    hasTriggeredReplyHaptic.value = false;
                }
            } else if (e.translationX < 0) {
                const clampedX = e.translationX * 0.7;
                translateX.value = clampedX;
                showTime.value = Math.min(Math.abs(e.translationX) / 60, 1);
            }
        })
        .onEnd((e) => {
            if (e.translationX > SWIPE_REPLY_THRESHOLD) {
                runOnJS(triggerReply)();
            }
            translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
            showTime.value = withTiming(0, { duration: 200 });
            hasTriggeredReplyHaptic.value = false;
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const replyIconStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, 30], [0, 1], Extrapolation.CLAMP),
        transform: [
            { scale: interpolate(translateX.value, [0, SWIPE_REPLY_THRESHOLD], [0.6, 1.1], Extrapolation.CLAMP) },
        ],
    }));

    const timeStyle = useAnimatedStyle(() => ({
        opacity: showTime.value,
        transform: [{ translateX: interpolate(showTime.value, [0, 1], [15, 0]) }],
    }));

    // Long press handler - measure position and pass to parent
    const handleLongPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Measure bubble position in window
        if (bubbleRef.current) {
            bubbleRef.current.measureInWindow((x, y, width, height) => {
                onLongPress(message, { x, y, width, height });
            });
        } else {
            onLongPress(message, { x: 0, y: 0, width: 0, height: 0 });
        }
    }, [onLongPress, message]);

    const handleReplyTap = useCallback(() => {
        if (message.replyTo?.id && onReplyTap) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onReplyTap(message.replyTo.id);
        }
    }, [message.replyTo?.id, onReplyTap]);

    const formattedTime = formatTime(message.createdAt);
    const isDeleted = !!message.deletedAt;
    const isEdited = !!message.editedAt;

    // Deleted message content
    const renderDeletedContent = () => (
        <Text style={styles.deletedText}>Message supprimé</Text>
    );

    const renderBubbleContent = () => (
        <>
            {message.replyTo && !isDeleted && (
                <TouchableOpacity onPress={handleReplyTap} style={styles.replyContext}>
                    <View style={[styles.replyBar, !isMe && { backgroundColor: '#FFA07A' }]} />
                    <View style={styles.replyContent}>
                        <Text style={[styles.replyName, !isMe && { color: '#FFA07A' }]} numberOfLines={1}>
                            {message.replyTo.sender?.username || 'Message'}
                        </Text>
                        <Text style={[styles.replyText, isMe && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
                            {message.replyTo.type === 'IMAGE' ? '📷 Photo' :
                                message.replyTo.type === 'AUDIO' ? '🎤 Audio' :
                                    message.replyTo.content || ''}
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

            {isDeleted ? (
                renderDeletedContent()
            ) : (
                <>
                    {message.type === 'IMAGE' && message.mediaUrl && (
                        <TouchableOpacity onPress={() => onImagePress(message.mediaUrl!)}>
                            <Image
                                source={{ uri: resolveImageUrl(message.mediaUrl) || '' }}
                                style={styles.messageImage}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    )}

                    {message.type === 'AUDIO' && message.mediaUrl && (
                        <AudioPlayerUI
                            uri={message.mediaUrl}
                            isMe={isMe}
                            duration={message.duration}
                        />
                    )}

                    {message.content && (
                        <View style={styles.textContainer}>
                            <Text style={isMe ? styles.myText : styles.theirText}>
                                {message.content}
                            </Text>
                            {isEdited && (
                                <Text style={[styles.editedLabel, isMe && styles.editedLabelMe]}>
                                    Modifié
                                </Text>
                            )}
                        </View>
                    )}
                </>
            )}
        </>
    );

    return (
        <View style={styles.container}>
            {/* Reply icon */}
            <View style={styles.replyIconContainer}>
                <Animated.View style={[styles.replyIcon, replyIconStyle]}>
                    <Ionicons name="arrow-undo" size={18} color="#1A1A1A" />
                </Animated.View>
            </View>

            {/* Time (simple gray text) */}
            <View style={styles.timeContainerRight}>
                <Animated.Text style={[styles.timeSimple, timeStyle]}>
                    {formattedTime}
                </Animated.Text>
            </View>

            {/* Message wrapper */}
            <View style={[styles.wrapper, isMe ? styles.myWrapper : styles.theirWrapper]}>
                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.bubbleContainer, animatedStyle]}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onLongPress={handleLongPress}
                            delayLongPress={350}
                        >
                            <View ref={bubbleRef} collapsable={false}>
                                {isMe ? (
                                    // Sent message: Lify orange gradient (ALL types)
                                    <LinearGradient
                                        colors={LIFY_GRADIENT_COLORS}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 0, y: 1 }}
                                        style={[styles.bubble, styles.myBubbleCorner]}
                                    >
                                        {renderBubbleContent()}
                                    </LinearGradient>
                                ) : (
                                    // Received message: neutral gray
                                    <View style={[styles.bubble, styles.theirBubble]}>
                                        {renderBubbleContent()}
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Reaction chips - grouped by emoji */}
                        {message.reactions && message.reactions.length > 0 && (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                style={[
                                    styles.reactionsContainer,
                                    isMe ? styles.reactionsContainerRight : styles.reactionsContainerLeft
                                ]}
                            >
                                {Object.entries(
                                    message.reactions.reduce((acc, r) => {
                                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>)
                                ).map(([emoji, count]) => (
                                    <View key={emoji} style={styles.reactionChip}>
                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                        {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
                                    </View>
                                ))}
                            </Animated.View>
                        )}

                        {isMostRecentMessage && (
                            <Animated.View
                                entering={FadeIn.duration(300)}
                                style={[styles.footer, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}
                            >
                                <Text style={styles.footerTime}>{formattedTime}</Text>
                                {isMe && (
                                    <>
                                        <Text style={styles.dotSeparator}>•</Text>
                                        <MessageStatusIndicator
                                            status={message.status}
                                            isMe={isMe}
                                            show={true}
                                        />
                                    </>
                                )}
                            </Animated.View>
                        )}
                    </Animated.View>
                </GestureDetector>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
        position: 'relative',
        justifyContent: 'center',
    },
    replyIconContainer: {
        position: 'absolute',
        left: 12,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        zIndex: -1,
    },
    replyIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    timeContainerRight: {
        position: 'absolute',
        right: 12,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        zIndex: -1,
    },
    timeSimple: {
        fontSize: 12,
        color: '#AEAEB2',
        fontWeight: '500',
    },
    wrapper: {
        marginBottom: 2,
        paddingHorizontal: 8,
        width: '100%',
    },
    myWrapper: {
        alignItems: 'flex-end',
    },
    theirWrapper: {
        alignItems: 'flex-start',
    },
    bubbleContainer: {
        maxWidth: MAX_BUBBLE_WIDTH,
        minWidth: 40,
        flexShrink: 1,
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
    },
    myBubbleCorner: {
        borderBottomRightRadius: 4,
    },
    // Liquid Glass styles
    glassBubble: {
        overflow: 'hidden',
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
    },
    glassBubbleAndroid: {
        overflow: 'hidden',
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.95)',
        shadowColor: '#FFA07A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    glassBubbleAndroidReceived: {
        overflow: 'hidden',
        borderRadius: 22,
        backgroundColor: 'rgba(245,245,247,0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    glassOverlayReceived: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    theirBubbleCorner: {
        borderBottomLeftRadius: 4,
    },
    // Legacy - kept for audio
    theirBubble: {
        backgroundColor: '#EBEBEB',
        borderBottomLeftRadius: 4,
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginBottom: 4,
    },
    myText: {
        fontSize: 16,
        lineHeight: 21,
        color: '#FFFFFF',
        flexShrink: 1,
        includeFontPadding: false, // Android fix
    },
    theirText: {
        fontSize: 16,
        lineHeight: 21,
        color: '#1A1A1A',
        flexShrink: 1,
        includeFontPadding: false, // Android fix
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 4,
        paddingHorizontal: 4,
    },
    footerTime: {
        fontSize: 11,
        color: '#8E8E93',
    },
    dotSeparator: {
        fontSize: 11,
        color: '#8E8E93',
        marginHorizontal: 4,
    },
    replyContext: {
        flexDirection: 'row',
        marginBottom: 6,
        paddingBottom: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.2)',
    },
    replyBar: {
        width: 3,
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 2,
        marginRight: 8,
    },
    replyContent: {
        flexShrink: 1,
        justifyContent: 'center',
    },
    replyName: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 1,
    },
    replyText: {
        fontSize: 12,
        color: '#8E8E93',
    },
    // Reaction styles
    reactionsContainer: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 4,
        marginBottom: 2,
    },
    reactionsContainerRight: {
        justifyContent: 'flex-end',
    },
    reactionsContainerLeft: {
        justifyContent: 'flex-start',
    },
    reactionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.08)',
        gap: 2,
    },
    reactionEmoji: {
        fontSize: 14,
    },
    reactionCount: {
        fontSize: 11,
        color: '#8E8E93',
        fontWeight: '500',
    },
    // Deleted message style
    deletedText: {
        fontSize: 15,
        fontStyle: 'italic',
        color: '#8E8E93',
    },
    // Text container for message with edited label
    textContainer: {
        flexShrink: 1,
    },
    // Edited label styles
    editedLabel: {
        fontSize: 11,
        color: '#8E8E93',
        marginTop: 2,
        fontStyle: 'italic',
    },
    editedLabelMe: {
        color: 'rgba(255,255,255,0.7)',
    },
});

const audioStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 150,
        maxWidth: MAX_BUBBLE_WIDTH - 24,
    },
    playButton: {
        flexShrink: 0,
    },
    playButtonCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 160, 122, 0.15)', // Very light orange background
        justifyContent: 'center',
        alignItems: 'center',
    },
    waveformWrapper: {
        flex: 1,
        height: 28,
        minWidth: 40,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    duration: {
        fontSize: 12,
        color: '#636366',
        fontVariant: ['tabular-nums'],
        flexShrink: 0,
        minWidth: 28,
    },
    speedButton: {
        backgroundColor: 'rgba(0,0,0,0.06)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        flexShrink: 0,
    },
    speedText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#636366',
    },
});

const statusStyles = StyleSheet.create({
    text: {
        fontSize: 11,
        fontWeight: '500',
    },
});
