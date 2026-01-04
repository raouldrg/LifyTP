import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    Keyboard,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Dimensions,
    Pressable,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    FadeIn,
    FadeOut,
    FadeInDown,
    Easing,
    interpolate,
} from "react-native-reanimated";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, resolveImageUrl } from "../services/api";
import { SearchBar } from "../components/SearchBar";
import { useFocusEffect } from "@react-navigation/native";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface User {
    id: string;
    username: string;
    avatarUrl?: string;
    bio?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Animated contact item with improved design
function ContactItem({ user, index, onPress }: { user: User; index: number; onPress: (user: User) => void }) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withTiming(0.97, { duration: 80 });
        opacity.value = withTiming(0.85, { duration: 80 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        opacity.value = withTiming(1, { duration: 100 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress(user);
    };

    const avatarUri = resolveImageUrl(user.avatarUrl)
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=FFA07A&color=fff&size=104`;

    return (
        <Animated.View entering={FadeInDown.delay(index * 30).duration(200).easing(Easing.out(Easing.cubic))}>
            <AnimatedPressable
                style={[styles.contactItem, animatedStyle]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
            >
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                </View>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactName} numberOfLines={1}>
                        {user.username}
                    </Text>
                    <Text style={styles.contactHandle} numberOfLines={1}>
                        @{user.username.toLowerCase()}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </AnimatedPressable>
        </Animated.View>
    );
}

// Skeleton with shimmer
function SkeletonItem({ index }: { index: number }) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        const animate = () => {
            shimmer.value = withTiming(1, { duration: 900 }, () => {
                shimmer.value = 0;
            });
        };
        animate();
        const interval = setInterval(animate, 1400);
        return () => clearInterval(interval);
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.35, 0.6, 0.35]),
    }));

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).duration(200)} style={styles.skeletonItem}>
            <Animated.View style={[styles.skeletonAvatar, shimmerStyle]} />
            <View style={styles.skeletonContent}>
                <Animated.View style={[styles.skeletonLine1, shimmerStyle]} />
                <Animated.View style={[styles.skeletonLine2, shimmerStyle]} />
            </View>
        </Animated.View>
    );
}

export default function NewMessageScreen({ navigation }: any) {
    const [friends, setFriends] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    const lastScrollY = useRef(0);


    // Animation values
    const searchBarScale = useSharedValue(1);
    const searchBarBorder = useSharedValue(0);

    // Auto-focus search on mount - REMOVED

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const res = await api.get("/friends");
            setFriends(res.data);
        } catch (error) {
            console.error("[NewMessage] Failed to fetch friends:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter friends
    const filteredFriends = useMemo(() => {
        if (!searchQuery.trim()) return friends;
        const query = searchQuery.toLowerCase();
        return friends.filter(friend =>
            friend.username?.toLowerCase().includes(query)
        );
    }, [friends, searchQuery]);

    // Handle user press
    const handleUserPress = useCallback((selectedUser: User) => {
        Keyboard.dismiss();
        navigation.goBack();
        // Slight delay to allow the modal dismissal to register/start
        setTimeout(() => {
            navigation.navigate("Chat", { otherUser: selectedUser });
        }, 100);
    }, [navigation]);

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.goBack();
    };

    // Search focus/blur
    const handleSearchFocus = () => {
        setIsFocused(true);
    };

    const handleSearchBlur = () => {
        setIsFocused(false);
    };

    // Scroll for keyboard dismiss
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const velocity = currentY - lastScrollY.current;
        if (velocity > 8 && isFocused) {
            Keyboard.dismiss();
        }
        lastScrollY.current = currentY;
    };



    // Empty state
    const EmptyState = () => (
        <Animated.View entering={FadeIn.duration(350)} style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="people-outline" size={48} color="#C7C7CC" />
            </View>
            <Text style={styles.emptyTitle}>Aucun contact</Text>
            <Text style={styles.emptySubtitle}>
                Suivez des utilisateurs pour leur envoyer des messages
            </Text>
        </Animated.View>
    );

    // No results
    const NoResultsState = () => (
        <Animated.View entering={FadeIn.duration(250)} style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={32} color="#C7C7CC" style={{ marginBottom: 12 }} />
            <Text style={styles.noResultsText}>
                Aucun résultat pour "{searchQuery}"
            </Text>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            {/* Header - Simplified with centered title and X button */}
            <View style={styles.header}>
                <Text style={styles.title}>Nouvelle conversation</Text>
                <Pressable
                    onPress={handleClose}
                    style={({ pressed }) => [
                        styles.closeButton,
                        pressed && styles.closeButtonPressed
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close" size={24} color="#1A1A1A" />
                </Pressable>
            </View>

            {/* Search Bar - Tight to header */}
            <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher un contact..."
                containerStyle={{
                    marginHorizontal: 20,
                    marginBottom: 12,
                }}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                autoFocus={false}
            />

            {/* Section header */}
            {!loading && friends.length > 0 && (
                <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Contacts</Text>
                    <Text style={styles.sectionCount}>{filteredFriends.length}</Text>
                </Animated.View>
            )}

            {/* Content */}
            {loading ? (
                <View style={styles.listContent}>
                    {[0, 1, 2, 3, 4].map(i => <SkeletonItem key={i} index={i} />)}
                </View>
            ) : (
                <Animated.ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    {filteredFriends.length === 0 ? (
                        searchQuery.length > 0 && friends.length > 0 ? (
                            <NoResultsState />
                        ) : (
                            <EmptyState />
                        )
                    ) : (
                        filteredFriends.map((friend, index) => (
                            <ContactItem
                                key={friend.id}
                                user={friend}
                                index={index}
                                onPress={handleUserPress}
                            />
                        ))
                    )}
                </Animated.ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
        position: 'relative',
    },
    title: {
        fontSize: 17,
        fontWeight: "600",
        color: "#1A1A1A",
        letterSpacing: -0.3,
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonPressed: {
        backgroundColor: '#E5E5EA',
        transform: [{ scale: 0.95 }],
    },


    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionCount: {
        fontSize: 13,
        fontWeight: '500',
        color: '#C7C7CC',
    },
    scrollView: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        flexGrow: 1,
    },
    // Contact item
    contactItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(0, 0, 0, 0.06)",
    },
    avatarContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#F0F0F0",
    },
    contactInfo: {
        flex: 1,
        marginLeft: 14,
    },
    contactName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1A1A1A",
        marginBottom: 3,
    },
    contactHandle: {
        fontSize: 14,
        color: "#8E8E93",
    },
    // Skeleton
    skeletonItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
    },
    skeletonAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#EBEBEB",
    },
    skeletonContent: {
        flex: 1,
        marginLeft: 14,
    },
    skeletonLine1: {
        height: 14,
        width: "45%",
        backgroundColor: "#EBEBEB",
        borderRadius: 7,
        marginBottom: 8,
    },
    skeletonLine2: {
        height: 12,
        width: "30%",
        backgroundColor: "#EBEBEB",
        borderRadius: 6,
    },
    // Empty state
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
        paddingBottom: 100,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#1A1A1A",
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        color: "#8E8E93",
        textAlign: "center",
        lineHeight: 22,
    },
    // No results
    noResultsContainer: {
        paddingVertical: 60,
        alignItems: "center",
    },
    noResultsText: {
        fontSize: 15,
        color: "#8E8E93",
        textAlign: 'center',
    },
});
