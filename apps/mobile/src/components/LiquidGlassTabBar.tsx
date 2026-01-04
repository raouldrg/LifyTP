import React, { useEffect, useCallback } from "react";
import {
    View,
    StyleSheet,
    Platform,
    Dimensions,
    Pressable,
} from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// DIMENSIONS
// ============================================
const TAB_BAR_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 380);
const TAB_BAR_HEIGHT = 70;
const BORDER_RADIUS = 35;
const ICON_SIZE = 24;
const TAB_COUNT = 4;

// Slot dimensions (each tab = 1/4 of bar)
const SLOT_PADDING = 6; // Padding inside bar
const SLOT_WIDTH = (TAB_BAR_WIDTH - SLOT_PADDING * 2) / TAB_COUNT;
const SLOT_HEIGHT = TAB_BAR_HEIGHT - SLOT_PADDING * 2;
const SLOT_RADIUS = SLOT_HEIGHT / 2;

// ============================================
// COLORS
// ============================================
const ICON_COLOR_INACTIVE = "#8E8E93";
const ICON_COLOR_ACTIVE = "#1C1C1E";
const ACCENT_COLOR = theme.colors.accent;

// Bar glass
const BLUR_INTENSITY = Platform.select({ ios: 15, android: 25 }) ?? 15;
const GLASS_TINT = "rgba(255, 255, 255, 0.12)";
const GLASS_STROKE = "rgba(255, 255, 255, 0.30)";
const SPECULAR_TOP = "rgba(255, 255, 255, 0.25)";
const SPECULAR_BOTTOM = "rgba(255, 255, 255, 0.0)";

// Slot highlight glass (slightly more visible)
const SLOT_BLUR_INTENSITY = Platform.select({ ios: 20, android: 30 }) ?? 20;
const SLOT_TINT = "rgba(255, 255, 255, 0.22)";
const SLOT_STROKE = "rgba(255, 255, 255, 0.45)";

// ============================================
// SPRING CONFIGS
// ============================================
const SLOT_SPRING = {
    damping: 20,
    stiffness: 200,
    mass: 0.6,
};

const BOUNCE_SPRING = {
    damping: 10,
    stiffness: 350,
    mass: 0.4,
};

// ============================================
// MAIN COMPONENT
// ============================================
export function LiquidGlassTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const { unreadCount, pendingRequestsCount } = useAuth();
    const insets = useSafeAreaInsets();
    const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();

    // Active slot position (0-3)
    const slotPosition = useSharedValue(state.index);

    // Bottom position respecting safe area
    const bottomPosition = Math.max(insets.bottom, 8) + 8;

    // Animate slot highlight on tab change
    useEffect(() => {
        slotPosition.value = withSpring(state.index, SLOT_SPRING);
    }, [state.index]);

    // Keyboard hide animation
    const keyboardStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: interpolate(
                    keyboardProgress.value,
                    [0, 1],
                    [0, 140],
                    Extrapolation.CLAMP
                ),
            },
        ],
        opacity: interpolate(
            keyboardProgress.value,
            [0, 0.3],
            [1, 0],
            Extrapolation.CLAMP
        ),
    }));

    // Slot highlight sliding animation
    const slotHighlightStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            slotPosition.value,
            [0, 1, 2, 3],
            [
                SLOT_PADDING + SLOT_WIDTH * 0,
                SLOT_PADDING + SLOT_WIDTH * 1,
                SLOT_PADDING + SLOT_WIDTH * 2,
                SLOT_PADDING + SLOT_WIDTH * 3,
            ],
            Extrapolation.CLAMP
        );
        return { transform: [{ translateX }] };
    });

    // Check if hidden
    const currentRoute = state.routes[state.index];
    const currentOptions = descriptors[currentRoute.key]?.options;
    const tabBarStyle = currentOptions?.tabBarStyle as any;
    if (tabBarStyle?.display === "none") return null;

    return (
        <Animated.View
            style={[styles.container, { bottom: bottomPosition }, keyboardStyle]}
        >
            {/* Shadow layer */}
            <View style={styles.shadowLayer} />

            <View style={styles.barWrapper}>
                {/* 1. BLUR LAYER */}
                <BlurView
                    intensity={BLUR_INTENSITY}
                    tint="light"
                    style={styles.blurLayer}
                />

                {/* 2. TINT LAYER */}
                <View style={styles.tintLayer} />

                {/* 3. SPECULAR HIGHLIGHT */}
                <LinearGradient
                    colors={[SPECULAR_TOP, SPECULAR_BOTTOM]}
                    style={styles.specularHighlight}
                />

                {/* 4. STROKE */}
                <View style={styles.strokeLayer} />

                {/* ACTIVE SLOT HIGHLIGHT - Full width slot */}
                <Animated.View style={[styles.slotHighlight, slotHighlightStyle]}>
                    {/* Slot blur */}
                    <BlurView
                        intensity={SLOT_BLUR_INTENSITY}
                        tint="light"
                        style={styles.slotBlur}
                    />
                    {/* Slot tint */}
                    <View style={styles.slotTint} />
                    {/* Slot stroke */}
                    <View style={styles.slotStroke} />
                    {/* Orange glow at bottom */}
                    <View style={styles.slotOrangeGlow} />
                </Animated.View>

                {/* TABS - 4 equal slots */}
                <View style={styles.tabsContainer}>
                    {state.routes.map((route: any, index: number) => {
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: "tabPress",
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                if (Platform.OS === "ios") {
                                    Haptics.impactAsync(
                                        Haptics.ImpactFeedbackStyle.Light
                                    );
                                }
                                navigation.navigate(route.name);
                            }
                        };

                        let iconName: keyof typeof Ionicons.glyphMap = "square";
                        let iconNameActive: keyof typeof Ionicons.glyphMap = "square";

                        if (route.name === "Home") {
                            iconName = "home-outline";
                            iconNameActive = "home";
                        }
                        if (route.name === "Search") {
                            iconName = "search-outline";
                            iconNameActive = "search";
                        }
                        if (route.name === "Messages") {
                            iconName = "chatbubble-outline";
                            iconNameActive = "chatbubble";
                        }
                        if (route.name === "Profile") {
                            iconName = "person-outline";
                            iconNameActive = "person";
                        }

                        return (
                            <TabButton
                                key={route.name}
                                iconName={isFocused ? iconNameActive : iconName}
                                isFocused={isFocused}
                                hasNotification={
                                    (route.name === "Messages" && unreadCount > 0) ||
                                    (route.name === "Profile" && pendingRequestsCount > 0)
                                }
                                onPress={onPress}
                                accessibilityLabel={options.tabBarAccessibilityLabel}
                            />
                        );
                    })}
                </View>
            </View>
        </Animated.View>
    );
}

// ============================================
// TAB BUTTON - Full slot touch target
// ============================================
interface TabButtonProps {
    iconName: keyof typeof Ionicons.glyphMap;
    isFocused: boolean;
    hasNotification: boolean;
    onPress: () => void;
    accessibilityLabel?: string;
}

function TabButton({
    iconName,
    isFocused,
    hasNotification,
    onPress,
    accessibilityLabel,
}: TabButtonProps) {
    const scale = useSharedValue(1);

    // Micro-bounce on focus
    useEffect(() => {
        if (isFocused) {
            scale.value = withSequence(
                withSpring(1.08, BOUNCE_SPRING),
                withSpring(1.0, { damping: 14, stiffness: 180 })
            );
        }
    }, [isFocused]);

    const handlePressIn = useCallback(() => {
        scale.value = withTiming(0.92, { duration: 50 });
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, BOUNCE_SPRING);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.tabSlot}
        >
            <Animated.View style={[styles.iconWrapper, animatedStyle]}>
                <Ionicons
                    name={iconName}
                    size={ICON_SIZE}
                    color={isFocused ? ICON_COLOR_ACTIVE : ICON_COLOR_INACTIVE}
                />

                {/* Notification badge */}
                {hasNotification && <View style={styles.badge} />}
            </Animated.View>
        </Pressable>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 100,
    },
    shadowLayer: {
        position: "absolute",
        width: TAB_BAR_WIDTH,
        height: TAB_BAR_HEIGHT,
        borderRadius: BORDER_RADIUS,
        backgroundColor: "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 16,
    },
    barWrapper: {
        width: TAB_BAR_WIDTH,
        height: TAB_BAR_HEIGHT,
        borderRadius: BORDER_RADIUS,
        overflow: "hidden",
        backgroundColor: "transparent",
    },
    blurLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    tintLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: GLASS_TINT,
    },
    specularHighlight: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: TAB_BAR_HEIGHT * 0.5,
        borderTopLeftRadius: BORDER_RADIUS,
        borderTopRightRadius: BORDER_RADIUS,
    },
    strokeLayer: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: BORDER_RADIUS,
        borderWidth: 1,
        borderColor: GLASS_STROKE,
    },

    // SLOT HIGHLIGHT - Full width of one tab
    slotHighlight: {
        position: "absolute",
        top: SLOT_PADDING,
        width: SLOT_WIDTH,
        height: SLOT_HEIGHT,
        borderRadius: SLOT_RADIUS,
        overflow: "hidden",
    },
    slotBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    slotTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: SLOT_TINT,
    },
    slotStroke: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: SLOT_RADIUS,
        borderWidth: 1,
        borderColor: SLOT_STROKE,
    },
    slotOrangeGlow: {
        position: "absolute",
        bottom: 0,
        left: SLOT_WIDTH * 0.2,
        right: SLOT_WIDTH * 0.2,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: ACCENT_COLOR,
        opacity: 0.5,
        // Shadow glow effect
        shadowColor: ACCENT_COLOR,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 8,
    },

    // TABS
    tabsContainer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SLOT_PADDING,
    },
    tabSlot: {
        width: SLOT_WIDTH,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    iconWrapper: {
        alignItems: "center",
        justifyContent: "center",
    },
    badge: {
        position: "absolute",
        top: -4,
        right: -8,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#FF3B30",
        borderWidth: 2,
        borderColor: "#FFFFFF",
    },
});
