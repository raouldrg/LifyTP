import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";

export default function NewMessageScreen({ navigation }: any) {
    const [friends, setFriends] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const res = await api.get("/friends");
            setFriends(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserPress = (user: any) => {
        // Navigate to Chat, passing the user object
        navigation.navigate("Chat", { otherUser: user });
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity style={styles.userCard} onPress={() => handleUserPress(item)}>
            <Image
                source={{ uri: item.avatarUrl || `https://ui-avatars.com/api/?name=${item.username}&background=random&size=64` }}
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Nouvelle discussion</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={friends}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Vous ne suivez mutuellement personne pour le moment.</Text>
                            <Text style={styles.subText}>Suivez d'autres utilisateurs pour discuter avec eux !</Text>
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
    userCard: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.03)",
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#E0E0E0",
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    username: {
        fontSize: 16,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    bio: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
    emptyContainer: {
        marginTop: 64,
        alignItems: "center",
        paddingHorizontal: 32,
    },
    emptyText: {
        textAlign: "center",
        color: theme.colors.text.primary,
        fontWeight: "600",
        marginBottom: 8,
        fontSize: 16,
    },
    subText: {
        textAlign: "center",
        color: theme.colors.text.secondary,
        fontSize: 14,
    }
});
