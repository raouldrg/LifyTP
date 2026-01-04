import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

export function PrivateProfileGate() {
    return (
        <View style={styles.container}>
            <View style={styles.lockContainer}>
                <Ionicons name="lock-closed" size={60} color="#C7C7CC" />
            </View>

            <Text style={styles.title}>Ce profil est privé</Text>
            <Text style={styles.subtitle}>
                Abonnez-vous pour voir ses événements et son calendrier
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 70,
        paddingHorizontal: 40,
    },
    lockContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: theme.colors.text.primary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: "center",
        lineHeight: 20,
    },
});
