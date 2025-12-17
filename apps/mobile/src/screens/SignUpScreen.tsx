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
import { register } from "../lib/api";
import { theme } from "../theme";
import { useAuth } from "../lib/AuthContext";

export default function SignUpScreen({ navigation }: any) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleRegister() {
        if (!email || !password || !confirmPassword) {
            Alert.alert("Erreur", "Veuillez remplir tous les champs.");
            return;
        }
        if (password.length < 6) {
            Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères.");
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
                await signIn(data.user, data.accessToken);
            }
            // Navigate to Pseudo selection.
            navigation.replace("Pseudo");
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
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
                <View style={styles.content}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backText}>← Retour</Text>
                    </TouchableOpacity>

                    <Text style={styles.logo}>Inscription</Text>
                    <Text style={styles.intro}>Rejoignez <Text style={{ fontFamily: "MontserratAlternates_700Bold" }}>Lify</Text> aujourd'hui.</Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="votre@email.com"
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
                                    placeholder="Min. 6 caractères"
                                    autoCapitalize="none"
                                    secureTextEntry={!showPassword}
                                    placeholderTextColor="#999"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Confirmer mot de passe</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="••••••"
                                    autoCapitalize="none"
                                    secureTextEntry={!showPassword}
                                    placeholderTextColor="#999"
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
                                <Text style={styles.buttonText}>Créer mon compte</Text>
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
    backButton: { position: "absolute", top: 20, left: 24, zIndex: 10 },
    backText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        fontWeight: "600"
    },
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
        marginTop: 16
    },
    buttonDisabled: {
        opacity: 0.7
    },
    buttonText: {
        color: "white",
        fontWeight: "700",
        fontSize: 16
    }
});
