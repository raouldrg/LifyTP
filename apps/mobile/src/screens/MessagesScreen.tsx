import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    RefreshControl,
    Keyboard,
    Pressable,
    Alert,
    NativeSyntheticEvent,
    NativeScrollEvent,

} from "react-native";
import { Swipeable } from 'react-native-gesture-handler';
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
    Layout,
} from "react-native-reanimated";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { ConversationItem, Conversation, Message } from "../components/ConversationItem";
import { LifyHeader } from "../components/LifyHeader";



// Skeleton with shimmer
function SkeletonItem({ index }: { index: number }) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        const animate = () => {
            shimmer.value = withTiming(1, { duration: 1000 }, () => {
                shimmer.value = 0;
            });
        };
        animate();
        const interval = setInterval(animate, 1500);
        return () => clearInterval(interval);
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    }));

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 60).duration(250)}
            style={styles.skeletonItem}
        >
            <Animated.View style={[styles.skeletonAvatar, shimmerStyle]} />
            <View style={styles.skeletonContent}>
                <Animated.View style={[styles.skeletonLine1, shimmerStyle]} />
                <Animated.View style={[styles.skeletonLine2, shimmerStyle]} />
            </View>
        </Animated.View>
    );
}

export default function MessagesScreen({ navigation }: any) {
    const { user, fetchUnreadCount } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    // Message requests count for badge
    const [requestsCount, setRequestsCount] = useState(0);


    const lastScrollY = useRef(0);
    const activeRowRef = useRef<Swipeable | null>(null);



    // Sort conversations
    const sortedConversations = useMemo(() => {
        return [...conversations].sort((a, b) => {
            const dateA = a.messages?.[0]?.createdAt || a.updatedAt;
            const dateB = b.messages?.[0]?.createdAt || b.updatedAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }, [conversations]);

    // Filter by search
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return sortedConversations;
        const query = searchQuery.toLowerCase();
        return sortedConversations.filter(convo => {
            const otherUser = convo.userAId === user?.id ? convo.userB : convo.userA;
            return otherUser?.username?.toLowerCase().includes(query);
        });
    }, [sortedConversations, searchQuery, user?.id]);

    // Fetch conversations
    const fetchConversations = async () => {
        try {
            setError(null);
            const res = await api.get("/conversations");
            setConversations(res.data);
        } catch (err) {
            console.error("[Messages] Fetch error:", err);
            setError("Impossible de charger les conversations");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch requests count for badge
    const fetchRequestsCount = async () => {
        try {
            const res = await api.get("/conversations/requests/count");
            setRequestsCount(res.data.count || 0);
        } catch (err) {
            console.error("[Messages] Fetch requests count error:", err);
        }
    };

    // Focus effect
    useFocusEffect(
        useCallback(() => {
            fetchConversations();
            fetchRequestsCount();
            fetchUnreadCount();
        }, [])
    );

    // Socket updates
    useEffect(() => {
        const handleNewMessage = (msg: any) => {
            setConversations(prev => {
                const convoIndex = prev.findIndex(c => c.id === msg.conversationId);
                if (convoIndex === -1) {
                    fetchConversations();
                    return prev;
                }

                const updated = [...prev];
                const convo = { ...updated[convoIndex] };
                const newMessage: Message = {
                    id: msg.id,
                    content: msg.content,
                    type: msg.type || 'TEXT',
                    senderId: msg.senderId,
                    read: false,
                    createdAt: msg.createdAt
                };

                convo.messages = [newMessage];
                convo.updatedAt = msg.createdAt;

                if (msg.senderId !== user?.id) {
                    convo.unreadCount = (convo.unreadCount || 0) + 1;
                }

                updated[convoIndex] = convo;
                return updated;
            });

            if (msg.senderId !== user?.id) {
                fetchUnreadCount();
            }
        };

        socket.on("message:new", handleNewMessage);
        return () => { socket.off("message:new", handleNewMessage); };
    }, [user?.id, fetchUnreadCount]);

    // Handlers
    const handleConversationPress = (convo: Conversation) => {
        const otherUser = convo.userAId === user?.id ? convo.userB : convo.userA;
        navigation.navigate("Chat", { conversationId: convo.id, otherUser });
    };

    const handleDeleteConversation = (convo: Conversation) => {
        Alert.alert(
            "Supprimer la conversation",
            "Cette action est irréversible.",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                        // Optimistic update
                        setConversations(prev => prev.filter(c => c.id !== convo.id));
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        try {
                            await api.delete(`/conversations/${convo.id}`);
                        } catch (error) {
                            console.error("[Messages] Delete error:", error);
                            // Rollback: restore conversation
                            setConversations(prev => {
                                const restored = [...prev, convo];
                                // Re-sort by date
                                return restored.sort((a, b) => {
                                    const dateA = a.messages?.[0]?.createdAt || a.updatedAt;
                                    const dateB = b.messages?.[0]?.createdAt || b.updatedAt;
                                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                                });
                            });
                            Alert.alert("Erreur", "Impossible de supprimer la conversation");
                        }
                    }
                }
            ]
        );
    };

    const handleMuteConversation = (convo: Conversation) => {
        setConversations(prev => prev.map(c => {
            if (c.id === convo.id) {
                return { ...c, isMuted: !c.isMuted };
            }
            return c;
        }));
    };

    const handleSwipeableOpen = (ref: Swipeable) => {
        if (activeRowRef.current && activeRowRef.current !== ref) {
            activeRowRef.current.close();
        }
        activeRowRef.current = ref;
    };

    const handleNewMessage = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate("NewMessage");
    };

    // Search focus/blur animations
    const handleSearchFocus = () => {
        setIsFocused(true);
    };

    const handleSearchBlur = () => {
        setIsFocused(false);
    };

    // Scroll handling
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const velocity = currentY - lastScrollY.current;
        if (velocity > 5 && isFocused) {
            Keyboard.dismiss();
        }
        lastScrollY.current = currentY;
    };



    // Empty state
    const EmptyState = () => (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={56} color="#D1D1D6" />
            </View>
            <Text style={styles.emptyTitle}>Aucun message</Text>
            <Text style={styles.emptySubtitle}>
                Commencez une conversation avec vos amis
            </Text>
            <Pressable style={styles.emptyButton} onPress={handleNewMessage}>
                <Text style={styles.emptyButtonText}>Nouvelle conversation</Text>
            </Pressable>
        </Animated.View>
    );

    // Error state
    const ErrorState = () => (
        <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
                style={styles.retryButton}
                onPress={() => { setLoading(true); fetchConversations(); }}
            >
                <Text style={styles.retryButtonText}>Réessayer</Text>
            </Pressable>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LifyHeader
                title="Messages"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Rechercher une conversation..."
                onSearchFocus={handleSearchFocus}
                onSearchBlur={handleSearchBlur}
                rightAction={
                    <Pressable
                        onPress={handleNewMessage}
                        style={({ pressed }) => [
                            styles.newButton,
                            pressed && styles.newButtonPressed
                        ]}
                    >
                        <Ionicons name="create-outline" size={22} color={theme.colors.accent} />
                    </Pressable>
                }
            />

            {/* Content */}
            {loading ? (
                <View style={styles.skeletonContainer}>
                    {[0, 1, 2, 3, 4].map(i => <SkeletonItem key={i} index={i} />)}
                </View>
            ) : error ? (
                <ErrorState />
            ) : (
                <Animated.ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchConversations(); }}
                            tintColor={theme.colors.accent}
                        />
                    }
                >
                    {filteredConversations.length === 0 && requestsCount === 0 ? (
                        <EmptyState />
                    ) : (
                        <>
                            {/* Message Requests Row */}
                            {requestsCount > 0 && (
                                <Pressable
                                    style={styles.requestsRow}
                                    onPress={() => navigation.navigate('MessageRequests')}
                                >
                                    <View style={styles.requestsIconContainer}>
                                        <Ionicons name="mail-unread" size={24} color={theme.colors.accent} />
                                    </View>
                                    <View style={styles.requestsContent}>
                                        <Text style={styles.requestsTitle}>Demandes de messages</Text>
                                        <Text style={styles.requestsSubtitle}>
                                            {requestsCount} demande{requestsCount > 1 ? 's' : ''} en attente
                                        </Text>
                                    </View>
                                    <View style={styles.requestsBadge}>
                                        <Text style={styles.requestsBadgeText}>{requestsCount}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                                </Pressable>
                            )}

                            {/* Conversations list */}
                            {filteredConversations.map((convo, index) => (
                                <ConversationItem
                                    key={convo.id}
                                    conversation={convo}
                                    currentUserId={user?.id || ""}
                                    index={index}
                                    onPress={handleConversationPress}
                                    onDelete={handleDeleteConversation}
                                    onMute={handleMuteConversation}
                                    onSwipeableOpen={handleSwipeableOpen}
                                />
                            ))}
                        </>
                    )}
                </Animated.ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },

    newButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.accent + "15",
        justifyContent: "center",
        alignItems: "center",
    },
    newButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },

    scrollView: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 120,
        flexGrow: 1,
    },
    // Skeleton
    skeletonContainer: {
        paddingHorizontal: 20,
    },
    skeletonItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
    },
    skeletonAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#E8E8E8",
    },
    skeletonContent: {
        flex: 1,
        marginLeft: 14,
    },
    skeletonLine1: {
        height: 14,
        width: "60%",
        backgroundColor: "#E8E8E8",
        borderRadius: 7,
        marginBottom: 8,
    },
    skeletonLine2: {
        height: 12,
        width: "80%",
        backgroundColor: "#E8E8E8",
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
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#F5F5F5",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1A1A1A",
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        color: "#8E8E93",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    emptyButton: {
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 24,
    },
    emptyButtonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "600",
    },
    // Error
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    errorText: {
        fontSize: 16,
        color: "#8E8E93",
        textAlign: "center",
        marginTop: 16,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: "#F2F2F7",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
    },
    retryButtonText: {
        color: theme.colors.accent,
        fontSize: 15,
        fontWeight: "600",
    },
    // Message Requests Row
    requestsRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
        backgroundColor: "rgba(255, 160, 122, 0.05)",
    },
    requestsIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(255, 160, 122, 0.15)",
        justifyContent: "center",
        alignItems: "center",
    },
    requestsContent: {
        flex: 1,
        marginLeft: 14,
    },
    requestsTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    requestsSubtitle: {
        fontSize: 13,
        color: "#8E8E93",
        marginTop: 2,
    },
    requestsBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: theme.colors.accent,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 6,
        marginRight: 8,
    },
    requestsBadgeText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
});
