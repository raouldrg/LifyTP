import React, { useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, StyleSheet, LayoutChangeEvent, Animated } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const animatedValue = useRef(new Animated.Value(0)).current;

    const numberOfTabs = state.routes.length;
    const tabWidth = layout.width / numberOfTabs;

    useEffect(() => {
        if (layout.width === 0) return;

        Animated.spring(animatedValue, {
            toValue: state.index * tabWidth,
            useNativeDriver: true,
            friction: 9,
            tension: 60,
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
            <BlurView intensity={80} tint="light" style={styles.blurContainer}>
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
                                        size={28}
                                        color={isFocused ? "#FFFFFF" : theme.colors.text.secondary}
                                    />
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
        bottom: 30,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    blurContainer: {
        borderRadius: 35,
        overflow: 'hidden',
        width: '100%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    container: {
        flexDirection: "row",
        height: 70,
        backgroundColor: "rgba(255, 255, 255, 0.1)", // Much more transparent
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
        padding: 8,
    },
    activeIconContainer: {
        // No explicit style changes needed, icon color does the job
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
        width: 50, // Slightly improved shape size
        height: 50,
        borderRadius: 25,
        backgroundColor: "#FFA500",
        opacity: 0.8, // Increased opacity to make white icon visible
    }
});
