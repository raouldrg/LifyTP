import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { theme } from "../theme";
import { FeedCard } from "../components/FeedCard";

export default function HomeScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou");

    // Mock Data matching the design
    const posts = [
        {
            id: "1",
            username: "raoul.drg",
            actionText: "a ajouté une photo à son événement\nLify du 12 nov. 2025",
            timeAgo: "2 heures",
            likes: 21000,
            comments: 12000,
            shares: 400,
            imageUrl: "https://via.placeholder.com/400x400", // Will need real image or placeholder
        },
        {
            id: "2",
            username: "rk_officiel",
            actionText: "a ajouté un événement à son Lify le\n27 dec. 2027",
            timeAgo: "1 jour",
            likes: 5400,
            comments: 200,
            shares: 50,
            hasGradient: true,
        }
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with Tabs */}
            <View style={styles.header}>
                <Text style={styles.logo}>LIFY<Text style={{ color: theme.colors.accent }}>.</Text></Text>

                <View style={styles.tabs}>
                    <TouchableOpacity onPress={() => setActiveTab("foryou")} style={styles.tabContainer}>
                        <Text style={[styles.tabText, activeTab === "foryou" && styles.activeTabText]}>Pour vous</Text>
                        {activeTab === "foryou" && <View style={styles.activeLine} />}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setActiveTab("following")} style={styles.tabContainer}>
                        <Text style={[styles.tabText, activeTab === "following" && styles.activeTabText]}>Abonnements</Text>
                        {activeTab === "following" && <View style={styles.activeLine} />}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Feed List */}
            <ScrollView contentContainerStyle={styles.listContent}>
                {posts.map(post => (
                    <FeedCard
                        key={post.id}
                        {...post}
                    />
                ))}
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 10,
    },
    header: {
        alignItems: "center",
        backgroundColor: theme.colors.background,
        zIndex: 10,
    },
    logo: {
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: 1,
        marginBottom: 16,
        color: theme.colors.primary,
    },
    tabs: {
        flexDirection: "row",
        width: "100%",
        justifyContent: "space-around",
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
    },
    tabContainer: {
        alignItems: "center",
        paddingBottom: 8,
        width: "40%",
    },
    tabText: {
        fontSize: 16,
        fontWeight: "600",
        color: theme.colors.text.secondary,
        marginBottom: 4,
    },
    activeTabText: {
        color: theme.colors.primary,
        fontWeight: "700",
    },
    activeLine: {
        height: 3,
        width: "60%",
        backgroundColor: theme.colors.accent,
        borderRadius: 2,
        position: "absolute",
        bottom: 0,
    },
    listContent: {
        padding: 16,
    }
});
