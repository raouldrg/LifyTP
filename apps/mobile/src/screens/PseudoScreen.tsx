import React, { useState } from "react";
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
import { api } from "../services/api";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function PseudoScreen({ navigation }: any) {
    const { refreshUser } = useAuth();
    const [displayName, setDisplayName] = useState("");
    const [loading, setLoading] = useState(false);

    const handleNext = async () => {
        if (!displayName.trim()) {
            Alert.alert("Oups", "Veuillez entrer un pseudo.");
            return;
        }

        setLoading(true);
        try {
            // Step 2: Set Display Name (Pseudo)
            // Use PATCH /users/me
            await api.patch("/users/me", { displayName: displayName.trim() });
            await refreshUser();
            navigation.navigate("Avatar"); // Next step: Avatar
        } catch (e) {
            console.error(e);
            Alert.alert("Erreur", "Impossible de définir ce pseudo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.stepIndicator}>Étape 2 sur 4</Text>
                    <Text style={styles.title}>Comment t'appelle-t-on ?</Text>
                    <Text style={styles.subtitle}>C'est le nom qui s'affichera sur ton profil et tes messages.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Ton Prénom"
                            placeholderTextColor="#ccc"
                            autoCapitalize="words"
                            autoFocus
                        />
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[styles.button, (!displayName.trim() || loading) && styles.buttonDisabled]}
                        onPress={handleNext}
                        disabled={!displayName.trim() || loading}
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
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingVertical: 12,
        marginBottom: 8,
    },
    input: {
        fontSize: 24,
        fontWeight: "600",
        color: theme.colors.text.primary,
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
