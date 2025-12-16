import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.menuIcon}>
                    {/* Menu Icon Placeholder */}
                </View>

                <View style={styles.profileInfo}>
                    <View style={styles.avatarContainer}>
                        {/* Placeholder for Avatar */}
                        <View style={styles.avatarPlaceholder} />
                    </View>
                    <Text style={styles.username}>raoul.drg</Text>
                    <Text style={styles.bio}>Fondateur et CEO de Lify.me</Text>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>13K</Text>
                        <Text style={styles.statLabel}>events</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>12K</Text>
                        <Text style={styles.statLabel}>followers</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>16</Text>
                        <Text style={styles.statLabel}>following</Text>
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <View style={[styles.tabItem, styles.activeTab]}>
                    <Text style={styles.tabText}>L.</Text>
                    <View style={styles.activeIndicator} />
                </View>
                <View style={styles.tabItem}>
                    <Ionicons name="person-circle-outline" size={24} color={theme.colors.primary} />
                </View>
            </View>

            {/* Grid Content */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.calendarGrid}>
                    <Text>Calendar Grid Placeholder</Text>
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
        alignItems: "center",
        paddingTop: theme.spacing.m,
    },
    menuIcon: {
        position: "absolute",
        right: theme.spacing.l,
        top: theme.spacing.m,
    },
    profileInfo: {
        alignItems: "center",
        marginBottom: theme.spacing.l,
    },
    avatarContainer: {
        marginBottom: theme.spacing.m,
    },
    avatarPlaceholder: { // Temporary
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#ccc"
    },
    username: {
        ...theme.typography.h3,
        color: theme.colors.text.primary,
        marginBottom: 4,
    },
    bio: {
        ...theme.typography.caption,
        color: theme.colors.text.secondary,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.l,
    },
    stat: {
        alignItems: "center",
    },
    statValue: {
        ...theme.typography.h3,
        color: theme.colors.text.primary,
    },
    statLabel: {
        ...theme.typography.caption,
        color: theme.colors.text.secondary,
    },
    tabs: {
        flexDirection: "row",
        justifyContent: "space-around",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
        paddingBottom: theme.spacing.s,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        width: 60,
    },
    activeTab: {},
    tabText: {
        fontSize: 24,
        fontWeight: "900",
        color: theme.colors.primary,
    },
    activeIndicator: {
        height: 3,
        width: 40,
        backgroundColor: theme.colors.accent,
        marginTop: 4,
        borderRadius: 2,
    },
    scrollContent: {
        padding: theme.spacing.m,
    },
    calendarGrid: {
        height: 300,
        backgroundColor: "#f0f0f0",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.borderRadius.m,
    }
});
