import React, { useState, useCallback, useEffect, useRef, memo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    Animated,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { FeedEventItem } from "../components/FeedEventItem";
import { useAuth } from "../context/AuthContext";
import { getEventFeed, FeedEvent } from "../services/eventService";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<"foryou" | "following">("following");
    const { user } = useAuth();

    // Animated value for segmented control pill
    const pillPosition = useRef(new Animated.Value(1)).current;
    const tabWidth = (SCREEN_WIDTH - 40) / 2;

    const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    // Real-time clock
    const [currentTime, setCurrentTime] = useState(new Date());

    // Timer for clock - updates every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleTabChange = (tab: "foryou" | "following") => {
        if (tab === activeTab) return;

        Animated.spring(pillPosition, {
            toValue: tab === "following" ? 1 : 0,
            useNativeDriver: true,
            tension: 68,
            friction: 12,
        }).start();

        setActiveTab(tab);
    };

    const loadFeed = useCallback(async (refresh = false) => {
        if (isLoading && !refresh) return;

        try {
            if (refresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            const cursor = refresh ? undefined : nextCursor || undefined;
            const response = await getEventFeed(cursor, 15);

            if (refresh) {
                setFeedEvents(response.items);
            } else {
                setFeedEvents(prev => cursor ? [...prev, ...response.items] : response.items);
            }
            setNextCursor(response.nextCursor);
            setHasLoadedOnce(true);
        } catch (error) {
            console.error('[HomeScreen] Error loading feed:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [nextCursor, isLoading]);

    useEffect(() => {
        if (activeTab === "following" && !hasLoadedOnce) {
            loadFeed(true);
        }
    }, [activeTab, hasLoadedOnce]);

    useFocusEffect(
        useCallback(() => {
            if (activeTab === "following") {
                loadFeed(true);
            }
        }, [activeTab])
    );

    const handleRefresh = useCallback(() => {
        loadFeed(true);
    }, [loadFeed]);

    const handleLoadMore = useCallback(() => {
        if (nextCursor && !isLoading) {
            loadFeed(false);
        }
    }, [nextCursor, isLoading, loadFeed]);

    const navigateToProfile = useCallback((userId: string) => {
        navigation.navigate('UserProfile', { userId });
    }, [navigation]);

    // Empty state
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={28} color="#C7C7CC" />
            </View>
            <Text style={styles.emptyTitle}>Aucun évènement</Text>
            <Text style={styles.emptySubtitle}>
                Les évènements de tes abonnements apparaîtront ici.
            </Text>
        </View>
    );

    // Skeleton
    const renderSkeleton = () => (
        <View style={styles.skeletonContainer}>
            {[1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonItem}>
                    <View style={styles.skeletonHeader}>
                        <View style={styles.skeletonAvatar} />
                        <View style={styles.skeletonMeta}>
                            <View style={styles.skeletonLine1} />
                            <View style={styles.skeletonLine2} />
                        </View>
                    </View>
                    <View style={styles.skeletonTitle} />
                    <View style={styles.skeletonDate} />
                </View>
            ))}
        </View>
    );

    // Render for "Pour vous" tab
    const renderForYouContent = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
                <Ionicons name="sparkles-outline" size={28} color="#C7C7CC" />
            </View>
            <Text style={styles.emptyTitle}>Bientôt disponible</Text>
            <Text style={styles.emptySubtitle}>
                Découvre de nouveaux contenus personnalisés.
            </Text>
        </View>
    );

    // Render for "Abonnements" tab
    const renderFollowingContent = () => {
        if (!hasLoadedOnce && isLoading) {
            return renderSkeleton();
        }

        return (
            <FlatList
                data={feedEvents}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <FeedEventItem
                        event={item}
                        index={index}
                        onPressProfile={() => navigateToProfile(item.owner.id)}
                    />
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#C7C7CC"
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={renderEmptyState}
                ListFooterComponent={
                    <>
                        {isLoading && !isRefreshing && feedEvents.length > 0 && (
                            <View style={styles.loadingMore}>
                                <ActivityIndicator color="#C7C7CC" size="small" />
                            </View>
                        )}
                        <View style={{ height: 100 }} />
                    </>
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        );
    };

    const pillTranslateX = pillPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [2, tabWidth + 2],
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <Text style={styles.logo}>
                        LIFY<Text style={styles.logoDot}>.</Text>
                    </Text>
                    <Text style={styles.clockText}>
                        {currentTime.toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })} · {currentTime.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        })}
                    </Text>
                </View>
            </View>

            {/* iOS Segmented Control */}
            <View style={styles.segmentedContainer}>
                <View style={styles.segmentedControl}>
                    <Animated.View
                        style={[
                            styles.segmentPill,
                            {
                                width: tabWidth - 4,
                                transform: [{ translateX: pillTranslateX }]
                            }
                        ]}
                    />

                    <TouchableOpacity
                        style={styles.segmentButton}
                        onPress={() => handleTabChange("foryou")}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.segmentText,
                            activeTab === "foryou" && styles.segmentTextActive
                        ]}>
                            Pour vous
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.segmentButton}
                        onPress={() => handleTabChange("following")}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.segmentText,
                            activeTab === "following" && styles.segmentTextActive
                        ]}>
                            Abonnements
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === "foryou" ? renderForYouContent() : renderFollowingContent()}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    clockText: {
        fontSize: 11,
        color: '#8E8E93',
        fontWeight: '400',
    },
    logo: {
        fontSize: 24,
        fontFamily: 'MontserratAlternates_700Bold',
        color: '#1A1A1A',
        letterSpacing: 0.3,
    },
    logoDot: {
        color: theme.colors.accent,
    },
    segmentedContainer: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: '#F2F2F7',
        borderRadius: 9,
        padding: 2,
        position: 'relative',
    },
    segmentPill: {
        position: 'absolute',
        top: 2,
        bottom: 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 7,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
    },
    segmentTextActive: {
        color: '#1A1A1A',
    },
    content: {
        flex: 1,
    },
    listContent: {
        paddingTop: 8,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        marginHorizontal: 20,
        marginVertical: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 20,
    },
    loadingMore: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    skeletonContainer: {
        paddingTop: 8,
    },
    skeletonItem: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.04)',
    },
    skeletonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    skeletonAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        marginRight: 12,
    },
    skeletonMeta: {
        flex: 1,
    },
    skeletonLine1: {
        height: 12,
        width: 100,
        backgroundColor: '#F0F0F0',
        borderRadius: 6,
        marginBottom: 6,
    },
    skeletonLine2: {
        height: 10,
        width: 140,
        backgroundColor: '#F5F5F5',
        borderRadius: 5,
    },
    skeletonTitle: {
        height: 18,
        width: '70%',
        backgroundColor: '#F0F0F0',
        borderRadius: 9,
        marginBottom: 10,
    },
    skeletonDate: {
        height: 12,
        width: '50%',
        backgroundColor: '#F5F5F5',
        borderRadius: 6,
    },
});
