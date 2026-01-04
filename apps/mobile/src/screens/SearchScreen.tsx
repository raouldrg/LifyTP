import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Image,
    StatusBar,
    Keyboard,
    Pressable,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    FadeIn,
    FadeInDown,
    Layout,
    Easing,
    interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, resolveImageUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SearchUserItem } from "../components/SearchUserItem";
import { LifyHeader } from "../components/LifyHeader";

// Debounce helper
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

interface User {
    id: string;
    username: string;
    avatarUrl?: string;
    bio?: string;
}

// Skeleton loading item component
function SkeletonItem({ index }: { index: number }) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withTiming(1, { duration: 1000 }, () => {
            shimmer.value = 0;
        });
        const interval = setInterval(() => {
            shimmer.value = withTiming(1, { duration: 1000 }, () => {
                shimmer.value = 0;
            });
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    }));

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 80).duration(300)}
            style={styles.skeletonContainer}
        >
            <Animated.View style={[styles.skeletonAvatar, shimmerStyle]} />
            <View style={styles.skeletonInfo}>
                <Animated.View style={[styles.skeletonName, shimmerStyle]} />
                <Animated.View style={[styles.skeletonHandle, shimmerStyle]} />
            </View>
        </Animated.View>
    );
}

export default function SearchScreen({ navigation }: any) {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 250);
    const [results, setResults] = useState<User[]>([]);
    const [recents, setRecents] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const lastScrollY = useRef(0);

    // Animated values
    const contentTranslateY = useSharedValue(0);

    const getRecentsKey = () => `recent_visits_${user?.id || "guest"}`;

    useEffect(() => {
        if (user?.id) {
            loadRecents();
        } else {
            setRecents([]);
        }
    }, [user?.id]);

    const loadRecents = async () => {
        try {
            const json = await AsyncStorage.getItem(getRecentsKey());
            if (json) {
                setRecents(JSON.parse(json));
            } else {
                setRecents([]);
            }
        } catch (e) {
            console.error("Failed to load recents", e);
        }
    };

    const saveRecent = async (visitedUser: User) => {
        if (!user?.id) return;
        try {
            const filtered = recents.filter((item) => item.id !== visitedUser.id);
            const updated = [visitedUser, ...filtered].slice(0, 10);
            setRecents(updated);
            await AsyncStorage.setItem(getRecentsKey(), JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save recent", e);
        }
    };

    const clearRecents = async () => {
        if (!user?.id) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            setRecents([]);
            await AsyncStorage.removeItem(getRecentsKey());
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (debouncedSearchQuery.length > 0) {
            searchUsers(debouncedSearchQuery);
            setHasSearched(true);
        } else {
            setResults([]);
            setHasSearched(false);
        }
    }, [debouncedSearchQuery]);

    const searchUsers = async (q: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
            setResults(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserPress = (resultUser: User) => {
        saveRecent(resultUser);
        Keyboard.dismiss();
        if (resultUser.id === user?.id) {
            navigation.navigate("Profile", { screen: "ProfileIndex" });
        } else {
            navigation.push("UserProfile", { userId: resultUser.id });
        }
    };

    const clearSearch = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSearchQuery("");
        setResults([]);
        setHasSearched(false);
    };

    // Search bar focus/blur animations
    // Search bar focus/blur animations
    const handleFocus = () => {
        setIsFocused(true);
        contentTranslateY.value = withTiming(-8, { duration: 250, easing: Easing.out(Easing.cubic) });
    };

    const handleBlur = () => {
        setIsFocused(false);
        contentTranslateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    };



    const contentAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: contentTranslateY.value }],
    }));

    // Scroll handling for keyboard dismiss
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const velocity = currentY - lastScrollY.current;

        // Dismiss keyboard on scroll down with velocity
        if (velocity > 5 && isFocused) {
            Keyboard.dismiss();
        }

        lastScrollY.current = currentY;
    };

    const showRecents = searchQuery.length === 0;
    const dataToShow = showRecents ? recents : results;

    const renderEmptyState = () => {
        if (loading) {
            return (
                <View style={styles.skeletonsContainer}>
                    <SkeletonItem index={0} />
                    <SkeletonItem index={1} />
                    <SkeletonItem index={2} />
                </View>
            );
        }

        if (showRecents && recents.length === 0) {
            return (
                <Animated.View
                    entering={FadeIn.duration(400)}
                    style={styles.emptyContainer}
                >
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="search-outline" size={44} color="#C7C7CC" />
                    </View>
                    <Text style={styles.emptyTitle}>Recherchez un profil</Text>
                    <Text style={styles.emptySubtitle}>
                        Trouvez des amis par leur nom d'utilisateur
                    </Text>
                </Animated.View>
            );
        }

        if (hasSearched && results.length === 0) {
            return (
                <Animated.View
                    entering={FadeIn.duration(400)}
                    style={styles.emptyContainer}
                >
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="person-outline" size={44} color="#C7C7CC" />
                    </View>
                    <Text style={styles.emptyTitle}>Aucun résultat</Text>
                    <Text style={styles.emptySubtitle}>
                        Essayez avec un autre nom
                    </Text>
                </Animated.View>
            );
        }

        return null;
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <LifyHeader
                title="Recherche"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Rechercher..."
                onSearchFocus={handleFocus}
                onSearchBlur={handleBlur}
                rightAction={null}
            />

            {/* Content */}
            <Animated.ScrollView
                style={[styles.scrollView, contentAnimatedStyle]}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {/* Recents Header */}
                {showRecents && recents.length > 0 && (
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        layout={Layout.duration(200)}
                        style={styles.sectionHeader}
                    >
                        <Text style={styles.sectionTitle}>Récents</Text>
                        <Pressable
                            onPress={clearRecents}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.clearText}>Effacer</Text>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Results or Recents */}
                {dataToShow.length > 0 ? (
                    <Animated.View layout={Layout.duration(200)}>
                        {dataToShow.map((item, index) => (
                            <SearchUserItem
                                key={item.id}
                                user={item}
                                index={index}
                                onPress={handleUserPress}
                            />
                        ))}
                    </Animated.View>
                ) : (
                    renderEmptyState()
                )}
            </Animated.ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },

    scrollView: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
        flexGrow: 1,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    clearText: {
        fontSize: 14,
        color: "#FFA07A",
        fontWeight: "500",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 60,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#F5F5F5",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#1A1A1A",
        marginTop: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "#8E8E93",
        marginTop: 6,
        textAlign: "center",
        paddingHorizontal: 40,
    },
    // Skeleton styles
    skeletonsContainer: {
        paddingTop: 8,
    },
    skeletonContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 4,
    },
    skeletonAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#E8E8E8",
    },
    skeletonInfo: {
        flex: 1,
        marginLeft: 14,
    },
    skeletonName: {
        width: 120,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#E8E8E8",
    },
    skeletonHandle: {
        width: 80,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#E8E8E8",
        marginTop: 6,
    },
});
