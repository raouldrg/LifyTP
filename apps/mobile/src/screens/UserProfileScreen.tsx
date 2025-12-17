import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export default function UserProfileScreen({ route, navigation }: any) {
    const { userId } = route.params;
    const { user: currentUser } = useAuth();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [followingLoading, setFollowingLoading] = useState(false);

    useEffect(() => {
        fetchUser();
    }, [userId]);

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

    const handleFollowToggle = async () => {
        if (followingLoading) return;
        setFollowingLoading(true);

        // Optimistic update
        const previousIsFollowing = user.isFollowing;
        const previousFollowers = user.metrics?.followedBy || 0;

        setUser((prev: any) => ({
            ...prev,
            isFollowing: !prev.isFollowing,
            metrics: {
                ...prev.metrics,
                followedBy: prev.isFollowing
                    ? prev.metrics.followedBy - 1
                    : prev.metrics.followedBy + 1
            }
        }));

        try {
            if (previousIsFollowing) {
                await api.delete(`/users/${userId}/follow`);
            } else {
                await api.post(`/users/${userId}/follow`);
            }
        } catch (error) {
            console.error(error);
            // Revert on error
            setUser((prev: any) => ({
                ...prev,
                isFollowing: previousIsFollowing,
                metrics: {
                    ...prev.metrics,
                    followedBy: previousFollowers
                }
            }));
            Alert.alert("Erreur", "Impossible de modifier le statut d'abonnement");
        } finally {
            setFollowingLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    const isMe = currentUser?.id === user?.id;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.username}>@{user?.username}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Info */}
                <View style={styles.profileInfo}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.username}&background=random&size=128` }}
                            style={styles.avatar}
                        />
                    </View>
                    <Text style={styles.displayName}>{user?.username}</Text>
                    <Text style={styles.bio}>{user?.bio || "Aucune description."}</Text>

                    {/* Follow Button */}
                    {!isMe && (
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                user?.isFollowing && styles.followingButton
                            ]}
                            onPress={handleFollowToggle}
                            disabled={followingLoading}
                        >
                            <Text style={[
                                styles.followButtonText,
                                user?.isFollowing && styles.followingButtonText
                            ]}>
                                {user?.isFollowing ? "Abonné" : "S'abonner"}
                            </Text>
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

                {/* Content Tabs (Static for now) */}
                <View style={styles.tabs}>
                    <TouchableOpacity style={[styles.tabItem, styles.activeTab]}>
                        <Text style={styles.activeTabText}>L<Text style={{ color: theme.colors.accent }}>.</Text></Text>
                    </TouchableOpacity>
                </View>

                {/* Calendar Grid Placeholder */}
                <View style={[styles.calendarContainer, { minHeight: 300 }]}>
                    <Text style={styles.calendarPlaceholderText}>Grille Calendrier</Text>
                    <View style={styles.gridPlaceholder} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    username: {
        fontSize: 18,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    profileInfo: {
        alignItems: "center",
        marginTop: 10,
        paddingHorizontal: 24,
    },
    avatarContainer: {
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#E0E0E0",
    },
    displayName: {
        fontSize: 20,
        fontWeight: "800",
        color: theme.colors.text.primary,
        marginBottom: 2,
    },
    bio: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: "center",
        marginBottom: 16,
        lineHeight: 18,
    },
    followButton: {
        backgroundColor: theme.colors.text.primary,
        paddingHorizontal: 32,
        paddingVertical: 10,
        borderRadius: 24,
        marginBottom: 24,
    },
    followingButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: theme.colors.text.secondary,
    },
    followButtonText: {
        color: theme.colors.background,
        fontWeight: "600",
        fontSize: 16,
    },
    followingButtonText: {
        color: theme.colors.text.primary,
    },
    statsContainer: {
        flexDirection: "row",
        justifyContent: "space-around", // Better spacing
        width: "100%",
        marginBottom: 16,
    },
    statItem: {
        alignItems: "center",
        minWidth: 60,
    },
    statValue: {
        fontSize: 16,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    statLabel: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
    tabs: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
        marginTop: 10
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: theme.colors.text.primary,
    },
    activeTabText: {
        fontSize: 18,
        fontWeight: "900",
        color: theme.colors.text.primary,
    },
    calendarContainer: {
        padding: 24,
        alignItems: 'center',
        flex: 1,
    },
    calendarPlaceholderText: {
        color: theme.colors.text.secondary,
        marginBottom: 16,
    },
    gridPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: "rgba(0,0,0,0.03)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.05)",
        borderStyle: 'dashed'
    }
});
