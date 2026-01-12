import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
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
    SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.80;
const CARD_MAX_HEIGHT = 380;
const SWIPE_THRESHOLD = 120;

// Stack configuration for iMessage-like effect
const STACK_CONFIG = {
    top: {
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotate: 0,
        opacity: 1,
    },
    back1: {
        translateX: 10,
        translateY: 10,
        scale: 0.98,
        rotate: -2,
        opacity: 0.95,
    },
    back2: {
        translateX: -10,
        translateY: 18,
        scale: 0.96,
        rotate: 2,
        opacity: 0.85,
    },
};

export interface MediaItem {
    uri: string;
    width: number;
    height: number;
    type: 'image' | 'video';
}

interface MediaStackCarouselProps {
    items: MediaItem[];
    onRemove: (uri: string) => void;
    onOpen: (item: MediaItem) => void;
}

interface StackCardProps {
    item: MediaItem;
    position: number;
    index: number;
    currentIndex: number;
    totalItems: number;
    translateX: SharedValue<number>;
    onRemove: (uri: string) => void;
    onOpen: (item: MediaItem) => void;
}

// Separate component for each card to maintain stable hook count
function StackCard({
    item,
    position,
    index,
    currentIndex,
    totalItems,
    translateX,
    onRemove,
    onOpen
}: StackCardProps) {
    const isTop = position === 0;

    const ratio = item.width / item.height;
    let cardHeight = CARD_WIDTH / ratio;
    if (cardHeight > CARD_MAX_HEIGHT) cardHeight = CARD_MAX_HEIGHT;
    if (cardHeight < 200) cardHeight = 200;

    // Get base config for this position
    const getBaseConfig = (pos: number) => {
        if (pos === 0) return STACK_CONFIG.top;
        if (pos === 1) return STACK_CONFIG.back1;
        return STACK_CONFIG.back2;
    };

    const baseConfig = getBaseConfig(position);
    const nextConfig = getBaseConfig(Math.max(0, position - 1));

    const animatedStyle = useAnimatedStyle(() => {
        if (isTop) {
            // Top card follows finger
            const rotation = interpolate(
                translateX.value,
                [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
                [-8, 0, 8],
                Extrapolate.CLAMP
            );

            return {
                transform: [
                    { translateX: translateX.value },
                    { rotate: `${rotation}deg` },
                ],
                zIndex: 30,
            };
        } else {
            // Back cards progressively move forward during swipe
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
            <View style={[styles.card, { height: cardHeight, width: CARD_WIDTH }]}>
                <Image source={{ uri: item.uri }} style={styles.cardImage} resizeMode="cover" />

                {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                        <Ionicons name="play" size={20} color="#FFF" />
                    </View>
                )}

                {isTop && (
                    <>
                        {/* Tap overlay for fullscreen */}
                        <TouchableOpacity
                            style={styles.tapOverlay}
                            activeOpacity={1}
                            onPress={() => onOpen(item)}
                        />

                        {/* Remove button */}
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                onRemove(item.uri);
                            }}
                        >
                            <Ionicons name="close" size={18} color="#FFF" />
                        </TouchableOpacity>

                        {/* Index badge */}
                        <View style={styles.indexBadge}>
                            <Text style={styles.indexText}>
                                {currentIndex + 1} / {totalItems}
                            </Text>
                        </View>
                    </>
                )}
            </View>
        </Animated.View>
    );
}

export default function MediaStackCarousel({ items, onRemove, onOpen }: MediaStackCarouselProps) {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const translateX = useSharedValue(0);
    const isAnimating = useSharedValue(false);

    // Reset when items change
    useEffect(() => {
        if (currentIndex >= items.length) {
            setCurrentIndex(Math.max(0, items.length - 1));
        }
    }, [items.length, currentIndex]);

    const handleSwipeComplete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex((prev) => (prev + 1) % items.length);
    };

    const pan = Gesture.Pan()
        .activeOffsetX([-10, 10])  // Horizontal: active if dx > 10px
        .failOffsetY([-15, 15])    // Vertical: fail if dy > 15px (allows scroll)
        .onUpdate((event) => {
            // Only update if not animating and gesture is horizontal
            if (!isAnimating.value) {
                translateX.value = event.translationX;
            }
        })
        .onEnd(() => {
            // Check if swipe threshold exceeded
            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                isAnimating.value = true;
                const direction = translateX.value > 0 ? 1 : -1;

                // Animate card off screen
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
                // Snap back
                translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    if (items.length === 0) {
        return null;
    }

    // Calculate the tallest card to set container height
    const maxCardHeight = Math.min(
        CARD_MAX_HEIGHT,
        Math.max(
            200,
            ...items.map(item => {
                const ratio = item.width / item.height;
                let h = CARD_WIDTH / ratio;
                if (h > CARD_MAX_HEIGHT) h = CARD_MAX_HEIGHT;
                if (h < 200) h = 200;
                return h;
            })
        )
    );

    // Calculate visible indices - always render 3 cards (or less if fewer items)
    const getVisibleCards = () => {
        const cards = [];
        const numCards = Math.min(3, items.length);

        for (let i = 0; i < numCards; i++) {
            const index = (currentIndex + i) % items.length;
            cards.push({
                item: items[index],
                position: i,
                index,
                key: `${items[index].uri}-${index}`
            });
        }
        return cards.reverse(); // Render back to front (for z-index)
    };

    const visibleCards = getVisibleCards();

    return (
        <View style={[styles.container, { height: maxCardHeight + 30 }]}>
            <GestureDetector gesture={pan}>
                <View style={styles.stackContainer}>
                    {visibleCards.map(cardData => (
                        <StackCard
                            key={cardData.key}
                            item={cardData.item}
                            position={cardData.position}
                            index={cardData.index}
                            currentIndex={currentIndex}
                            totalItems={items.length}
                            translateX={translateX}
                            onRemove={onRemove}
                            onOpen={onOpen}
                        />
                    ))}
                </View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
        position: 'relative',
        overflow: 'visible',
    },
    stackContainer: {
        width: CARD_WIDTH + 40, // Extra space for cards sticking out
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    cardWrapper: {
        position: 'absolute',
        alignItems: 'center',
        overflow: 'visible',
    },
    card: {
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    tapOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    videoBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
        zIndex: 2,
    },
    removeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
    },
    indexBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        zIndex: 2,
    },
    indexText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
