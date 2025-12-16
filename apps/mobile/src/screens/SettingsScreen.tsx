import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from "react-native";
import { theme } from "../theme";
import { useAuth } from "../lib/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsScreen({ navigation }: any) {
    const { signOut } = useAuth();

    async function handleLogout() {
        Alert.alert(
            "Déconnexion",
            "Êtes-vous sûr de vouloir vous déconnecter ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Se déconnecter",
                    style: "destructive",
                    onPress: async () => {
                        await signOut();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                        });
                    }
                }
            ]
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Paramètres</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Compte</Text>

                <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Pseudo", { mode: 'edit' })}>
                    <View style={styles.itemLeft}>
                        <Ionicons name="person-outline" size={20} color={theme.colors.text.primary} />
                        <Text style={styles.itemText}>Modifier mon pseudo</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Bio", { mode: 'edit' })}>
                    <View style={styles.itemLeft}>
                        <Ionicons name="text-outline" size={20} color={theme.colors.text.primary} />
                        <Text style={styles.itemText}>Modifier ma bio</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Avatar", { mode: 'edit' })}>
                    <View style={styles.itemLeft}>
                        <Ionicons name="image-outline" size={20} color={theme.colors.text.primary} />
                        <Text style={styles.itemText}>Changer photo de profil</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity style={styles.itemLogout} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                    <Text style={styles.itemTextLogout}>Se déconnecter</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee"
    },
    backButton: { padding: 4 },
    title: { fontSize: 18, fontWeight: "700", color: theme.colors.text.primary },
    content: { padding: 24 },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: theme.colors.text.secondary,
        marginBottom: 16,
        textTransform: "uppercase"
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0"
    },
    itemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    itemText: { fontSize: 16, color: theme.colors.text.primary },
    separator: { height: 32 },
    itemLogout: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 16,
    },
    itemTextLogout: { fontSize: 16, color: theme.colors.error, fontWeight: "600" }
});
