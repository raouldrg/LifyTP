import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { setPseudo } from "../lib/api";
import { theme } from "../theme";
import { useAuth } from "../lib/AuthContext";

export default function PseudoScreen({ navigation, route }: any) {
    const { updateUser, user } = useAuth();
    const mode = route.params?.mode || 'onboard';
    const [pseudo, setPseudoValue] = useState(mode === 'edit' ? (user?.username || "") : "");
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!pseudo) return;
        setLoading(true);
        try {
            const data = await setPseudo(pseudo);
            if (data.user) {
                updateUser({ username: data.user.username });
            }
            if (mode === 'edit') {
                navigation.goBack();
            } else {
                navigation.replace("Bio");
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.error || "Erreur inconnue";
            Alert.alert("Erreur", msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            {mode === 'edit' && (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 16 }}>
                    <Text style={{ fontSize: 16, color: theme.colors.primary }}>Annuler</Text>
                </TouchableOpacity>
            )}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
                <View style={styles.content}>
                    <Text style={styles.logo}>{mode === 'edit' ? "Modifier mon pseudo" : "Bienvenue ! 👋"}</Text>
                    <Text style={styles.intro}>{mode === 'edit' ? "Attention : changement limité à une fois tous les 3 mois." : "Choisissez votre pseudo unique sur Lify."}</Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>@Pseudo</Text>
                            <TextInput
                                style={styles.input}
                                value={pseudo}
                                onChangeText={setPseudoValue}
                                placeholder="raoul_drg"
                                autoCapitalize="none"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>{mode === 'edit' ? "Enregistrer" : "Suivant"}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    keyboardView: { flex: 1 },
    content: { flex: 1, justifyContent: "center", padding: 24 },
    logo: {
        fontSize: 32,
        fontWeight: "900",
        color: theme.colors.primary,
        textAlign: "center",
        marginBottom: 8
    },
    intro: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        textAlign: "center",
        marginBottom: 32
    },
    form: { gap: 20 },
    inputContainer: { gap: 8 },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: theme.colors.text.primary,
        marginLeft: 4
    },
    input: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: theme.borderRadius.l,
        padding: 16,
        fontSize: 16,
        backgroundColor: "#FFFFFF",
        color: theme.colors.text.primary
    },
    button: {
        backgroundColor: theme.colors.primary, // Primary color for step consistency
        padding: 16,
        borderRadius: theme.borderRadius.l,
        alignItems: "center",
        marginTop: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2
    },
    buttonDisabled: {
        opacity: 0.7
    },
    buttonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 16
    }
});
