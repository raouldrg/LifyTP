import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.92; // Slightly narrower for overflow effect
const CARD_MAX_HEIGHT = 400;
const SWIPE_THRESHOLD = 100;

// Stack configuration for iMessage-like effect
const STACK_CONFIG = {
    top: {
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotate: 0,
        opacity: 1, // Full opacity
    },
    back1: {
        translateX: 12, // More horizontal offset for overflow
        translateY: 8,
        scale: 0.95,
        rotate: -3,
        opacity: 1, // NO TRANSPARENCY
    },
    back2: {
        translateX: -12, // More horizontal offset (opposite side)
        translateY: 16,
        scale: 0.90,
        rotate: 3,
        opacity: 1, // NO TRANSPARENCY
    },
};

interface MediaStackViewProps {
    media: string[]; // Array of URIs
    onMediaPress?: (index: number) => void;
}

export default function MediaStackView({ media, onMediaPress }: MediaStackViewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewingFullscreen, setViewingFullscreen] = useState(false);
    const translateX = useSharedValue(0);
    const isAnimating = useSharedValue(false);

    if (!media || media.length === 0) return null;

    const handleSwipeComplete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex((prev) => (prev + 1) % media.length);
    };

    const handleMediaPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setViewingFullscreen(true);
        if (onMediaPress) {
            onMediaPress(currentIndex);
        }
    };

    const pan = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-15, 15])
        .onUpdate((event) => {
            if (!isAnimating.value) {
                translateX.value = event.translationX;
            }
        })
        .onEnd(() => {
            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                isAnimating.value = true;
                const direction = translateX.value > 0 ? 1 : -1;

                // Animate off screen
                translateX.value = withTiming(
                    direction * (SCREEN_WIDTH + 80),
                    { duration: 300 },
                    (finished) => {
                        if (finished) {
                            runOnJS(handleSwipeComplete)();
                            translateX.value = 0;
                            isAnimating.value = false;
                        }
                    }
                );
            } else {
                translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    // Calculate visible cards
    const getVisibleCards = () => {
        const cards = [];
        const numCards = Math.min(3, media.length);

        for (let i = 0; i < numCards; i++) {
            const index = (currentIndex + i) % media.length;
            cards.push({
                uri: media[index],
                position: i,
                index,
                key: `${media[index]}-${index}`
            });
        }
        return cards.reverse(); // Render back to front
    };

    const visibleCards = getVisibleCards();

    return (
        <View style={styles.container}>
            <GestureDetector gesture={pan}>
                <View style={styles.stackContainer}>
                    {visibleCards.map(cardData => (
                        <StackedCard
                            key={cardData.key}
                            uri={cardData.uri}
                            position={cardData.position}
                            translateX={translateX}
                            onPress={cardData.position === 0 ? handleMediaPress : undefined}
                        />
                    ))}
                </View>
            </GestureDetector>

            {/* Index Indicator */}
            <View style={styles.indexIndicator}>
                <Text style={styles.indexText}>
                    {currentIndex + 1} / {media.length}
                </Text>
            </View>

            {/* Fullscreen Viewer Modal */}
            <Modal
                visible={viewingFullscreen}
                transparent
                animationType="fade"
                onRequestClose={() => setViewingFullscreen(false)}
            >
                <View style={styles.fullscreenContainer}>
                    <TouchableOpacity
                        style={styles.fullscreenClose}
                        onPress={() => setViewingFullscreen(false)}
                    >
                        <Ionicons name="close" size={32} color="#FFF" />
                    </TouchableOpacity>
                    {media[currentIndex] && (
                        <Image
                            source={{ uri: media[currentIndex] }}
                            style={styles.fullscreenImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}

// Separate component for each card to maintain stable hooks
interface StackedCardProps {
    uri: string;
    position: number;
    translateX: ReturnType<typeof useSharedValue<number>>;
    onPress?: () => void;
}

function StackedCard({ uri, position, translateX, onPress }: StackedCardProps) {
    const isTop = position === 0;

    const getBaseConfig = (pos: number) => {
        if (pos === 0) return STACK_CONFIG.top;
        if (pos === 1) return STACK_CONFIG.back1;
        return STACK_CONFIG.back2;
    };

    const baseConfig = getBaseConfig(position);
    const nextConfig = getBaseConfig(Math.max(0, position - 1));

    const animatedStyle = useAnimatedStyle(() => {
        if (isTop) {
            // Top card follows finger with rotation
            const rotation = interpolate(
                translateX.value,
                [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
                [-6, 0, 6],
                Extrapolate.CLAMP
            );

            const scale = interpolate(
                Math.abs(translateX.value),
                [0, SWIPE_THRESHOLD],
                [1, 0.95],
                Extrapolate.CLAMP
            );

            return {
                transform: [
                    { translateX: translateX.value },
                    { rotate: `${rotation}deg` },
                    { scale },
                ],
                zIndex: 30,
            };
        } else {
            // Back cards progressively move forward
            const dragProgress = Math.abs(translateX.value) / SWIPE_THRESHOLD;
            const clampedProgress = Math.min(dragProgress, 1);

            const tx = interpolate(
                clampedProgress,
                [0, 1],
                [baseConfig.translateX, nextConfig.translateX],
                Extrapolate.CLAMP
            );

            const ty = interpolate(
                clampedProgress,
                [0, 1],
                [baseConfig.translateY, nextConfig.translateY],
                Extrapolate.CLAMP
            );

            const scale = interpolate(
                clampedProgress,
                [0, 1],
                [baseConfig.scale, nextConfig.scale],
                Extrapolate.CLAMP
            );

            const rotate = interpolate(
                clampedProgress,
                [0, 1],
                [baseConfig.rotate, nextConfig.rotate],
                Extrapolate.CLAMP
            );

            const opacity = interpolate(
                clampedProgress,
                [0, 1],
                [baseConfig.opacity, nextConfig.opacity],
                Extrapolate.CLAMP
            );

            return {
                transform: [
                    { translateX: tx },
                    { translateY: ty },
                    { scale },
                    { rotate: `${rotate}deg` },
                ],
                opacity,
                zIndex: 20 - position,
            };
        }
    });

    const staticStyle = !isTop ? {
        transform: [
            { translateX: baseConfig.translateX },
            { translateY: baseConfig.translateY },
            { scale: baseConfig.scale },
            { rotate: `${baseConfig.rotate}deg` },
        ],
        opacity: baseConfig.opacity,
        zIndex: 20 - position,
    } : { zIndex: 30 };

    return (
        <Animated.View
            style={[
                styles.cardWrapper,
                staticStyle,
                animatedStyle,
            ]}
            pointerEvents={isTop ? 'auto' : 'none'}
        >
            <TouchableOpacity
                activeOpacity={0.95}
                onPress={onPress}
                style={styles.card}
                disabled={!isTop}
            >
                <Image
                    source={{ uri }}
                    style={styles.cardImage}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 8,
    },
    stackContainer: {
        width: CARD_WIDTH,
        height: CARD_MAX_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrapper: {
        position: 'absolute',
        alignItems: 'center',
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_MAX_HEIGHT,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    indexIndicator: {
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 12,
    },
    indexText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    fullscreenContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullscreenClose: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    fullscreenImage: {
        width: '100%',
        height: '100%',
    },
});
