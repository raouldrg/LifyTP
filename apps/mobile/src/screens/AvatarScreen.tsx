import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Image,
    ActivityIndicator,
    Alert
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { updateProfile, uploadAvatar } from "../lib/api";
import { theme } from "../theme";
import { useAuth } from "../lib/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function AvatarScreen({ navigation, route }: any) {
    const { user, updateUser, token, signIn } = useAuth();
    const mode = route.params?.mode || 'onboard';

    // State
    const [seed, setSeed] = useState(Date.now().toString());
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Derived
    const randomAvatarUrl = `https://ui-avatars.com/api/?name=${user?.username || "User"}&background=random&size=200&length=1&bold=true&seed=${seed}`;
    // If editing and no selection made, show current avatar. If onboarding, show random.
    const initialImage = mode === 'edit' ? (user?.avatarUrl || randomAvatarUrl) : randomAvatarUrl;
    const displayImage = selectedImage || initialImage;

    function handleRegenerate() {
        setSeed(Math.random().toString());
        setSelectedImage(null); // Reset manual selection if regenerating
    }

    async function handleChoosePhoto() {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    }

    async function handleFinish() {
        setLoading(true);
        try {
            let finalAvatarUrl = displayImage;

            // If user selected an image, upload it first
            if (selectedImage) {
                const uploadRes = await uploadAvatar(selectedImage);
                if (uploadRes.url) {
                    finalAvatarUrl = uploadRes.url;
                }
            } else {
                if (mode === 'edit' && !selectedImage) {
                    // Keeping existing or just modifying random seed
                    // If displayImage is a random URL we generated
                    finalAvatarUrl = displayImage;
                }
            }

            // Update Backend
            // If we uploaded, finalAvatarUrl is the remote URL
            // If we didn't, it's the randomAvatarUrl
            const data = await updateProfile(undefined, finalAvatarUrl);

            // Immediate Context Update
            if (data.user) {
                updateUser({ avatarUrl: data.user.avatarUrl });
            } else {
                // Fallback if backend doesn't return user for some reason (rare)
                updateUser({ avatarUrl: finalAvatarUrl });
            }

            if (mode === 'edit') {
                navigation.goBack();
            } else {
                navigation.replace("Main");
            }
        } catch (err) {
            console.error(err);
            Alert.alert("Erreur", "Impossible de mettre à jour l'avatar.");
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
            <View style={styles.content}>
                <Text style={styles.logo}>{mode === 'edit' ? "Changer de photo" : "Votre look 😎"}</Text>
                <Text style={styles.intro}>{mode === 'edit' ? "Mettez à jour votre photo de profil." : "Choisissez une photo de profil."}</Text>

                <View style={styles.avatarContainer}>
                    <Image source={{ uri: displayImage }} style={styles.avatar} />
                    <TouchableOpacity onPress={handleRegenerate} style={styles.refreshButton}>
                        <Ionicons name="dice-outline" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleChoosePhoto} style={styles.secondaryButton}>
                    <Ionicons name="image-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryButtonText}>Importer une photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleFinish}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>{mode === 'edit' ? "Enregistrer" : "C'est parti !"}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
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
        marginBottom: 48
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 48,
    },
    avatar: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#eee'
    },
    refreshButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: theme.colors.accent,
        padding: 10,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: theme.colors.background
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: theme.borderRadius.l,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        marginBottom: 24
    },
    secondaryButtonText: {
        color: theme.colors.primary,
        fontWeight: "600",
        fontSize: 16
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: theme.borderRadius.l,
        width: '100%',
        alignItems: "center",
        marginTop: 16,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: {
        color: "white",
        fontWeight: "700",
        fontSize: 18
    }
});
