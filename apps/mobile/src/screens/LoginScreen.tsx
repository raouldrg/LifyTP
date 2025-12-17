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
import { Ionicons } from "@expo/vector-icons";
import { login } from "../lib/api";
import { theme } from "../theme";
import { useAuth } from "../lib/AuthContext";

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { signIn } = useAuth();

    async function handleLogin() {
        if (!email || !password) {
            Alert.alert("Erreur", "Veuillez remplir tous les champs.");
            return;
        }
        setLoading(true);
        try {
            const data = await login(email, password);
            console.log("Logged in:", data.user.email);

            await signIn(data.user, data.accessToken);

            // Check if pseudo update needed (optional check if username is temp)
            if (data.user.username.startsWith("user_")) {
                navigation.replace("Pseudo");
            } else {
                navigation.replace("Main");
            }
        } catch (err: any) {
            console.error(err);
            Alert.alert("Erreur", "Email ou mot de passe incorrect.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
                <View style={styles.content}>
                    <Text style={styles.logo}>LIFY<Text style={{ color: theme.colors.accent }}>.</Text></Text>
                    <Text style={styles.intro}>Connexion</Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email ou nom d'utilisateur</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email ou pseudo"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Mot de passe</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="********"
                                    autoCapitalize="none"
                                    secureTextEntry={!showPassword}
                                    placeholderTextColor="#999"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>

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

                        <TouchableOpacity onPress={() => navigation.navigate("SignUp")} style={styles.linkButton}>
                            <Text style={styles.linkText}>Pas encore de compte ? <Text style={{ fontWeight: "700", color: theme.colors.primary }}>S'inscrire</Text></Text>
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
        fontSize: 48,
        fontFamily: "MontserratAlternates_700Bold",
        color: theme.colors.primary,
        textAlign: "center",
        marginBottom: 8,
        letterSpacing: 1
        // Removed fontWeight as fontFamily handles it
    },
    intro: {
        fontSize: 18,
        color: theme.colors.text.secondary,
        textAlign: "center",
        marginBottom: 48
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
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: theme.borderRadius.l,
        backgroundColor: "#FFFFFF",
    },
    passwordInput: {
        flex: 1,
        padding: 16,
        fontSize: 16,
        color: theme.colors.text.primary
    },
    eyeIcon: {
        padding: 16
    },
    button: {
        backgroundColor: theme.colors.primary,
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
        color: "white",
        fontWeight: "700",
        fontSize: 16
    },
    linkButton: {
        alignItems: "center",
        marginTop: 16
    },
    linkText: {
        color: theme.colors.text.secondary,
        fontSize: 14
    }
});
