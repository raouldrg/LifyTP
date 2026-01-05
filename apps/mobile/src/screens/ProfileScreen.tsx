import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedScrollHandler,
    useDerivedValue,
    useAnimatedReaction,
    interpolate,
    Extrapolation,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ProfileHeader, getHeaderExpandedHeight, HEADER_COLLAPSED_HEIGHT } from '../components/ProfileHeader';
import AvatarViewerModal from '../components/AvatarViewerModal';
import { ProfileTimeline } from '../components/ProfileTimeline';
import { CalendarEvent } from '../types/events';
import { DEFAULT_THEMES } from '../constants/eventThemes';
import { EventEditSheet } from '../components/EventEditSheet';
import { CreateEventSheet } from '../components/CreateEventSheet';
import {
    getEvents, createEvent, updateEvent, deleteEvent as deleteEventApi,
    getCachedEvents, setCachedEvents, apiEventToCalendarEvent
} from '../services/eventService';
import * as Haptics from 'expo-haptics';
import { PrivateProfileGate } from '../components/PrivateProfileGate';


// Date Helpers
const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const addWeeks = (date: Date, weeks: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + (weeks * 7));
    return d;
};

interface ProfileScreenProps {
    navigation: any;
    route?: {
        params?: {
            userId?: string;
            onRequestsUpdate?: (data: { accepted: boolean }) => void;
            onStatsUpdate?: () => void;
            onFollowChange?: (status: 'following' | 'none' | 'requested') => void;
        };
    };
}

export default function ProfileScreen({ navigation, route }: ProfileScreenProps) {
    const { user: currentUser, signOut, pendingRequestsCount, setPendingRequestsCount } = useAuth();

    // Determine if viewing another user's profile
    const targetUserId = route?.params?.userId;
    const isOwnProfile = !targetUserId || targetUserId === currentUser?.id;
    const onFollowChange = route?.params?.onFollowChange;

    // Debug log
    useEffect(() => {
        if (!isOwnProfile && onFollowChange) {
            console.log('[Profile] Loaded with onFollowChange callback');
        }
    }, [isOwnProfile, onFollowChange]);

    const [profileUser, setProfileUser] = useState<any>(isOwnProfile ? currentUser : null);
    const [activeTab, setActiveTab] = useState<'own' | 'tagged'>('own');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    const [isSheetVisible, setSheetVisible] = useState(false);
    const [isCreateSheetVisible, setCreateSheetVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [createEventDate, setCreateEventDate] = useState<Date | undefined>(undefined);
    const [createEventTime, setCreateEventTime] = useState<string | undefined>(undefined);
    const [profileStats, setProfileStats] = useState({ followers: 0, following: 0, eventsCount: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [followRequestStatus, setFollowRequestStatus] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [showAvatarViewer, setShowAvatarViewer] = useState(false);

    // Helper to get follow state for PrivateProfileGate
    const getFollowState = useCallback((): 'none' | 'requested' | 'following' => {
        if (isFollowing) return 'following';
        if (followRequestStatus === 'PENDING') return 'requested';
        return 'none';
    }, [isFollowing, followRequestStatus]);

    // Compute canView: true if own profile, OR public profile, OR following a private profile
    const canView = useMemo(() => {
        if (isOwnProfile) return true;
        if (!profileUser) return false;
        if (!profileUser.isPrivate) return true;  // Public profile
        return isFollowing;  // Following a private profile
    }, [isOwnProfile, profileUser?.isPrivate, isFollowing]);

    // Hide tab bar when event sheet is visible (only for own profile)
    useEffect(() => {
        if (!isOwnProfile) return;
        const parent = navigation.getParent();
        if (isSheetVisible || isCreateSheetVisible) {
            parent?.setOptions({ tabBarStyle: { display: 'none' } });
        } else {
            parent?.setOptions({ tabBarStyle: undefined });
        }
    }, [isSheetVisible, isCreateSheetVisible, navigation, isOwnProfile]);

    // Fetch profile user data (for other users)
    useEffect(() => {
        if (isOwnProfile) {
            setProfileUser(currentUser);
            return;
        }

        // Fetch other user's profile
        api.get(`/users/${targetUserId}`)
            .then(res => {
                setProfileUser(res.data);
                setIsFollowing(res.data.isFollowing || false);
                setFollowRequestStatus(res.data.followRequestStatus || null);

                const data = res.data;
                const followers = data._count?.followedBy ?? data.metrics?.followedBy ?? 0;
                const following = data._count?.following ?? data.metrics?.following ?? 0;
                const eventsCount = data._count?.Event ?? data.metrics?.Event ?? 0;
                setProfileStats({ followers, following, eventsCount });
            })
            .catch(err => {
                console.error("[PROFILE] Failed to fetch user:", err);
                Alert.alert("Erreur", "Impossible de charger le profil");
                navigation.goBack();
            });
    }, [targetUserId, isOwnProfile, currentUser]);

    // FETCH STATS (for own profile)
    // FETCH STATS (for own profile) - Moved to function to allow manual refresh and focus refresh
    const fetchProfileStats = useCallback(() => {
        if (!isOwnProfile || !currentUser?.id) return;

        // Fetch user stats
        api.get(`/users/${currentUser.id}`)
            .then(res => {
                const data = res.data;
                const followers =
                    data._count?.followers ??
                    data._count?.followedBy ??
                    data.metrics?.followers ??
                    data.metrics?.followersCount ??
                    data.followersCount ?? 0;

                const following =
                    data._count?.following ??
                    data.metrics?.following ??
                    data.metrics?.followingCount ??
                    data.followingCount ?? 0;

                const eventsCount =
                    data._count?.Event ??
                    data.metrics?.Event ??
                    data.eventsCount ?? 0;

                setProfileStats({ followers, following, eventsCount });
            })
            .catch(err => {
                console.log("[PROFILE] Failed to fetch stats:", err.message);
            });

        // Fetch pending follow requests count (Global Auth Context handles this mostly, but good to sync)
        api.get('/follow/requests/count')
            .then(res => {
                setPendingRequestsCount(res.data.count || 0);
            })
            .catch(err => {
                console.log("[PROFILE] Failed to fetch pending requests count:", err.message);
            });
    }, [isOwnProfile, currentUser?.id, setPendingRequestsCount]);

    // Refresh stats on mount and focus
    useFocusEffect(
        useCallback(() => {
            fetchProfileStats();
        }, [fetchProfileStats])
    );

    // LOAD EVENTS
    const loadEvents = useCallback(async (weekStart: Date) => {
        const userId = isOwnProfile ? currentUser?.id : targetUserId;
        if (!userId) return;

        // For other users: check canView before making API call
        if (!isOwnProfile && !canView) {
            console.info('[Profile] Skipping events fetch - private profile, not following');
            setEvents([]);
            return;
        }

        console.log("[Profile] loadEvents - userId:", userId, "isOwnProfile:", isOwnProfile);

        const from = weekStart.toISOString();
        const to = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // For own profile: cache-first
        if (isOwnProfile) {
            const cached = await getCachedEvents(userId);
            if (cached.length > 0) {
                setEvents(cached);
            }
        }

        setIsLoadingEvents(true);
        try {
            let apiEvents;
            if (isOwnProfile) {
                apiEvents = await getEvents(from, to);
            } else {
                // Fetch other user's events
                console.log(`[Profile] Fetching public events for ${userId}`);
                const res = await api.get(`/users/${userId}/events?from=${from}&to=${to}`);
                apiEvents = res.data || [];
                console.log(`[Profile] Fetched ${apiEvents.length} events for ${userId}`);
            }

            const calendarEvents = apiEvents.map(apiEventToCalendarEvent);
            setEvents(calendarEvents);

            if (isOwnProfile) {
                await setCachedEvents(userId, calendarEvents);
            }
        } catch (error: any) {
            // Handle 403 as expected for private profiles (info, not error)
            if (error?.response?.status === 403) {
                console.info('[Profile] Private profile - events access denied');
            } else {
                console.error('[PROFILE] Error loading events:', error);
            }
            setEvents([]);
        } finally {
            setIsLoadingEvents(false);
        }
    }, [currentUser?.id, targetUserId, isOwnProfile, canView]);

    // Reference to Timeline (ScrollView)
    const timelineRef = useRef<any>(null);

    // --- WEEK STATE ---
    const [weekOffset, setWeekOffset] = useState(0);
    const [currentStartOfWeek, setCurrentStartOfWeek] = useState(getStartOfWeek(new Date()));
    const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
    const [monthIndicator, setMonthIndicator] = useState<string | null>(null);

    useEffect(() => {
        const start = getStartOfWeek(new Date());
        const newStart = addWeeks(start, weekOffset);

        if (currentStartOfWeek.getMonth() !== newStart.getMonth()) {
            const monthName = newStart.toLocaleString('fr-FR', { month: 'long' });
            const formatted = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            setMonthIndicator(formatted);
            setTimeout(() => setMonthIndicator(null), 1500);
        }
        setCurrentStartOfWeek(newStart);

        // Load events for new week
        loadEvents(newStart);
    }, [weekOffset, loadEvents]);

    const changeWeek = (direction: number) => {
        setSlideDirection(direction > 0 ? 'right' : 'left');
        setWeekOffset(prev => prev + direction);
    };

    const handleDoubleTapDate = useCallback(() => {
        setWeekOffset(0);
        setSlideDirection(weekOffset > 0 ? 'left' : 'right');
    }, [weekOffset]);

    // Derived Week Days for Header
    const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentStartOfWeek);
        d.setDate(d.getDate() + i);
        const now = new Date();
        const isToday = d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
        return {
            name: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()],
            date: d,
            isToday
        };
    }), [currentStartOfWeek]);


    // ========================================
    // SCROLL & HEADER LOGIC — VELOCITY-BASED TOGGLE
    // ========================================

    const scrollY = useSharedValue(0);
    const isFirstLoad = useRef(true);

    const headerMode = useSharedValue(0);
    const modeProgress = useSharedValue(0);

    const lastScrollY = useSharedValue(0);
    const lastScrollTime = useSharedValue(0);

    const isBooting = useSharedValue(true);
    const lastToggleTime = useSharedValue(0);

    const VELOCITY_THRESHOLD = 0.3;
    const DY_THRESHOLD = 25;
    const TOGGLE_COOLDOWN = 250;
    const TOP_EDGE_THRESHOLD = 50;

    const onTimelineReady = useCallback((offset: number) => {
        scrollY.value = offset;
        lastScrollY.value = offset;
        lastScrollTime.value = Date.now();

        if (timelineRef.current && isFirstLoad.current) {
            timelineRef.current.scrollTo(offset, false);
            isFirstLoad.current = false;

            setTimeout(() => {
                isBooting.value = false;
            }, 300);
        }
    }, []);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const y = event.contentOffset.y;
            const now = Date.now();

            const dy = y - lastScrollY.value;
            const dt = Math.max(now - lastScrollTime.value, 1);
            const velocity = dy / dt;

            lastScrollY.value = y;
            lastScrollTime.value = now;
            scrollY.value = y;

            if (isBooting.value) return;
            if (now - lastToggleTime.value < TOGGLE_COOLDOWN) return;

            if (y < TOP_EDGE_THRESHOLD && headerMode.value === 1) {
                headerMode.value = 0;
                modeProgress.value = withTiming(0, {
                    duration: 220,
                    easing: Easing.out(Easing.cubic)
                });
                lastToggleTime.value = now;
                return;
            }

            if (velocity > 0.1 && y > 1500 && headerMode.value === 0) {
                headerMode.value = 1;
                modeProgress.value = withTiming(1, {
                    duration: 220,
                    easing: Easing.out(Easing.cubic)
                });
                lastToggleTime.value = now;
                return;
            }

            if (velocity > VELOCITY_THRESHOLD && dy > DY_THRESHOLD) {
                if (headerMode.value === 0) {
                    headerMode.value = 1;
                    modeProgress.value = withTiming(1, {
                        duration: 220,
                        easing: Easing.out(Easing.cubic)
                    });
                    lastToggleTime.value = now;
                }
            } else if (velocity < -VELOCITY_THRESHOLD && dy < -DY_THRESHOLD) {
                if (headerMode.value === 1) {
                    headerMode.value = 0;
                    modeProgress.value = withTiming(0, {
                        duration: 220,
                        easing: Easing.out(Easing.cubic)
                    });
                    lastToggleTime.value = now;
                }
            }
        },
        onEndDrag: (e) => {
            // No snap logic needed
        }
    });

    const progress = useDerivedValue(() => {
        return modeProgress.value;
    });

    // Use dynamic header height based on profile type
    // IMPORTANT: Height is computed ONCE here, not inside worklet (JS functions can't be called in worklets)
    const headerExpandedHeight = getHeaderExpandedHeight(isOwnProfile);
    const rTimelineTopPadding = useSharedValue(headerExpandedHeight);

    useAnimatedReaction(
        () => {
            // Use the pre-computed headerExpandedHeight (captured in closure)
            // This works because the value is a primitive number, not a JS function call
            return interpolate(
                progress.value,
                [0, 1],
                [headerExpandedHeight, HEADER_COLLAPSED_HEIGHT],
                Extrapolation.CLAMP
            );
        },
        (result) => {
            rTimelineTopPadding.value = result;
        },
        [headerExpandedHeight] // Dependency to recalculate if profile type changes
    );

    useFocusEffect(
        useCallback(() => {
            headerMode.value = 0;
            modeProgress.value = 0;
            isBooting.value = true;

            if (timelineRef.current && timelineRef.current.ensureCenteredNow) {
                timelineRef.current.ensureCenteredNow("focus_effect");
            }

            setTimeout(() => {
                isBooting.value = false;
            }, 300);
        }, [])
    );

    // Event Handling (only for own profile)
    const handleEventPress = (event: CalendarEvent) => {
        if (!isOwnProfile) return; // Read-only for other profiles
        setSelectedEvent(event);
        setSheetVisible(true);
    };

    const handleEmptySlotPress = (dayIndex: number, startAt: string) => {
        if (!isOwnProfile) return; // Read-only for other profiles

        // Parse the date and time from startAt
        const startDate = new Date(startAt);
        const hours = String(startDate.getHours()).padStart(2, '0');
        const minutes = String(Math.floor(startDate.getMinutes() / 5) * 5).padStart(2, '0');

        setCreateEventDate(startDate);
        setCreateEventTime(`${hours}:${minutes}`);
        setCreateSheetVisible(true);
    };

    const handleSaveEvent = async (e: CalendarEvent) => {
        if (!isOwnProfile) return;
        try {
            if (e.id) {
                await updateEvent(e.id, {
                    title: e.title,
                    description: e.description,
                    startAt: e.startAt,
                    endAt: e.endAt,
                    themeId: e.themeId,
                    colorHex: e.colorHex,
                });
            } else {
                await createEvent({
                    title: e.title,
                    description: e.description,
                    startAt: e.startAt,
                    endAt: e.endAt,
                    themeId: e.themeId,
                    colorHex: e.colorHex,
                });
            }
            loadEvents(currentStartOfWeek);
        } catch (error) {
            console.error('[PROFILE] Error saving event:', error);
            Alert.alert('Erreur', 'Impossible de sauvegarder l\'événement.');
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!isOwnProfile) return;
        try {
            await deleteEventApi(id);
            loadEvents(currentStartOfWeek);
        } catch (error) {
            console.error('[PROFILE] Error deleting event:', error);
            Alert.alert('Erreur', 'Impossible de supprimer l\'événement.');
        }
    };

    // Follow/Unfollow handler - handles both public follows and private profile requests
    const handleFollowToggle = async () => {
        if (followLoading || !targetUserId) return;
        setFollowLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const currentState = getFollowState();

        try {
            if (currentState === 'following') {
                // Unfollow
                await api.delete(`/users/${targetUserId}/follow`);
                setIsFollowing(false);
                setFollowRequestStatus(null);
                setProfileStats(prev => ({
                    ...prev,
                    followers: Math.max(0, prev.followers - 1)
                }));
                if (onFollowChange) onFollowChange('none');
            } else if (currentState === 'requested') {
                // Cancel pending request
                await api.delete(`/users/${targetUserId}/follow`);
                setFollowRequestStatus(null);
                if (onFollowChange) onFollowChange('none');
            } else {
                // Follow or send request
                const res = await api.post(`/users/${targetUserId}/follow`);
                if (res.data.state === 'following') {
                    // Direct follow (public profile)
                    setIsFollowing(true);
                    setFollowRequestStatus(null);
                    setProfileStats(prev => ({
                        ...prev,
                        followers: prev.followers + 1
                    }));
                    if (onFollowChange) onFollowChange('following');
                } else if (res.data.state === 'requested') {
                    // Follow request sent (private profile)
                    setFollowRequestStatus('PENDING');
                    if (onFollowChange) onFollowChange('requested');
                }
            }
        } catch (error) {
            console.error('[PROFILE] Follow toggle error:', error);
            Alert.alert('Erreur', 'Impossible de modifier le statut d\'abonnement');
        } finally {
            setFollowLoading(false);
        }
    };

    // Callback for optimistic updates when handling follow requests in UserListScreen
    const handleRequestsUpdate = useCallback(({ accepted }: { accepted: boolean }) => {
        console.log('[Profile] Optimistic update request handled:', accepted);
        setPendingRequestsCount(prev => Math.max(0, prev - 1));
        if (accepted) {
            setProfileStats(prev => ({
                ...prev,
                followers: Number(prev.followers) + 1
            }));
        }
    }, []);

    // Callback for generic stats updates (e.g. unfollowing someone or accepting request)
    const handleStatsUpdate = useCallback(() => {
        console.log('[Profile] Stats update triggered from UserList');
        fetchProfileStats();
    }, [fetchProfileStats]);

    const handleFollowersPress = useCallback(() => {
        navigation.navigate('UserList', {
            userId: isOwnProfile ? currentUser?.id : targetUserId,
            type: 'followers',
            title: 'Abonnés',
            // Only pass callback if it's our own profile (where we can manage requests)
            onRequestsUpdate: isOwnProfile ? handleRequestsUpdate : undefined,
            onStatsUpdate: handleStatsUpdate
        });
    }, [navigation, isOwnProfile, currentUser?.id, targetUserId, handleRequestsUpdate, handleStatsUpdate]);

    const handleFollowingPress = useCallback(() => {
        navigation.navigate('UserList', {
            userId: isOwnProfile ? currentUser?.id : targetUserId,
            type: 'following',
            title: 'Abonnements',
            onStatsUpdate: handleStatsUpdate
        });
    }, [navigation, isOwnProfile, currentUser?.id, targetUserId, handleStatsUpdate]);

    // Handler for Message button - navigates to chat with request context
    const handleMessagePress = useCallback(async () => {
        if (!targetUserId || !profileUser) return;

        try {
            // Call API to get or create conversation
            const res = await api.get(`/conversations/with/${targetUserId}`);
            const { conversation, isRequest, isInitiator } = res.data;

            // Navigate to chat - conversationId may be null (draft mode)
            navigation.navigate('Chat', {
                otherUser: profileUser,
                conversationId: conversation?.id || null,  // null = draft mode
                conversationStatus: conversation?.status || null,
                isRequest: isRequest ?? profileUser.isPrivate,  // assume request if private
                isInitiator: isInitiator ?? true
            });
        } catch (error) {
            console.error('[Profile] Failed to open message:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
        }
    }, [targetUserId, profileUser, navigation]);

    // Choose what to display for the user
    const displayUser = isOwnProfile ? currentUser : profileUser;

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right']}>

            {/* Back button for other profiles */}
            {!isOwnProfile && (
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
            )}

            {/* 1. HEADER OVERLAY (Absolute) */}
            <View style={styles.headerOverlay}>
                <ProfileHeader
                    user={displayUser}
                    stats={{
                        events: profileStats.eventsCount || events.length,
                        followers: profileStats.followers || 0,
                        following: profileStats.following || 0
                    }}
                    onMenuPress={isOwnProfile ? () => navigation.navigate('ProfileControlCenter') : () => { }}
                    onAvatarPress={() => setShowAvatarViewer(true)}
                    progress={progress}
                    isOwnProfile={isOwnProfile}
                    isFollowing={isFollowing}
                    followRequestStatus={followRequestStatus}
                    onFollowPress={handleFollowToggle}
                    onMessagePress={handleMessagePress}
                    // Custom navigation handlers
                    onFollowersPress={handleFollowersPress}
                    onFollowingPress={handleFollowingPress}
                    followLoading={followLoading}
                    pendingRequestsCount={isOwnProfile ? pendingRequestsCount : 0}

                    // DaysBar props
                    weekDays={weekDays}
                    weekOffset={weekOffset}
                    slideDirection={slideDirection}
                    monthIndicator={monthIndicator}
                    onDoubleTapDate={handleDoubleTapDate}

                    // Switch props
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </View>

            {/* 2. SCROLLABLE TIMELINE or PRIVATE GATE */}
            {!canView && profileUser?.isPrivate ? (
                <View style={{ flex: 1, marginTop: getHeaderExpandedHeight(isOwnProfile) }}>
                    <PrivateProfileGate />
                </View>
            ) : (
                <ProfileTimeline
                    ref={timelineRef}
                    events={activeTab === 'own' ? events : []}
                    weekStart={currentStartOfWeek}
                    weekOffset={weekOffset}
                    contentTopPadding={rTimelineTopPadding}
                    onReady={onTimelineReady}
                    onScroll={scrollHandler}
                    onEventPress={isOwnProfile ? handleEventPress : undefined}
                    onEmptySlotPress={isOwnProfile ? handleEmptySlotPress : undefined}
                    onChangeWeek={changeWeek}
                />
            )}

            {/* Create Event Sheet - for new events */}
            {isOwnProfile && isCreateSheetVisible && (
                <View style={styles.sheetOverlay}>
                    <CreateEventSheet
                        visible={isCreateSheetVisible}
                        initialDate={createEventDate}
                        initialTime={createEventTime}
                        onClose={() => setCreateSheetVisible(false)}
                        onSave={handleSaveEvent}
                    />
                </View>
            )}

            {/* Event Edit Sheet - for editing existing events */}
            {isOwnProfile && isSheetVisible && selectedEvent && (
                <View style={styles.sheetOverlay}>
                    <EventEditSheet
                        visible={isSheetVisible}
                        event={selectedEvent}
                        onClose={() => setSheetVisible(false)}
                        onSave={handleSaveEvent}
                        onDelete={handleDeleteEvent}
                    />
                </View>
            )}

            <AvatarViewerModal
                visible={showAvatarViewer}
                onClose={() => setShowAvatarViewer(false)}
                avatarUrl={displayUser?.avatarUrl}
                avatarColor={displayUser?.avatarColor}
                username={displayUser?.username}
                displayName={displayUser?.displayName}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 200,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 12,
        zIndex: 150,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
