import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, checkUsername } from "../services/api"; // We will use setPseudo (which updates username in backend! Wait, setPseudo endpoint updates username too?)
// Check auth.ts:
// app.post("/auth/onboarding/pseudo", ... schema: username ... updates username)
// So 'setPseudo' function in api.ts calls '/auth/onboarding/pseudo' which updates USERNAME.
// Confusing naming in backend, but "PseudoScreen" was used for Username?
// Let's clarify:
// User Request: Step 1 = Username (@handle), Step 2 = Pseudo (DisplayName).
// Backend '/auth/onboarding/pseudo' updates USERNAME (handle).
// We need another endpoint for DisplayName?
// Check auth.ts: '/users/me' PATCH can update displayName.
// So Step 1 (Username) -> call /auth/onboarding/pseudo (which sets username).
// Step 2 (Pseudo/DisplayName) -> call PATCH /users/me (displayName).
// I will implement UsernameScreen to call 'setPseudo' (which sets username).

import { setPseudo } from "../services/api";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function UsernameScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const [username, setUsernameInput] = useState("");
    const [available, setAvailable] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);
    const [loading, setLoading] = useState(false);

    // Debounce check
    useEffect(() => {
        if (!username || username.length < 3) {
            setAvailable(null);
            return;
        }

        const timer = setTimeout(async () => {
            setChecking(true);
            try {
                const res = await checkUsername(username);
                setAvailable(res.available);
            } catch (e) {
                console.error(e);
            } finally {
                setChecking(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [username]);

    const handleNext = async () => {
        if (!available) return;
        setLoading(true);
        try {
            // "setPseudo" endpoint actually updates 'username' (the @handle)
            await setPseudo(username);
            await refreshUser();
            navigation.navigate("Pseudo"); // Next step: Display Name
        } catch (e) {
            Alert.alert("Erreur", "Impossible de définir cet identifiant.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.stepIndicator}>Étape 1 sur 4</Text>
                    <Text style={styles.title}>Choisis ton identifiant</Text>
                    <Text style={styles.subtitle}>C'est unique, comme toi. Tu pourras le changer plus tard.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.prefix}>@</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={(t) => {
                                // Force lowercase and no special chars
                                const formatted = t.toLowerCase().replace(/[^a-z0-9_.]/g, "");
                                setUsernameInput(formatted);
                            }}
                            placeholder="username"
                            placeholderTextColor="#ccc"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <View style={styles.statusIcon}>
                            {checking ? (
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : available === true ? (
                                <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
                            ) : available === false && username.length >= 3 ? (
                                <Ionicons name="close-circle" size={24} color="#FF3B30" />
                            ) : null}
                        </View>
                    </View>

                    {available === false && (
                        <Text style={styles.errorText}>Cet identifiant est déjà pris.</Text>
                    )}

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[styles.button, (!available || loading) && styles.buttonDisabled]}
                        onPress={handleNext}
                        disabled={!available || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Continuer</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    header: {
        marginTop: 40,
        marginBottom: 40,
    },
    stepIndicator: {
        color: theme.colors.accent,
        fontWeight: "600",
        marginBottom: 8,
    },
    title: {
        ...theme.typography.h1,
        marginBottom: 8,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.text.secondary,
    },
    form: {
        flex: 1,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingVertical: 12,
        marginBottom: 8,
    },
    prefix: {
        fontSize: 24,
        fontWeight: "600",
        color: theme.colors.text.primary,
        marginRight: 4,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: "600",
        color: theme.colors.text.primary,
    },
    statusIcon: {
        width: 24,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        color: theme.colors.error,
        marginTop: 4,
    },
    button: {
        backgroundColor: theme.colors.primary,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    buttonDisabled: {
        backgroundColor: "#ccc",
        shadowOpacity: 0,
    },
    buttonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "600",
    }
});
