import React, { ReactNode } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import Animated, {
    FadeInDown,
} from "react-native-reanimated";
import { theme } from "../theme";
import { SearchBar } from "./SearchBar";

interface LifyHeaderProps {
    /** Page title (e.g., "Messages", "Recherche") */
    title: string;
    /** Current search bar value */
    searchValue: string;
    /** Callback when search text changes */
    onSearchChange: (text: string) => void;
    /** Search bar placeholder text */
    searchPlaceholder?: string;
    /** Optional right action (button/icon). Pass null for no action but keep spacing. */
    rightAction?: ReactNode | null;
    /** Callback when search bar gains focus */
    onSearchFocus?: () => void;
    /** Callback when search bar loses focus */
    onSearchBlur?: () => void;
    /** Whether to auto-focus the search bar */
    autoFocusSearch?: boolean;
    /** Optional additional container style */
    containerStyle?: ViewStyle;
}

/**
 * Unified header component for page consistency.
 * Ensures pixel-perfect alignment between screens like Messages and Recherche.
 */
export function LifyHeader({
    title,
    searchValue,
    onSearchChange,
    searchPlaceholder = "Rechercher...",
    rightAction,
    onSearchFocus,
    onSearchBlur,
    autoFocusSearch = false,
    containerStyle,
}: LifyHeaderProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            {/* Title Row */}
            <Animated.View
                entering={FadeInDown.duration(200).springify().damping(20)}
                style={styles.titleRow}
            >
                <Text style={styles.title}>{title}</Text>
                {/* Right action or invisible placeholder for alignment */}
                <View style={styles.actionContainer}>
                    {rightAction !== undefined ? rightAction : null}
                </View>
            </Animated.View>

            {/* Search Bar */}
            <SearchBar
                value={searchValue}
                onChangeText={onSearchChange}
                placeholder={searchPlaceholder}
                containerStyle={styles.searchBar}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                autoFocus={autoFocusSearch}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#FFFFFF",
    },
    titleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: theme.header.paddingHorizontal,
        paddingVertical: theme.header.paddingVertical,
    },
    title: {
        fontSize: theme.typography.pageTitle.fontSize,
        fontWeight: theme.typography.pageTitle.fontWeight,
        letterSpacing: theme.typography.pageTitle.letterSpacing,
        color: "#1A1A1A",
    },
    actionContainer: {
        // Fixed size to prevent layout shift when action is present/absent
        width: theme.header.actionButtonSize,
        height: theme.header.actionButtonSize,
        justifyContent: "center",
        alignItems: "center",
    },
    searchBar: {
        marginHorizontal: theme.header.paddingHorizontal,
        marginBottom: theme.header.searchBarMarginBottom,
    },
});
