import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, resolveImageUrl } from "../services/api";
import { UserListItem } from "../components/UserListItem";
import { useAuth } from "../context/AuthContext";

interface FollowRequest {
    id: string;
    requester: {
        id: string;
        username: string;
        displayName?: string;
        avatarUrl?: string;
    };
}

interface User {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
}

export default function UserListScreen({ route, navigation }: any) {
    const { userId, type, title, onRequestsUpdate, onStatsUpdate } = route.params; // type: 'followers' | 'following'
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<FollowRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set());

    const isOwnProfile = userId === currentUser?.id;
    const isOwnFollowers = type === 'followers' && isOwnProfile;
    const isOwnFollowing = type === 'following' && isOwnProfile;

    useEffect(() => {
        fetchUsers();
        if (isOwnFollowers) {
            fetchRequests();
        }
    }, [userId, type]);

    const fetchUsers = async () => {
        try {
            const endpoint = type === 'followers'
                ? `/users/${userId}/followers`
                : `/users/${userId}/following`;
            const res = await api.get(endpoint);
            setUsers(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRequests = async () => {
        setLoadingRequests(true);
        try {
            const res = await api.get('/follow/requests');
            setRequests(res.data);
        } catch (error) {
            console.error("Failed to fetch follow requests:", error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleAccept = async (requestId: string, requester: any) => {
        setProcessingIds(prev => new Set(prev).add(requestId));
        try {
            await api.post(`/follow/requests/${requestId}/accept`);
            // Remove from requests, add to users
            setRequests(prev => prev.filter(r => r.id !== requestId));
            setUsers(prev => [requester, ...prev]);

            // Notify ProfileScreen
            if (onRequestsUpdate) {
                onRequestsUpdate({ accepted: true });
            }
        } catch (error) {
            console.error("Failed to accept request:", error);
            Alert.alert("Erreur", "Impossible d'accepter la demande");
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(requestId);
                return next;
            });
        }
    };

    const handleReject = async (requestId: string) => {
        setProcessingIds(prev => new Set(prev).add(requestId));
        try {
            await api.post(`/follow/requests/${requestId}/reject`);
            setRequests(prev => prev.filter(r => r.id !== requestId));

            // Notify ProfileScreen
            if (onRequestsUpdate) {
                onRequestsUpdate({ accepted: false });
            }
        } catch (error) {
            console.error("Failed to reject request:", error);
            Alert.alert("Erreur", "Impossible de refuser la demande");
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(requestId);
                return next;
            });
        }
    };

    // Remove a follower (from own followers list)
    const handleRemoveFollower = useCallback(async (user: User) => {
        Alert.alert(
            "Retirer cet abonné ?",
            "Il ne verra plus vos contenus privés.",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Retirer",
                    style: "destructive",
                    onPress: async () => {
                        // Optimistic update
                        const previousUsers = [...users];
                        setUsers(prev => prev.filter(u => u.id !== user.id));
                        setActionLoadingIds(prev => new Set(prev).add(user.id));

                        try {
                            await api.delete(`/followers/${user.id}`);
                            // Trigger stats update
                            if (onStatsUpdate) {
                                onStatsUpdate();
                            }
                        } catch (error) {
                            console.error("Failed to remove follower:", error);
                            // Rollback
                            setUsers(previousUsers);
                            Alert.alert("Erreur", "Impossible de retirer cet abonné. Réessayez.");
                        } finally {
                            setActionLoadingIds(prev => {
                                const next = new Set(prev);
                                next.delete(user.id);
                                return next;
                            });
                        }
                    }
                }
            ]
        );
    }, [users, onStatsUpdate]);

    // Unfollow a user (from own following list)
    const handleUnfollow = useCallback(async (user: User) => {
        Alert.alert(
            "Se désabonner ?",
            `Vous ne suivrez plus ${user.displayName || user.username}.`,
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Se désabonner",
                    style: "destructive",
                    onPress: async () => {
                        // Optimistic update
                        const previousUsers = [...users];
                        setUsers(prev => prev.filter(u => u.id !== user.id));
                        setActionLoadingIds(prev => new Set(prev).add(user.id));

                        try {
                            await api.delete(`/users/${user.id}/follow`);
                            // Trigger stats update
                            if (onStatsUpdate) {
                                onStatsUpdate();
                            }
                        } catch (error) {
                            console.error("Failed to unfollow:", error);
                            // Rollback
                            setUsers(previousUsers);
                            Alert.alert("Erreur", "Impossible de se désabonner. Réessayez.");
                        } finally {
                            setActionLoadingIds(prev => {
                                const next = new Set(prev);
                                next.delete(user.id);
                                return next;
                            });
                        }
                    }
                }
            ]
        );
    }, [users, onStatsUpdate]);

    const handleUserPress = (id: string) => {
        navigation.push("UserProfile", {
            userId: id,
            // Pass callback to handle follow status changes in the child profile screen
            onFollowChange: (newStatus: 'following' | 'none' | 'requested') => {
                console.log('[UserList] onFollowChange:', newStatus, 'Type:', type, 'ListOwner:', userId, 'Me:', currentUser?.id);

                // If we are in the 'following' list and we unfollowed, remove the user
                // Enforce String comparison to avoid type mismatch
                if (type === 'following' && newStatus === 'none' && String(userId) === String(currentUser?.id)) {
                    console.log('[UserList] Removing user', id, 'from list');
                    setUsers(prev => prev.filter(u => String(u.id) !== String(id)));
                } else {
                    console.log('[UserList] Condition failed:', {
                        isFollowingList: type === 'following',
                        isUnfollow: newStatus === 'none',
                        isOwner: String(userId) === String(currentUser?.id)
                    });
                }

                // Also trigger global stats update
                if (onStatsUpdate) {
                    console.log('[UserList] Triggering stats update');
                    onStatsUpdate();
                }
            }
        });
    };

    const getAvatarUri = (user: any) => {
        const name = user?.displayName || user?.username || 'U';
        if (user?.avatarUrl) {
            return resolveImageUrl(user.avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
    };

    const renderRequestItem = ({ item }: { item: FollowRequest }) => {
        const isProcessing = processingIds.has(item.id);
        return (
            <View style={styles.requestCard}>
                <TouchableOpacity
                    style={styles.requestUser}
                    onPress={() => handleUserPress(item.requester.id)}
                >
                    <Image
                        source={{ uri: getAvatarUri(item.requester) }}
                        style={styles.requestAvatar}
                    />
                    <View style={styles.requestInfo}>
                        <Text style={styles.requestUsername}>
                            {item.requester.displayName || item.requester.username}
                        </Text>
                        <Text style={styles.requestHandle}>@{item.requester.username}</Text>
                    </View>
                </TouchableOpacity>
                <View style={styles.requestActions}>
                    {isProcessing ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={styles.acceptButton}
                                onPress={() => handleAccept(item.id, item.requester)}
                            >
                                <Text style={styles.acceptButtonText}>Accepter</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.rejectButton}
                                onPress={() => handleReject(item.id)}
                            >
                                <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: User }) => {
        // Determine if we should show action button
        let actionButton = undefined;

        if (isOwnFollowers) {
            // Show "Retirer" button for own followers
            actionButton = {
                label: "Retirer",
                style: 'danger' as const,
                loading: actionLoadingIds.has(item.id),
                onPress: handleRemoveFollower,
            };
        } else if (isOwnFollowing) {
            // Show "Se désabonner" button for own following
            actionButton = {
                label: "Se désabonner",
                style: 'neutral' as const,
                loading: actionLoadingIds.has(item.id),
                onPress: handleUnfollow,
            };
        }

        return (
            <UserListItem
                user={item}
                onPress={(u) => handleUserPress(u.id)}
                actionButton={actionButton}
            />
        );
    };

    const ListHeaderComponent = () => {
        if (!isOwnFollowers || requests.length === 0) return null;

        return (
            <View style={styles.requestsSection}>
                <Text style={styles.requestsTitle}>Demandes en attente</Text>
                <FlatList
                    data={requests}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRequestItem}
                    scrollEnabled={false}
                />
                <View style={styles.requestsDivider} />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>{title}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={ListHeaderComponent}
                    ListEmptyComponent={
                        requests.length === 0 ? (
                            <Text style={styles.emptyText}>Aucun utilisateur</Text>
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContent: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    emptyText: {
        textAlign: "center",
        color: theme.colors.text.secondary,
        marginTop: 32,
        fontSize: 16,
    },
    // Requests section styles
    requestsSection: {
        marginBottom: 16,
    },
    requestsTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: theme.colors.text.secondary,
        marginBottom: 12,
        textTransform: "uppercase",
    },
    requestCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
    },
    requestUser: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    requestAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#F2F2F7",
    },
    requestInfo: {
        marginLeft: 12,
        flex: 1,
    },
    requestUsername: {
        fontSize: 15,
        fontWeight: "600",
        color: theme.colors.text.primary,
    },
    requestHandle: {
        fontSize: 13,
        color: theme.colors.text.secondary,
        marginTop: 1,
    },
    requestActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    acceptButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    acceptButtonText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
    rejectButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
    },
    requestsDivider: {
        height: 1,
        backgroundColor: theme.colors.text.secondary,
        opacity: 0.2,
        marginTop: 16,
    },
});
