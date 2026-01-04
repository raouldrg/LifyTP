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
import { Ionicons } from "@expo/vector-icons";
import { register } from "../services/api";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function SignUpScreen({ navigation }: any) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleRegister() {
        if (!email || !password || !confirmPassword) {
            Alert.alert("Oups", "Veuillez remplir tous les champs.");
            return;
        }
        if (password.length < 6) {
            Alert.alert("Sécurité", "Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
            return;
        }

        setLoading(true);
        try {
            const data = await register(email, password);
            // Log the user in immediately
            if (data.accessToken && data.user) {
                await signIn(data.user, data.accessToken, data.refreshToken);
                // We rely on AppNavigator to route to 'Username' screen based on user state
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.error || "Impossible de créer le compte.";
            Alert.alert("Erreur", msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Nouveau compte ✨</Text>
                    <Text style={styles.subtitle}>Rejoins l'aventure Lify dès maintenant.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="hello@lify.app"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholderTextColor="#ccc"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mot de passe</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Min. 6 caractères"
                                autoCapitalize="none"
                                secureTextEntry={!showPassword}
                                placeholderTextColor="#ccc"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#999" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirmer le mot de passe</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirmer"
                                autoCapitalize="none"
                                secureTextEntry={!showPassword}
                                placeholderTextColor="#ccc"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>S'inscrire</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Déjà un compte ?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                            <Text style={styles.linkText}>Se connecter</Text>
                        </TouchableOpacity>
                    </View>
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
    backButton: {
        marginBottom: 20,
    },
    header: {
        marginBottom: 32,
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
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: theme.colors.text.primary,
    },
    input: {
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    passwordContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: theme.colors.text.primary,
    },
    button: {
        backgroundColor: theme.colors.primary,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
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
        fontSize: 16,
        fontWeight: "600",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
        marginTop: 16,
    },
    footerText: {
        color: theme.colors.text.secondary,
        fontSize: 14,
    },
    linkText: {
        color: theme.colors.primary,
        fontWeight: "700",
        fontSize: 14,
    }
});
