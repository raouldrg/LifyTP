import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Alert
} from "react-native";
import { mockLogin } from "../lib/api";

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("test@lify.app");
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (!email) return;
        setLoading(true);
        try {
            // 1. Appel API
            const data = await mockLogin(email);
            // data = { accessToken, user: { ... } }

            // 2. Navigation vers Home avec les infos user
            // (Idéalement on stocke le token dans un Context/Store)
            navigation.replace("Home", { user: data.user });

        } catch (err: any) {
            Alert.alert("Login Failed", err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.logo}>Lify 📅</Text>
                <Text style={styles.intro}>The calendar-based social network.</Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Ex: test@lify.app"
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In with Mock Auth</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { flex: 1, justifyContent: "center", padding: 24 },
    logo: { fontSize: 40, fontWeight: "800", color: "#333", textAlign: "center", marginBottom: 8 },
    intro: { fontSize: 16, color: "#666", textAlign: "center", marginBottom: 48 },
    form: { gap: 16 },
    label: { fontSize: 14, fontWeight: "600", color: "#333" },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: "#f9f9f9"
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 8
    },
    buttonDisabled: {
        opacity: 0.7
    },
    buttonText: {
        color: "white",
        fontWeight: "600",
        fontSize: 16
    }
});
