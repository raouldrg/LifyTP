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
import { login } from "../services/api";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { signIn } = useAuth();

    async function handleLogin() {
        if (!email || !password) {
            Alert.alert("Oups", "Veuillez remplir tous les champs.");
            return;
        }
        setLoading(true);
        try {
            const data = await login(email, password);
            await signIn(data.user, data.accessToken, data.refreshToken);
        } catch (err: any) {
            console.error(err);
            Alert.alert("Erreur", "Email ou mot de passe incorrect.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.appName}>LIFY.</Text>
                    <Text style={styles.title}>Bon retour 👋</Text>
                    <Text style={styles.subtitle}>Connecte-toi pour retrouver tes amis.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email ou pseudo</Text>
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
                                placeholder="••••••••"
                                autoCapitalize="none"
                                secureTextEntry={!showPassword}
                                placeholderTextColor="#ccc"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#999" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.forgotButton}>
                        <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Se connecter</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Pas encore de compte ?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                            <Text style={styles.linkText}>Créer un compte</Text>
                        </TouchableOpacity>
                    </View>

                    {/* DEBUGGING PING BUTTON */}
                    <TouchableOpacity
                        style={{ marginTop: 20, alignSelf: 'center', padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}
                        onPress={async () => {
                            try {
                                const { API_URL } = require('../services/api');
                                console.log('[PING] Testing:', API_URL + '/health');
                                const start = Date.now();
                                const res = await require('axios').get(API_URL + '/health', { timeout: 5000 });
                                const duration = Date.now() - start;
                                Alert.alert("Succès", `Ping OK (${duration}ms)\nURL: ${API_URL}/health\nRes: ${JSON.stringify(res.data)}`);
                            } catch (e: any) {
                                const { API_URL } = require('../services/api');
                                console.error('[PING] Error:', e);
                                const details = e.response
                                    ? `Status: ${e.response.status}\nData: ${JSON.stringify(e.response.data)}`
                                    : `Error: ${e.message}\nCode: ${e.code}`;
                                Alert.alert("Échec", `Ping Failed\nURL: ${API_URL}/health\n${details}`);
                            }
                        }}
                    >
                        <Text style={{ fontSize: 12, color: '#666' }}>PING API /health</Text>
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
        justifyContent: "center",
    },
    header: {
        marginBottom: 40,
    },
    appName: {
        fontSize: 24,
        fontFamily: "MontserratAlternates_700Bold",
        color: theme.colors.primary,
        marginBottom: 24,
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
    forgotButton: {
        alignSelf: "flex-end",
    },
    forgotText: {
        color: theme.colors.text.secondary,
        fontSize: 14,
        fontWeight: "500",
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
