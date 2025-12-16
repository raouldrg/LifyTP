import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MessagesScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.text}>Messages</Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        ...theme.typography.h2,
        color: theme.colors.text.primary,
    },
});
