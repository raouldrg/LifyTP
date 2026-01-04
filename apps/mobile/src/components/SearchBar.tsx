import React, { useRef, useState, useEffect } from "react";
import {
    TextInput,
    StyleSheet,
    Pressable,
    ViewStyle,
    TextStyle,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    FadeIn,
    FadeOut,
    interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
}

export function SearchBar({
    value,
    onChangeText,
    placeholder = "Rechercher...",
    autoFocus = false,
    onFocus,
    onBlur,
    containerStyle,
    inputStyle,
}: SearchBarProps) {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const searchBarScale = useSharedValue(1);
    const searchBarShadow = useSharedValue(0);

    useEffect(() => {
        if (autoFocus) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [autoFocus]);

    const handleFocus = () => {
        setIsFocused(true);
        searchBarScale.value = withSpring(1.02, { damping: 15, stiffness: 150 });
        searchBarShadow.value = withTiming(1, { duration: 200 });
        if (onFocus) onFocus();
    };

    const handleBlur = () => {
        setIsFocused(false);
        searchBarScale.value = withSpring(1, { damping: 15, stiffness: 150 });
        searchBarShadow.value = withTiming(0, { duration: 200 });
        if (onBlur) onBlur();
    };

    const clearSearch = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChangeText("");
        // Keep focus logic: if it was focused, keep it? or dismiss? 
        // SearchScreen keeps it implicitly if we don't dismiss.
        // Usually, clearing doesn't mean we want to stop searching.
        inputRef.current?.focus();
    };

    const searchBarAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: searchBarScale.value }],
        shadowOpacity: interpolate(searchBarShadow.value, [0, 1], [0, 0.12]),
        shadowRadius: interpolate(searchBarShadow.value, [0, 1], [0, 12]),
    }));

    return (
        <Animated.View
            style={[
                styles.searchContainer,
                containerStyle,
                searchBarAnimatedStyle,
            ]}
        >
            <Ionicons
                name="search"
                size={18}
                color={isFocused ? "#FFA07A" : "#8E8E93"}
                style={styles.searchIcon}
            />
            <TextInput
                ref={inputRef}
                style={[styles.searchInput, inputStyle]}
                placeholder={placeholder}
                placeholderTextColor="#8E8E93"
                value={value}
                onChangeText={onChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
            />
            {value.length > 0 && (
                <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
                    <Pressable
                        onPress={clearSearch}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close-circle" size={18} color="#C7C7CC" />
                    </Pressable>
                </Animated.View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F2F2F7",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        elevation: 0, // Elevation handled by shadow props if needed, but keeping consistent with SearchScreen
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#000",
        padding: 0,
    },
});
