import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";

export default function UserListScreen({ route, navigation }: any) {
    const { userId, type, title } = route.params; // type: 'followers' | 'following'
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
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

    const handleUserPress = (id: string) => {
        // Push user profile. 
        // Note: Depending on navigator structure, this might need adjustment if we want to stay in stack.
        navigation.push("UserProfile", { userId: id });
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity style={styles.userCard} onPress={() => handleUserPress(item.id)}>
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
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Aucun utilisateur</Text>
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
    emptyText: {
        textAlign: "center",
        color: theme.colors.text.secondary,
        marginTop: 32,
        fontSize: 16,
    }
});
