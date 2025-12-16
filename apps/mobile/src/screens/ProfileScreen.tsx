import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export default function ProfileScreen({ navigation }: any) {
    const { user, signOut } = useAuth();

    const handleSettingsPress = () => {
        navigation.navigate("Settings");
    };

    const handleLogout = async () => {
        await signOut();
        navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.username}>@{user?.username || "utilisateur"}</Text>
                    <TouchableOpacity onPress={handleSettingsPress} style={styles.settingsButton}>
                        <Ionicons name="settings-outline" size={24} color={theme.colors.text.primary} />
                    </TouchableOpacity>
                </View>

                {/* Profile Info */}
                <View style={styles.profileInfo}>
                    <View style={styles.avatarContainer}>
                        {/* Placeholder for Avatar */}
                        <Image
                            source={{ uri: user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.username}&background=random&size=128` }}
                            style={styles.avatar}
                        />
                    </View>
                    <Text style={styles.displayName}>{user?.username || "Utilisateur"}</Text>
                    <Text style={styles.bio}>{user?.bio || "Aucune description."}</Text>

                    {/* Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{user?.stats?.events || 0}</Text>
                            <Text style={styles.statLabel}>Events</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{user?.stats?.followers || 0}</Text>
                            <Text style={styles.statLabel}>Abonnés</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{user?.stats?.following || 0}</Text>
                            <Text style={styles.statLabel}>Suivi(e)s</Text>
                        </View>
                    </View>
                </View>

                {/* Content Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity style={[styles.tabItem, styles.activeTab]}>
                        <Text style={styles.activeTabText}>L<Text style={{ color: theme.colors.accent }}>.</Text></Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tabItem}>
                        <Ionicons name="pricetag-outline" size={24} color={theme.colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Calendar Grid Placeholder */}
                <View style={[styles.calendarContainer, { minHeight: 500 }]}>
                    <Text style={styles.calendarPlaceholderText}>Grille Calendrier (À venir)</Text>
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    username: {
        fontSize: 18,
        fontWeight: "700",
        color: theme.colors.text.primary,
        flex: 2, // Centering trick
        textAlign: 'center',
    },
    settingsButton: {
        flex: 1,
        alignItems: 'flex-end',
    },
    profileInfo: {
        alignItems: "center",
        marginTop: 0, // Reduced top margin
        paddingHorizontal: 24,
    },
    avatarContainer: {
        marginBottom: 8, // Reduced
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatar: {
        width: 80, // Slightly smaller avatar to save space
        height: 80,
        borderRadius: 40,
        backgroundColor: "#E0E0E0",
    },
    displayName: {
        fontSize: 20, // Slightly smaller
        fontWeight: "800",
        color: theme.colors.text.primary,
        marginBottom: 2,
    },
    bio: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: "center",
        marginBottom: 16, // Reduced
        lineHeight: 18,
    },
    statsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "80%",
        marginBottom: 16, // Reduced significantly
    },
    statItem: {
        alignItems: "center",
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
        flex: 1, // Allow expansion
        minHeight: 400 // Ensure minimum height
    },
    calendarPlaceholderText: {
        color: theme.colors.text.secondary,
        marginBottom: 16,
    },
    gridPlaceholder: {
        width: '100%',
        height: '100%', // Fill container
        minHeight: 300,
        backgroundColor: "rgba(0,0,0,0.03)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.05)",
        borderStyle: 'dashed'
    }
});
