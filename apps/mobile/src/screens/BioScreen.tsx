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

export default function BioScreen({ navigation }: any) {
    const { refreshUser } = useAuth();
    const [bio, setBio] = useState("");
    const [loading, setLoading] = useState(false);

    const handleFinish = async () => {
        setLoading(true);
        try {
            // Step 4: Set Bio
            if (bio.trim()) {
                await api.post("/auth/onboarding/update", { bio: bio.trim() });
                await refreshUser();
            }
            // FINISH ONBOARDING
            // Navigate to Main Stack
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
        } catch (e) {
            console.error(e);
            Alert.alert("Erreur", "Impossible de sauvegarder la bio.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.stepIndicator}>Étape 4 sur 4</Text>
                    <Text style={styles.title}>Dis-nous en plus</Text>
                    <Text style={styles.subtitle}>Une petite phrase pour te présenter (optionnel).</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="J'adore la rando et les concerts..."
                            placeholderTextColor="#ccc"
                            multiline
                            maxLength={160}
                            autoFocus
                        />
                        <Text style={styles.charCount}>{bio.length}/160</Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleFinish}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Terminer</Text>
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
        backgroundColor: "#F5F5F5",
        borderRadius: 16,
        padding: 16,
        minHeight: 120,
    },
    input: {
        fontSize: 18,
        color: theme.colors.text.primary,
        minHeight: 80,
        textAlignVertical: "top",
    },
    charCount: {
        textAlign: "right",
        color: "#999",
        fontSize: 12,
        marginTop: 8,
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
