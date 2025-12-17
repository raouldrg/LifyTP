import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function MessagesScreen({ navigation }: any) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            fetchConversations();
        }, [])
    );

    const fetchConversations = async () => {
        try {
            const res = await api.get("/conversations");
            setConversations(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getOtherUser = (convo: any) => {
        if (convo.userAId === user?.id) return convo.userB;
        return convo.userA;
    };

    const handlePress = (convo: any) => {
        const otherUser = getOtherUser(convo);
        navigation.navigate("Chat", { conversationId: convo.id, otherUser });
    };

    const renderItem = ({ item }: any) => {
        const otherUser = getOtherUser(item);
        const lastMessage = item.messages?.[0];
        const isUnread = item.unreadCount > 0;

        // Determine status
        let statusIconName: any = "";
        let statusColor = theme.colors.text.secondary;
        let statusText = "";

        const isMe = lastMessage?.senderId === user?.id;

        if (lastMessage) {
            if (isMe) {
                if (lastMessage.read) {
                    statusIconName = "arrow-redo-outline"; // Opened
                    statusText = "Ouvert";
                } else {
                    statusIconName = "arrow-redo"; // Sent
                    statusColor = theme.colors.primary;
                    statusText = "Envoyé";
                }
            } else {
                // Received
                if (isUnread) {
                    statusIconName = "chatbox"; // New
                    statusColor = theme.colors.primary;
                    statusText = "Nouveau";
                } else {
                    statusIconName = "chatbox-outline"; // Received/Read
                    statusText = "Reçu";
                }
            }
        }

        return (
            <TouchableOpacity style={[styles.convoItem, isUnread && styles.unreadItem]} onPress={() => handlePress(item)}>
                <Image
                    source={{ uri: otherUser?.avatarUrl || `https://ui-avatars.com/api/?name=${otherUser?.username}&background=random&size=64` }}
                    style={styles.avatar}
                />
                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <Text style={[styles.username, isUnread && styles.unreadText]}>{otherUser?.username}</Text>
                        {lastMessage && (
                            <Text style={[styles.time, isUnread && styles.unreadText]}>
                                {formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: true, locale: fr })}
                            </Text>
                        )}
                    </View>
                    <View style={styles.messageRow}>
                        {lastMessage ? (
                            <View style={styles.statusContainer}>
                                <Ionicons name={statusIconName} size={14} color={statusColor} style={{ marginRight: 4, marginTop: 1 }} />
                                <Text style={[styles.lastMessage, isUnread && styles.unreadMessage]} numberOfLines={1}>
                                    {isMe ? "Moi : " : ""}
                                    {lastMessage.type === 'IMAGE'
                                        ? "📷 Image"
                                        : lastMessage.type === 'AUDIO'
                                            ? "🎵 Audio"
                                            : lastMessage.content}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.lastMessage}>Nouvelle conversation</Text>
                        )}
                        {/* Dot is now redundant with icon but kept if user likes the dot. 
                            Users request implies wanting to know STATUS explicitly. 
                            Let's keep the dot for unreadReceived as an extra cue or remove it?
                            User said "comme sur snapchat", snapchat relies heavily on icons.
                            I'll keep the dot for "Nouveau" messages as a double cue for now.
                        */}
                        {isUnread && <View style={styles.unreadDot} />}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>
                <TouchableOpacity onPress={() => navigation.navigate("NewMessage")} style={styles.addButton}>
                    <Ionicons name="add" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConversations(); }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Aucun message pour le moment.</Text>
                            <TouchableOpacity style={styles.startButton} onPress={() => navigation.navigate("NewMessage")}>
                                <Text style={styles.startButtonText}>Démarrer une discussion</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: theme.colors.text.primary,
    },
    addButton: {
        padding: 8,
        backgroundColor: "rgba(0,0,0,0.05)",
        borderRadius: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContent: {
        paddingHorizontal: 24,
    },
    convoItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.03)",
    },
    unreadItem: {
        backgroundColor: 'rgba(255, 165, 0, 0.05)', // Very light orange tint for unread
        marginHorizontal: -24,
        paddingHorizontal: 24,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#E0E0E0",
    },
    content: {
        flex: 1,
        marginLeft: 16,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    unreadText: {
        color: "#000",
        fontWeight: "800",
    },
    time: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        // fontFamily removed
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    lastMessage: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        flex: 1,
    },
    unreadMessage: {
        color: theme.colors.text.primary,
        fontWeight: "600",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.primary,
    },
    emptyContainer: {
        marginTop: 64,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        marginBottom: 16,
    },
    startButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
    },
    startButtonText: {
        color: "#fff",
        fontWeight: "600",
    }
});
