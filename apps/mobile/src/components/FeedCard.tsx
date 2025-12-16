import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";

interface FeedCardProps {
    username: string;
    avatarUrl?: string; // Optional for now
    actionText: string;
    timeAgo: string;
    imageUrl?: string;
    likes: number;
    comments: number;
    shares: number;
    hasGradient?: boolean; // For the "concert" card style
}

export function FeedCard({
    username,
    actionText,
    timeAgo,
    imageUrl,
    likes,
    comments,
    shares,
    hasGradient,
}: FeedCardProps) {
    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    {/* Avatar Placeholder */}
                    <View style={styles.avatarPlaceholder} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.username}>{username}</Text>
                    <Text style={styles.action}>{actionText}</Text>
                </View>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {hasGradient ? (
                    <View style={[styles.imagePlaceholder, { backgroundColor: "#ED6C6C" }]}>
                        {/* Simulated Gradient/Event Card */}
                        <View style={styles.eventOverlay}>
                            <Text style={styles.eventTitle}>27/12/2027 à 22h00</Text>
                            <Text style={styles.eventLocation}>📍 Bercy, Paris</Text>

                            {/* Bottom Action strip within the card */}
                            <View style={styles.eventActions}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="home-outline" size={24} color="#333" />
                                </View>
                                {/* Other icons... */}
                            </View>
                        </View>
                    </View>
                ) : (
                    imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
                    ) : (
                        <View style={styles.imagePlaceholder} />
                    )
                )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.stats}>
                    <Ionicons name="heart" size={18} color={theme.colors.accent} />
                    <Text style={styles.statText}>{likes > 1000 ? `${(likes / 1000).toFixed(0)}K` : likes}</Text>

                    <Ionicons name="chatbubble-outline" size={18} color={theme.colors.text.secondary} style={{ marginLeft: 12 }} />
                    <Text style={styles.statText}>{comments > 1000 ? `${(comments / 1000).toFixed(0)}K` : comments}</Text>

                    <Ionicons name="share-outline" size={18} color={theme.colors.text.secondary} style={{ marginLeft: 12 }} />
                    <Text style={styles.statText}>{shares}</Text>
                </View>
                <Text style={styles.timeAgo}>il y a {timeAgo}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: 24,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    avatarContainer: {
        marginRight: 10,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#ccc",
    },
    headerText: {
        flex: 1,
    },
    username: {
        fontWeight: "700",
        fontSize: 14,
        color: theme.colors.text.primary,
    },
    action: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        lineHeight: 18,
    },
    content: {
        marginBottom: 12,
        borderRadius: 16,
        overflow: "hidden",
    },
    image: {
        width: "100%",
        height: 300,
        borderRadius: 16,
    },
    imagePlaceholder: {
        width: "100%",
        height: 300,
        backgroundColor: "#e0e0e0",
        borderRadius: 16,
        justifyContent: "flex-end",
    },
    eventOverlay: {
        padding: 16,
    },
    eventTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    eventLocation: {
        color: "#fff",
        opacity: 0.9,
        marginTop: 4,
    },
    eventActions: {
        flexDirection: "row",
        marginTop: 20,
        backgroundColor: "rgba(255,255,255,0.3)",
        borderRadius: 30, // Big pill
        padding: 8,
        justifyContent: "space-between",
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    stats: {
        flexDirection: "row",
        alignItems: "center",
    },
    statText: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: "600",
        color: theme.colors.text.primary,
    },
    timeAgo: {
        fontSize: 12,
        color: theme.colors.text.secondary,
    },
});
