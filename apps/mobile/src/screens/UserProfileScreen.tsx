import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, resolveImageUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ProfileTimeline } from "../components/ProfileTimeline";
import { PrivateProfileGate } from "../components/PrivateProfileGate";
import { startOfWeek, addDays, format, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarEvent } from "../types/events";
import { theme } from "../theme";

const { width } = Dimensions.get("window");

// API response type
interface ApiEvent {
    id: string;
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    colorHex?: string;
    visibility?: string;
}

export default function UserProfileScreen({ route, navigation }: any) {
    const { userId } = route.params;
    const { user: currentUser } = useAuth();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [followingLoading, setFollowingLoading] = useState(false);

    // Calendar state
    const [weekOffset, setWeekOffset] = useState(0);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    const timelineRef = useRef<any>(null);

    const weekStart = useMemo(() => {
        const today = new Date();
        const startWeek = startOfWeek(today, { weekStartsOn: 1 });
        return addDays(startWeek, weekOffset * 7);
    }, [weekOffset]);

    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

    useEffect(() => {
        fetchUser();
    }, [userId]);

    // Compute canView: true if public OR following
    const canView = useMemo(() => {
        if (!user) return false;
        if (!user.isPrivate) return true;  // Public profile
        return user.isFollowing === true;   // Following a private profile
    }, [user?.isPrivate, user?.isFollowing]);

    useEffect(() => {
        if (userId && user) {
            // Only fetch events if we can view them
            if (canView) {
                fetchEvents();
            } else {
                setEvents([]);
            }
        }
    }, [userId, weekOffset, canView]);

    const fetchUser = async () => {
        try {
            const res = await api.get(`/users/${userId}`);
            setUser(res.data);
        } catch (error) {
            console.error(error);
            Alert.alert("Erreur", "Impossible de charger le profil");
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async () => {
        setEventsLoading(true);
        try {
            const from = weekStart.toISOString();
            const to = weekEnd.toISOString();
            const res = await api.get(`/users/${userId}/events?from=${from}&to=${to}`);
            const apiEvents: ApiEvent[] = res.data || [];

            // Transform API events to CalendarEvent format
            const transformedEvents: CalendarEvent[] = apiEvents.map(e => {
                const startDate = new Date(e.startAt);
                // getDay returns 0 for Sunday, we want 0 for Monday
                const dayOfWeek = getDay(startDate);
                const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

                return {
                    id: e.id,
                    userId: userId,
                    title: e.title,
                    description: e.description,
                    startAt: e.startAt,
                    endAt: e.endAt || e.startAt,
                    theme: "Autre" as const,
                    color: e.colorHex || "#FFA07A",
                    dayIndex,
                    colorHex: e.colorHex,
                };
            });

            setEvents(transformedEvents);
        } catch (error: any) {
            // Handle 403 as expected behavior for private profiles (not an error)
            if (error?.response?.status === 403) {
                console.info('[UserProfile] Private profile - events access denied (expected)');
            } else {
                console.error('Failed to fetch user events:', error);
            }
            setEvents([]);
        } finally {
            setEventsLoading(false);
        }
    };

    // Determine follow state: 'none' | 'requested' | 'following'
    const getFollowState = () => {
        if (user?.isFollowing) return 'following';
        if (user?.followRequestStatus === 'PENDING') return 'requested';
        return 'none';
    };

    const handleFollowToggle = async () => {
        if (followingLoading) return;
        setFollowingLoading(true);

        const previousState = getFollowState();
        const previousUser = { ...user };

        try {
            if (previousState === 'following') {
                // Unfollow
                await api.delete(`/users/${userId}/follow`);
                setUser((prev: any) => ({
                    ...prev,
                    isFollowing: false,
                    followRequestStatus: null,
                    metrics: {
                        ...prev.metrics,
                        followedBy: Math.max(0, prev.metrics.followedBy - 1)
                    }
                }));
                // canView will automatically update when user.isFollowing changes
            } else if (previousState === 'requested') {
                // Cancel request
                await api.delete(`/users/${userId}/follow`);
                setUser((prev: any) => ({
                    ...prev,
                    followRequestStatus: null
                }));
            } else {
                // Follow or Request
                const res = await api.post(`/users/${userId}/follow`);
                if (res.data.state === 'following') {
                    setUser((prev: any) => ({
                        ...prev,
                        isFollowing: true,
                        followRequestStatus: null,
                        metrics: {
                            ...prev.metrics,
                            followedBy: prev.metrics.followedBy + 1
                        }
                    }));
                    // canView will automatically update, triggering fetchEvents via useEffect
                } else if (res.data.state === 'requested') {
                    setUser((prev: any) => ({
                        ...prev,
                        followRequestStatus: 'PENDING'
                    }));
                }
            }
        } catch (error) {
            console.error(error);
            setUser(previousUser);
            Alert.alert("Erreur", "Impossible de modifier le statut d'abonnement");
        } finally {
            setFollowingLoading(false);
        }
    };

    const handleChangeWeek = useCallback((direction: number) => {
        setWeekOffset(prev => prev + direction);
    }, []);

    const getAvatarUri = () => {
        const name = user?.displayName || user?.username || 'U';
        if (user?.avatarUrl) {
            return resolveImageUrl(user.avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
    };

    const formatWeekLabel = () => {
        const endDate = addDays(weekStart, 6);
        const startStr = format(weekStart, "d MMM", { locale: fr });
        const endStr = format(endDate, "d MMM", { locale: fr });
        return `${startStr} - ${endStr}`;
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#FFA07A" />
            </View>
        );
    }

    const isMe = currentUser?.id === user?.id;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>@{user?.username}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Info */}
                <View style={styles.profileSection}>
                    <Image source={{ uri: getAvatarUri() }} style={styles.avatar} />
                    <Text style={styles.displayName}>{user?.displayName || user?.username}</Text>
                    <Text style={styles.handle}>@{user?.username}</Text>
                    <Text style={styles.bio}>{user?.bio || "Aucune description."}</Text>

                    {/* Follow Button */}
                    {!isMe && (
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                getFollowState() !== 'none' && styles.followingButton
                            ]}
                            onPress={handleFollowToggle}
                            disabled={followingLoading}
                        >
                            {followingLoading ? (
                                <ActivityIndicator size="small" color={getFollowState() === 'none' ? "#FFFFFF" : theme.colors.text.primary} />
                            ) : (
                                <Text style={[
                                    styles.followButtonText,
                                    getFollowState() !== 'none' && styles.followingButtonText
                                ]}>
                                    {getFollowState() === 'following'
                                        ? "Abonné"
                                        : getFollowState() === 'requested'
                                            ? "Demandé"
                                            : user?.isPrivate
                                                ? "Demander"
                                                : "S'abonner"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{user?.metrics?.Event || 0}</Text>
                            <Text style={styles.statLabel}>Events</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{user?.metrics?.followedBy || 0}</Text>
                            <Text style={styles.statLabel}>Abonnés</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{user?.metrics?.following || 0}</Text>
                            <Text style={styles.statLabel}>Suivi(e)s</Text>
                        </View>
                    </View>
                </View>

                {/* Calendar or Private Gate */}
                {!canView && user?.isPrivate ? (
                    <PrivateProfileGate />
                ) : (
                    <>
                        {/* Week Navigation */}
                        <View style={styles.weekNav}>
                            <TouchableOpacity onPress={() => handleChangeWeek(-1)} style={styles.weekNavButton}>
                                <Ionicons name="chevron-back" size={20} color="#000" />
                            </TouchableOpacity>
                            <Text style={styles.weekLabel}>{formatWeekLabel()}</Text>
                            <TouchableOpacity onPress={() => handleChangeWeek(1)} style={styles.weekNavButton}>
                                <Ionicons name="chevron-forward" size={20} color="#000" />
                            </TouchableOpacity>
                        </View>

                        {/* Calendar */}
                        <View style={styles.calendarContainer}>
                            {eventsLoading ? (
                                <View style={styles.calendarLoading}>
                                    <ActivityIndicator size="small" color="#FFA07A" />
                                </View>
                            ) : events.length === 0 ? (
                                <View style={styles.emptyCalendar}>
                                    <Ionicons name="calendar-outline" size={40} color="#C7C7CC" />
                                    <Text style={styles.emptyCalendarText}>Aucun événement cette semaine</Text>
                                </View>
                            ) : (
                                <ProfileTimeline
                                    ref={timelineRef}
                                    events={events}
                                    weekStart={weekStart}
                                    weekOffset={weekOffset}
                                    onChangeWeek={handleChangeWeek}
                                    contentTopPadding={0}
                                />
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#000",
        letterSpacing: -0.3,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    profileSection: {
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 24,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "#F2F2F7",
        marginBottom: 12,
    },
    displayName: {
        fontSize: 22,
        fontWeight: "700",
        color: "#000",
        marginBottom: 2,
    },
    handle: {
        fontSize: 15,
        color: "#8E8E93",
        marginBottom: 8,
    },
    bio: {
        fontSize: 14,
        color: "#8E8E93",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    followButton: {
        backgroundColor: "#000",
        paddingHorizontal: 32,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 24,
    },
    followingButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "#C7C7CC",
    },
    followButtonText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 15,
    },
    followingButtonText: {
        color: "#000",
    },
    statsContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
    },
    statItem: {
        alignItems: "center",
        minWidth: 70,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
    },
    statLabel: {
        fontSize: 12,
        color: "#8E8E93",
        marginTop: 2,
    },
    weekNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: "#E5E5EA",
    },
    weekNavButton: {
        padding: 8,
    },
    weekLabel: {
        fontSize: 15,
        fontWeight: "500",
        color: "#000",
        marginHorizontal: 16,
    },
    calendarContainer: {
        minHeight: 400,
    },
    calendarLoading: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCalendar: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCalendarText: {
        fontSize: 14,
        color: "#8E8E93",
        marginTop: 12,
    },
});
