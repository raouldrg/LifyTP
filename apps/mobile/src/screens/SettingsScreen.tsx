import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";

export default function SettingsScreen({ navigation }: any) {
    const { signOut, user } = useAuth();
    const [isPrivate, setIsPrivate] = useState(false);
    const [loadingPrivate, setLoadingPrivate] = useState(true);

    useEffect(() => {
        fetchPrivacySetting();
    }, []);

    const fetchPrivacySetting = async () => {
        try {
            const res = await api.get(`/users/${user?.id}`);
            setIsPrivate(res.data.isPrivate ?? false);
        } catch (e) {
            console.error("Failed to fetch privacy setting", e);
        } finally {
            setLoadingPrivate(false);
        }
    };

    const handlePrivateToggle = async (value: boolean) => {
        setIsPrivate(value);
        try {
            await api.patch("/users/me", { isPrivate: value });
        } catch (e) {
            console.error("Failed to update privacy setting", e);
            setIsPrivate(!value); // Revert on error
            Alert.alert("Erreur", "Impossible de modifier le paramètre de confidentialité");
        }
    };

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

                <Text style={styles.sectionTitle}>Confidentialité</Text>

                <View style={styles.itemSwitch}>
                    <View style={styles.itemLeft}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.primary} />
                        <View style={styles.itemTextContainer}>
                            <Text style={styles.itemText}>Compte privé</Text>
                            <Text style={styles.itemDescription}>
                                Seuls vos abonnés approuvés peuvent voir vos événements
                            </Text>
                        </View>
                    </View>
                    {loadingPrivate ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <Switch
                            value={isPrivate}
                            onValueChange={handlePrivateToggle}
                            trackColor={{ false: "#D1D1D6", true: theme.colors.primary }}
                            thumbColor="#FFFFFF"
                        />
                    )}
                </View>

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
    itemSwitch: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0"
    },
    itemTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    itemDescription: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
    itemLogout: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 16,
    },
    itemTextLogout: { fontSize: 16, color: theme.colors.error, fontWeight: "600" }
});
