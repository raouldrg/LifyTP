import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Alert,
    RefreshControl,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { theme } from "../theme";

interface RequestConversation {
    id: string;
    userA: { id: string; username: string; displayName?: string; avatarUrl?: string };
    userB: { id: string; username: string; displayName?: string; avatarUrl?: string };
    requestSenderId: string;
    messages: { content?: string; type: string; createdAt: string }[];
    unreadCount: number;
}

export default function MessageRequestsScreen({ navigation }: any) {
    const [requests, setRequests] = useState<RequestConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            const res = await api.get("/conversations/requests/inbox");
            setRequests(res.data);
        } catch (e) {
            console.error("[MessageRequests] Fetch error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRequests();
        }, [])
    );

    const handleAccept = async (convoId: string) => {
        setProcessingId(convoId);
        try {
            await api.post(`/conversations/${convoId}/accept`);
            setRequests(prev => prev.filter(r => r.id !== convoId));
        } catch (e) {
            console.error("[MessageRequests] Accept error:", e);
            Alert.alert("Erreur", "Impossible d'accepter la demande");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (convoId: string) => {
        setProcessingId(convoId);
        try {
            await api.delete(`/conversations/${convoId}/request`);
            setRequests(prev => prev.filter(r => r.id !== convoId));
        } catch (e) {
            console.error("[MessageRequests] Reject error:", e);
            Alert.alert("Erreur", "Impossible de refuser la demande");
        } finally {
            setProcessingId(null);
        }
    };

    const handleOpenChat = (request: RequestConversation) => {
        const otherUser = request.userA.id === request.requestSenderId ? request.userA : request.userB;
        navigation.navigate("Chat", {
            conversationId: request.id,
            otherUser,
            conversationStatus: 'REQUEST',
            isRequest: true,
            isInitiator: false
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </Pressable>
                <Text style={styles.headerTitle}>Demandes de messages</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchRequests(); }}
                        tintColor={theme.colors.accent}
                    />
                }
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Chargement...</Text>
                    </View>
                ) : requests.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="mail-open-outline" size={56} color="#D1D1D6" />
                        <Text style={styles.emptyTitle}>Aucune demande</Text>
                        <Text style={styles.emptySubtitle}>
                            Les demandes de message de profils privés apparaîtront ici
                        </Text>
                    </View>
                ) : (
                    requests.map((request, index) => {
                        const sender = request.userA.id === request.requestSenderId ? request.userA : request.userB;
                        const lastMessage = request.messages[0];
                        const isProcessing = processingId === request.id;

                        return (
                            <Animated.View
                                key={request.id}
                                entering={FadeInDown.delay(index * 50).duration(200)}
                                style={styles.requestItem}
                            >
                                <Pressable style={styles.requestContent} onPress={() => handleOpenChat(request)}>
                                    <Image
                                        source={{ uri: sender.avatarUrl || 'https://via.placeholder.com/48' }}
                                        style={styles.avatar}
                                    />
                                    <View style={styles.textContent}>
                                        <Text style={styles.username} numberOfLines={1}>
                                            {sender.displayName || sender.username}
                                        </Text>
                                        <Text style={styles.preview} numberOfLines={1}>
                                            {lastMessage?.content || "[Media]"}
                                        </Text>
                                    </View>
                                </Pressable>
                                <View style={styles.actions}>
                                    <Pressable
                                        style={[styles.actionButton, styles.rejectButton]}
                                        onPress={() => handleReject(request.id)}
                                        disabled={isProcessing}
                                    >
                                        <Text style={styles.rejectText}>
                                            {isProcessing ? "..." : "Refuser"}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionButton, styles.acceptButton]}
                                        onPress={() => handleAccept(request.id)}
                                        disabled={isProcessing}
                                    >
                                        <Text style={styles.acceptText}>
                                            {isProcessing ? "..." : "Accepter"}
                                        </Text>
                                    </Pressable>
                                </View>
                            </Animated.View>
                        );
                    })
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "flex-start",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    scrollView: {
        flex: 1,
    },
    listContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "#8E8E93",
        fontSize: 15,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1A1A1A",
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 15,
        color: "#8E8E93",
        textAlign: "center",
        marginTop: 8,
        lineHeight: 22,
    },
    requestItem: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    requestContent: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#E8E8E8",
    },
    textContent: {
        flex: 1,
        marginLeft: 12,
    },
    username: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    preview: {
        fontSize: 14,
        color: "#8E8E93",
        marginTop: 2,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
    },
    actionButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 18,
    },
    rejectButton: {
        backgroundColor: "#F2F2F7",
    },
    acceptButton: {
        backgroundColor: theme.colors.accent,
    },
    rejectText: {
        color: "#8E8E93",
        fontSize: 14,
        fontWeight: "600",
    },
    acceptText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
});
