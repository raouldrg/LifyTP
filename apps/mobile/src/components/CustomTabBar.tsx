import React, { useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, StyleSheet, LayoutChangeEvent, Animated } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { useAuth } from "../lib/AuthContext";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { unreadCount } = useAuth();
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const animatedValue = useRef(new Animated.Value(0)).current;

    const numberOfTabs = state.routes.length;
    const tabWidth = layout.width ? layout.width / numberOfTabs : 0;

    useEffect(() => {
        if (layout.width === 0) return;

        Animated.spring(animatedValue, {
            toValue: state.index * tabWidth,
            useNativeDriver: true,
            friction: 12,
            tension: 50,
        }).start();
    }, [state.index, layout.width]);

    const handleLayout = (e: LayoutChangeEvent) => {
        setLayout({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
        });
    };

    return (
        <View style={styles.containerPointerEvents}>
            <BlurView intensity={95} tint="light" style={styles.blurContainer}>
                <View style={styles.container} onLayout={handleLayout}>
                    {/* Animated Bubble Indicator */}
                    {layout.width > 0 && (
                        <Animated.View
                            style={[
                                styles.activeBubble,
                                {
                                    width: tabWidth,
                                    transform: [{ translateX: animatedValue }],
                                },
                            ]}
                        >
                            <View style={styles.bubbleShape} />
                        </Animated.View>
                    )}

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

                        let iconName: keyof typeof Ionicons.glyphMap = "square";
                        if (route.name === "Home") iconName = isFocused ? "home" : "home-outline";
                        if (route.name === "Search") iconName = isFocused ? "search" : "search-outline";
                        if (route.name === "Messages") iconName = isFocused ? "chatbubble" : "chatbubble-outline";
                        if (route.name === "Profile") iconName = isFocused ? "person" : "person-outline";

                        return (
                            <TouchableOpacity
                                key={route.name}
                                accessibilityRole="button"
                                accessibilityState={isFocused ? { selected: true } : {}}
                                accessibilityLabel={options.tabBarAccessibilityLabel}
                                testID={options.tabBarTestID}
                                onPress={onPress}
                                style={styles.tab}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconContainer, isFocused && styles.activeIconContainer]}>
                                    <Ionicons
                                        name={iconName}
                                        size={24}
                                        color={isFocused ? theme.colors.accent : "rgba(60, 60, 67, 0.5)"}
                                    />
                                    {route.name === "Messages" && unreadCount > 0 && (
                                        <View style={styles.badge} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    containerPointerEvents: {
        position: 'absolute',
        bottom: 34,
        left: 30,
        right: 30,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 8,
    },
    blurContainer: {
        borderRadius: 30,
        overflow: 'hidden',
        width: '100%',
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.3)", // Glass edge effect
    },
    container: {
        flexDirection: "row",
        height: 60,
        backgroundColor: "rgba(255, 255, 255, 0.2)", // More transparent for liquid feel
        alignItems: "center",
        justifyContent: "space-around",
    },
    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: '100%',
        zIndex: 2, // Ensure icons are above bubble
    },
    iconContainer: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeIconContainer: {
        // Optional: Add subtle glow or scale ref wanted
    },
    activeBubble: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    bubbleShape: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(255, 255, 255, 0.7)", // High opacity white, no border
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    badge: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#FF3B30", // Active system red
        borderWidth: 1.5,
        borderColor: "#FFFFFF"
    }
});
