import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Avatar from './Avatar';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    interpolate,
    useAnimatedStyle,
    Extrapolation,
    SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { resolveImageUrl } from '../services/api';
import { DaysBar } from './DaysBar';
import { ProfileModeSwitch } from './ProfileModeSwitch';

interface UserStats {
    events: number | string;
    followers: number | string;
    following: number | string;
}

interface ProfileHeaderProps {
    user: any;
    stats: UserStats;
    onMenuPress: () => void;
    onAvatarPress: () => void;
    progress: SharedValue<number>;
    isOwnProfile?: boolean;
    isFollowing?: boolean;
    followRequestStatus?: string | null;
    onFollowPress?: () => void;
    onMessagePress?: () => void;  // NEW: Message button handler
    followLoading?: boolean;
    pendingRequestsCount?: number;

    // DaysBar Props passed through
    weekDays: any[];
    weekOffset: number;
    slideDirection: 'left' | 'right';
    monthIndicator: string | null;
    onDoubleTapDate: () => void;

    // Mode Switch
    activeTab: 'own' | 'tagged';
    onTabChange: (mode: 'own' | 'tagged') => void;

    // Navigation overrides
    onFollowersPress?: () => void;
    onFollowingPress?: () => void;
}

// Header heights - different for own profile (no follow button) vs other profile (with follow button)
export const HEADER_EXPANDED_HEIGHT_OWN = 375;    // Own profile: no follow button
export const HEADER_EXPANDED_HEIGHT_OTHER = 425;  // Other profile: includes follow button (~50px extra)
export const HEADER_COLLAPSED_HEIGHT = 110;       // Compact: Insets + Handle + DaysBar

// Helper for components that need dynamic height based on profile type
export const getHeaderExpandedHeight = (isOwnProfile: boolean): number =>
    isOwnProfile ? HEADER_EXPANDED_HEIGHT_OWN : HEADER_EXPANDED_HEIGHT_OTHER;

// Legacy export for backward compatibility (defaults to other profile height)
export const HEADER_EXPANDED_HEIGHT = HEADER_EXPANDED_HEIGHT_OTHER;

export function ProfileHeader({
    user, stats, onMenuPress, onAvatarPress, progress,
    isOwnProfile = true, isFollowing = false, followRequestStatus = null, onFollowPress, onMessagePress, followLoading = false,
    pendingRequestsCount = 0,
    weekDays, weekOffset, slideDirection, monthIndicator, onDoubleTapDate,
    activeTab, onTabChange,
    onFollowersPress, onFollowingPress
}: ProfileHeaderProps) {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const [imageError, setImageError] = React.useState(false);

    const resolvedUrl = resolveImageUrl(user?.avatarUrl);
    // const fallbackUrl ... (removed)
    // const displayUrl ... (removed)
    const displayPseudo = user?.displayName || user?.pseudo || user?.username || "Utilisateur";
    const displayHandle = user?.username ? `@${user.username}` : "";

    // ---------------- ANIMATIONS ----------------

    // 1. ISLAND STYLE (Sticky Top Bar)
    // Hidden initially (opacity 0), fades in when scrolling (progress > 0.15)
    // Contains: Handle, Menu (Sticky), DaysBar (Sticky)
    const rIslandStyle = useAnimatedStyle(() => {
        // Island: invisible until progress > 0.2, fully visible at 0.5
        // Ensures expanded content has time to fade before island appears
        return {
            opacity: interpolate(progress.value, [0.2, 0.5], [0, 1], Extrapolation.CLAMP),
            transform: [
                { translateY: interpolate(progress.value, [0.2, 1], [-8, 0], Extrapolation.CLAMP) }
            ],
            pointerEvents: progress.value > 0.3 ? 'auto' : 'none',
            zIndex: progress.value > 0.2 ? 100 : 0
        };
    });

    // 2. EXPANDED CONTENT STYLE
    // Fades out as we scroll.
    // Contains: Menu (Expanded), Identity, Stats, DaysBar (Header)
    // TranslateY moves it up.
    // Calculate the diff based on whether this is own profile or not
    const headerExpandedHeight = isOwnProfile ? HEADER_EXPANDED_HEIGHT_OWN : HEADER_EXPANDED_HEIGHT_OTHER;
    const diff = headerExpandedHeight - HEADER_COLLAPSED_HEIGHT;
    const rExpandedStyle = useAnimatedStyle(() => {
        // Expanded header moves up linearly with scroll (1:1 with finger)
        const translateY = interpolate(progress.value, [0, 1], [0, -diff], Extrapolation.CLAMP);

        // Stay fully opaque until 0.1, then fade to 0 by 0.4
        // This ensures clean crossfade: expanded fades out before island fades in
        const opacity = interpolate(progress.value, [0, 0.1, 0.4], [1, 1, 0], Extrapolation.CLAMP);

        return {
            transform: [{ translateY }],
            opacity,
            zIndex: 10,
            pointerEvents: progress.value > 0.4 ? 'none' : 'auto'
        };
    });


    return (
        <View style={styles.container}>
            {/* Status Bar Background (Fixed) */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: '#FFFFFF',
                zIndex: 9
            }} />

            {/* --- A. STICKY ISLAND (Invisible at start) --- */}
            <Animated.View style={[styles.islandContainer, rIslandStyle, { paddingTop: insets.top }]}>
                <View style={styles.islandRow}>
                    {/* Centered Handle */}
                    <Text style={styles.islandHandleText}>{displayHandle}</Text>

                    {/* Menu/Action Button (Sticky) - Only menu for own profile */}
                    {isOwnProfile && (
                        <TouchableOpacity style={styles.islandMenuButton} onPress={onMenuPress}>
                            <Ionicons name="menu-outline" size={28} color="#000" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Sticky Days Bar */}
                <View style={styles.islandDaysWrapper}>
                    <DaysBar
                        weekDays={weekDays}
                        weekOffset={weekOffset}
                        slideDirection={slideDirection}
                        monthIndicator={monthIndicator}
                        onDoubleTap={onDoubleTapDate}
                    />
                </View>
            </Animated.View>


            {/* --- B. EXPANDED CONTENT (Visible at start) --- */}
            <Animated.View style={[
                styles.expandedContainer,
                rExpandedStyle,
                { paddingTop: insets.top } // Moved padding here to move background with it
            ]}>

                {/* Expanded Menu/Action Button - Only menu for own profile */}
                {isOwnProfile ? (
                    <TouchableOpacity style={styles.expandedMenuButton} onPress={onMenuPress}>
                        <Ionicons name="menu-outline" size={28} color="#000" />
                    </TouchableOpacity>
                ) : (
                    // Spacer for other profiles to maintain vertical alignment
                    <View style={styles.otherProfileSpacer} />
                )}

                <View>
                    {/* Identity */}
                    <View style={styles.identityBlock}>
                        <Avatar
                            avatarUrl={user?.avatarUrl}
                            avatarColor={user?.avatarColor}
                            username={user?.username}
                            displayName={user?.displayName}
                            size={70}
                            onPress={onAvatarPress}
                            style={styles.avatar}
                        />
                        <View style={styles.textContainer}>
                            <View style={styles.nameRow}>
                                <Text style={styles.pseudo} numberOfLines={1}>{displayPseudo}</Text>
                            </View>
                            <Text style={styles.handle}>{displayHandle}</Text>
                            {/* Bio Block */}
                            {user?.bio ? (
                                <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
                            ) : null}
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('MyEvents')}>
                            <Text style={styles.statValue}>{stats.events}</Text>
                            <Text style={styles.statLabel}>Événements</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statItem} onPress={() => {
                            if (onFollowersPress) {
                                onFollowersPress();
                            } else {
                                navigation.navigate('UserList', { userId: user?.id, type: 'followers', title: 'Abonnés' });
                            }
                        }}>
                            <View style={{ position: 'relative' }}>
                                <Text style={styles.statValue}>{stats.followers}</Text>
                                {isOwnProfile && pendingRequestsCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.statLabel}>Abonnés</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statItem} onPress={() => {
                            if (onFollowingPress) {
                                onFollowingPress();
                            } else {
                                navigation.navigate('UserList', { userId: user?.id, type: 'following', title: 'Abonnements' });
                            }
                        }}>
                            <Text style={styles.statValue}>{stats.following}</Text>
                            <Text style={styles.statLabel}>Abonnements</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Action Buttons Row - Follow + Message, only for other profiles */}
                    {!isOwnProfile && (
                        <View style={styles.actionButtonsRow}>
                            {/* Follow Button */}
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.followActionButton,
                                    (isFollowing || followRequestStatus === 'PENDING') && styles.followActionButtonFollowing,
                                    followLoading && styles.actionButtonLoading
                                ]}
                                onPress={onFollowPress}
                                disabled={followLoading}
                                activeOpacity={0.7}
                            >
                                {followLoading ? (
                                    <Text style={[styles.actionButtonText, (isFollowing || followRequestStatus === 'PENDING') && styles.actionButtonTextSecondary]}>...</Text>
                                ) : (
                                    <Text style={[styles.actionButtonText, (isFollowing || followRequestStatus === 'PENDING') && styles.actionButtonTextSecondary]}>
                                        {isFollowing
                                            ? 'Abonné'
                                            : followRequestStatus === 'PENDING'
                                                ? 'Demandé'
                                                : user?.isPrivate
                                                    ? "S'abonner"
                                                    : "S'abonner"}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {/* Message Button */}
                            <TouchableOpacity
                                style={[styles.actionButton, styles.messageActionButton]}
                                onPress={onMessagePress}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chatbubble-outline" size={16} color="#1A1A1A" style={{ marginRight: 6 }} />
                                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Message</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Tabs / Switch */}
                    <View style={styles.switchContainer}>
                        <ProfileModeSwitch
                            mode={activeTab}
                            onModeChange={onTabChange}
                        />
                    </View>
                </View>

                {/* Expanded Days Bar (Fades out with the rest) */}
                <DaysBar
                    weekDays={weekDays}
                    weekOffset={weekOffset}
                    slideDirection={slideDirection}
                    monthIndicator={monthIndicator}
                    onDoubleTap={onDoubleTapDate}
                />
            </Animated.View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: 'transparent', // Transparent to allow calendar to show through when header translates up
    },
    // --- ISLAND STYLES ---
    islandContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        backgroundColor: '#FFFFFF', // Required for opacity cover
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 4,
        paddingBottom: 8,
        overflow: 'hidden',
        zIndex: 100
    },
    islandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        paddingHorizontal: 60, // Space for menu
        marginTop: 4
    },
    islandHandleText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
        textAlign: 'center'
    },
    islandMenuButton: {
        position: 'absolute',
        right: 16,
        top: 14 // Center vertically in row
    },
    islandDaysWrapper: {
        marginTop: -4, // Pull up closer to handle
        paddingBottom: 4
    },

    // --- EXPANDED STYLES ---
    expandedContainer: {
        backgroundColor: '#FFFFFF', // Opaque to hide calendar underneath
        paddingBottom: 10,
        // zIndex is handled by animated style
    },
    expandedMenuButton: {
        alignSelf: 'flex-end',
        marginRight: 16,
        marginTop: 8,
        marginBottom: 8
    },

    identityBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 24, // Increased spacing before stats
        marginLeft: 10, // Slight right shift
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#F0F0F0',
    },
    textContainer: {
        marginLeft: 16,
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pseudo: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000',
    },
    handle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 2,
    },
    bio: {
        fontSize: 13,
        color: '#666',
        marginTop: 6,
        lineHeight: 18,
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        marginTop: 4, // Small spacing from identity
        marginBottom: 24, // Balanced spacing before switch
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
    statLabel: {
        fontSize: 12,
        color: '#8E8E93',
    },
    switchContainer: {
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    // Follow Button Styles - Island (Collapsed)
    islandFollowButton: {
        position: 'absolute',
        right: 12,
        top: 10,
        backgroundColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 18,
    },
    islandFollowingButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#C7C7CC',
    },
    islandFollowText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    islandFollowingText: {
        color: '#000',
    },
    // Follow Button Styles - Expanded
    expandedFollowButton: {
        alignSelf: 'flex-end',
        marginRight: 16,
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: '#000',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    expandedFollowingButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#C7C7CC',
    },
    expandedFollowText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    expandedFollowingText: {
        color: '#000',
    },
    // Follow Pill Button - Under stats (Modern Lify style - compact)
    followPillButton: {
        width: '92%',
        height: 36,
        alignSelf: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 4,
        // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    followPillButtonFollowing: {
        backgroundColor: '#F5F5F5',
        shadowOpacity: 0,
        elevation: 0,
    },
    followPillButtonLoading: {
        opacity: 0.6,
    },
    followPillText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    followPillTextFollowing: {
        color: '#636366',
    },
    // Spacer for other profiles (when no menu button)
    otherProfileSpacer: {
        height: 44,
    },
    // Badge for pending follow requests
    statValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#FF3B30',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        zIndex: 10,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    // Action Buttons Row (Follow + Message)
    actionButtonsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 10,
        marginTop: 8,
        marginBottom: 4,
    },
    actionButton: {
        flex: 1,
        height: 36,
        borderRadius: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    followActionButton: {
        backgroundColor: '#1A1A1A',
    },
    followActionButtonFollowing: {
        backgroundColor: '#F5F5F5',
    },
    messageActionButton: {
        backgroundColor: '#F5F5F5',
    },
    actionButtonLoading: {
        opacity: 0.6,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionButtonTextSecondary: {
        color: '#1A1A1A',
    },
});
