import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../lib/AuthContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Debounce helper
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default function SearchScreen({ navigation }: any) {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [results, setResults] = useState<any[]>([]);
    const [recents, setRecents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const getRecentsKey = () => `recent_visits_${user?.id || 'guest'}`;

    useEffect(() => {
        if (user?.id) {
            loadRecents();
        } else {
            setRecents([]);
        }
    }, [user?.id]);

    const loadRecents = async () => {
        try {
            const json = await AsyncStorage.getItem(getRecentsKey());
            if (json) {
                setRecents(JSON.parse(json));
            } else {
                setRecents([]);
            }
        } catch (e) {
            console.error("Failed to load recents", e);
        }
    };

    const saveRecent = async (visitedUser: any) => {
        if (!user?.id) return;
        try {
            // Remove if already exists to bump to top
            const filtered = recents.filter(item => item.id !== visitedUser.id);
            const updated = [visitedUser, ...filtered].slice(0, 10); // Keep max 10
            setRecents(updated);
            await AsyncStorage.setItem(getRecentsKey(), JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save recent", e);
        }
    };

    const clearRecents = async () => {
        if (!user?.id) return;
        try {
            setRecents([]);
            await AsyncStorage.removeItem(getRecentsKey());
        } catch (e) {
            console.error(e);
        }
    };

    React.useEffect(() => {
        if (debouncedSearchQuery.length > 0) {
            searchUsers(debouncedSearchQuery);
        } else {
            setResults([]);
        }
    }, [debouncedSearchQuery]);

    const searchUsers = async (q: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
            setResults(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserPress = (user: any) => {
        saveRecent(user);
        navigation.navigate("UserProfile", { userId: user.id });
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

    const showRecents = searchQuery.length === 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Recherche</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.colors.text.secondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Rechercher des utilisateurs..."
                    placeholderTextColor={theme.colors.text.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {loading && <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loadingIndicator} />}
            </View>

            {showRecents && recents.length > 0 && (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Récents</Text>
                    <TouchableOpacity onPress={clearRecents}>
                        <Text style={styles.clearText}>Effacer</Text>
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={showRecents ? recents : results}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading ? (
                        <Text style={styles.emptyText}>
                            {showRecents ? "Vos recherches récentes apparaîtront ici" : "Aucun utilisateur trouvé"}
                        </Text>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: theme.colors.text.primary,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    clearText: {
        fontSize: 14,
        color: theme.colors.primary || '#007AFF',
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.05)",
        marginHorizontal: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    loadingIndicator: {
        marginLeft: 10,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
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
