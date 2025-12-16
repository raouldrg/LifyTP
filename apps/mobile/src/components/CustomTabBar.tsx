import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    return (
        <View style={styles.containerPointerEvents}>
            <View style={styles.container}>
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
                        >
                            <View style={[styles.iconContainer, isFocused && styles.activeIconContainer]}>
                                <Ionicons
                                    name={iconName}
                                    size={24}
                                    color={isFocused ? "#FFFFFF" : theme.colors.text.secondary}
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    containerPointerEvents: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingBottom: 34, // Safe area padding approximation or use SafeAreaView wrapper if strictly needed, but absolute positioning makes it tricky
    },
    container: {
        flexDirection: "row",
        backgroundColor: "rgba(255, 255, 255, 0.85)", // Glass effect simulation
        borderRadius: 32,
        marginHorizontal: 40,
        height: 64,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",
        width: "85%",
    },
    content: {
        // Removed as we are using container directly for layout now
    },
    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    iconContainer: {
        padding: 10,
        borderRadius: theme.borderRadius.round,
    },
    activeIconContainer: {
        backgroundColor: theme.colors.primary, // Black circle for active state
        transform: [{ scale: 1.1 }],
    },
});
