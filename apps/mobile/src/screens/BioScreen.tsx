import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { updateProfile } from "../lib/api";
import { theme } from "../theme";
import { useAuth } from "../lib/AuthContext";

export default function BioScreen({ navigation, route }: any) {
    const { user, updateUser } = useAuth();
    const mode = route.params?.mode || 'onboard';
    const [bio, setBio] = useState(mode === 'edit' ? (user?.bio || "") : "");
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        setLoading(true);
        try {
            const data = await updateProfile(bio || "");
            if (data.user) {
                updateUser({ bio: data.user.bio });
            }

            if (mode === 'edit') {
                navigation.goBack();
            } else {
                navigation.navigate("Avatar");
            }
        } catch (err: any) {
            console.error(err);
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
                    <Text style={styles.logo}>{mode === 'edit' ? "Modifier ma bio" : "Dites-nous en plus 📝"}</Text>
                    <Text style={styles.intro}>{mode === 'edit' ? "Mettez à jour votre description." : "Une petite description pour votre profil."}</Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="J'adore la randonnée et la photo..."
                                multiline
                                numberOfLines={4}
                                placeholderTextColor="#999"
                                maxLength={160}
                            />
                            <Text style={{ textAlign: 'right', color: '#999', fontSize: 12 }}>{bio.length}/160</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>{mode === 'edit' ? "Enregistrer" : "Continuer"}</Text>
                            )}
                        </TouchableOpacity>

                        {mode !== 'edit' && (
                            <TouchableOpacity style={styles.skipButton} onPress={() => navigation.navigate("Avatar")}>
                                <Text style={styles.skipText}>Passer pour l'instant</Text>
                            </TouchableOpacity>
                        )}
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
        fontSize: 28,
        fontWeight: "800",
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
        backgroundColor: theme.colors.primary,
        padding: 16,
        borderRadius: theme.borderRadius.l,
        alignItems: "center",
        marginTop: 16,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: {
        color: "white",
        fontWeight: "700",
        fontSize: 16
    },
    skipButton: { alignItems: 'center', marginTop: 10 },
    skipText: { color: theme.colors.text.secondary }
});
