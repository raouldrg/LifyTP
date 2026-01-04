import React, { useEffect, useCallback } from "react";
import { View, StyleSheet, Platform, Dimensions, Pressable } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    Easing,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// DIMENSIONS
// ============================================
const TAB_BAR_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 300);
const TAB_BAR_HEIGHT = 60;
const BORDER_RADIUS = 30;
const ICON_SIZE = 23;
const TOUCH_TARGET = 46;

// Colors - Icons stay dark, orange = accent only
const ICON_COLOR_INACTIVE = "#6B6B70";  // Dark gray
const ICON_COLOR_ACTIVE = "#4A4A4E";    // Slightly darker when active
const ACCENT_COLOR = theme.colors.accent; // Orange for indicator only

// ============================================
// MAIN COMPONENT
// ============================================
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { unreadCount, pendingRequestsCount } = useAuth();
    const insets = useSafeAreaInsets();

    // Scroll-based visibility (prepared)
    const barVisibility = useSharedValue(1);
    const barTranslateY = useSharedValue(0);

    // Position: well anchored at safe area
    const bottomPosition = Math.max(insets.bottom, 10);

    // Animated style for scroll behavior
    const barAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: barTranslateY.value }],
            opacity: interpolate(
                barVisibility.value,
                [0, 1],
                [0.88, 1],
                Extrapolation.CLAMP
            ),
        };
    });

    // Check if hidden - MUST be AFTER all hooks
    const currentRoute = state.routes[state.index];
    const currentOptions = descriptors[currentRoute.key]?.options;
    const tabBarStyle = currentOptions?.tabBarStyle as any;
    const isHidden = tabBarStyle?.display === 'none';

    if (isHidden) return null;

    return (
        <Animated.View style={[styles.container, { bottom: bottomPosition }, barAnimatedStyle]}>
            <View style={styles.barWrapper}>
                <BlurView
                    intensity={Platform.OS === 'ios' ? 65 : 85}
                    tint="light"
                    style={styles.blur}
                >
                    {/* Glass overlay - white translucent */}
                    <View style={styles.glassOverlay} />

                    {/* Tabs */}
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
                                    navigation.navigate(route.name);
                                }
                            };

                            // Icons - outline when inactive, filled when active
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
                </BlurView>
            </View>
        </Animated.View>
    );
}

// ============================================
// TAB BUTTON
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
    const indicatorWidth = useSharedValue(isFocused ? 1 : 0);

    // Animate indicator
    useEffect(() => {
        indicatorWidth.value = withSpring(isFocused ? 1 : 0, {
            damping: 18,
            stiffness: 220
        });
    }, [isFocused]);

    const handlePressIn = useCallback(() => {
        scale.value = withTiming(0.94, {
            duration: 70,
            easing: Easing.out(Easing.ease),
        });
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, {
            damping: 14,
            stiffness: 200,
        });
    }, []);

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const indicatorAnimatedStyle = useAnimatedStyle(() => ({
        width: interpolate(indicatorWidth.value, [0, 1], [0, 18], Extrapolation.CLAMP),
        opacity: indicatorWidth.value,
    }));

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.tabButton}
        >
            <Animated.View style={[styles.iconContainer, buttonAnimatedStyle]}>
                {/* Icon - stays gray, just filled when active */}
                <Ionicons
                    name={iconName}
                    size={ICON_SIZE}
                    color={isFocused ? ICON_COLOR_ACTIVE : ICON_COLOR_INACTIVE}
                />

                {/* Orange line indicator - subtle accent */}
                <Animated.View style={[styles.lineIndicator, indicatorAnimatedStyle]} />

                {/* Notification badge */}
                {hasNotification && (
                    <View style={styles.badge} />
                )}
            </Animated.View>
        </Pressable>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    barWrapper: {
        width: TAB_BAR_WIDTH,
        height: TAB_BAR_HEIGHT,
        borderRadius: BORDER_RADIUS,
        overflow: 'hidden',
        // Very soft shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    blur: {
        flex: 1,
        borderRadius: BORDER_RADIUS,
        overflow: 'hidden',
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Platform.OS === 'ios'
            ? "rgba(255, 255, 255, 0.78)"
            : "rgba(255, 255, 255, 0.94)",
    },
    tabsContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: TOUCH_TARGET,
    },
    iconContainer: {
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lineIndicator: {
        position: 'absolute',
        bottom: 4,
        height: 2.5,
        borderRadius: 1.5,
        backgroundColor: ACCENT_COLOR,
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 8,
        height: 8,
        zIndex: 10,

        borderRadius: 4,
        backgroundColor: '#FF3B30',
    },
});
