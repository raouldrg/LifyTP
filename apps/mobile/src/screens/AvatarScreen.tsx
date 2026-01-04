import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
    ActionSheetIOS
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { api, uploadFile } from "../services/api";
import { theme } from "../theme";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import DefaultAvatarPicker from "../components/DefaultAvatarPicker";

export default function AvatarScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const [imageUri, setImageUri] = useState<string | null>(user?.avatarUrl || null);
    const [avatarColor, setAvatarColor] = useState<string | null>(user?.avatarColor || null);
    const [loading, setLoading] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    // Initial check: if user has avatar, set it
    // But we are in onboarding, usually empty.

    // Derived display props
    // If imageUri is set (local or remote), use it.
    // If not, use avatarColor.

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                setImageUri(result.assets[0].uri);
                setAvatarColor(null); // Clear color if image picked
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie');
        }
    };

    const handleOptions = () => {
        const options = ['Choisir une photo', 'Avatar Lify (Couleur)', 'Annuler'];
        const cancelButtonIndex = 2;

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex,
                    title: 'Modifier l\'avatar'
                },
                buttonIndex => {
                    if (buttonIndex === 0) pickImage();
                    else if (buttonIndex === 1) setShowColorPicker(true);
                }
            );
        } else {
            Alert.alert('Modifier l\'avatar', undefined, [
                { text: 'Choisir une photo', onPress: pickImage },
                { text: 'Avatar Lify (Couleur)', onPress: () => setShowColorPicker(true) },
                { text: 'Annuler', style: 'cancel' }
            ]);
        }
    };

    const handleNext = async () => {
        setLoading(true);
        try {
            // If local image URI (not http), upload it
            let finalUrl = imageUri;
            if (imageUri && !imageUri.startsWith('http')) {
                const res = await uploadFile(imageUri, 'image');
                finalUrl = res.url;
            } else if (!imageUri) {
                finalUrl = null;
            }

            // Update user
            const updatePayload: any = {
                avatarUrl: finalUrl,
                avatarColor: avatarColor
            };

            // Use PATCH /users/me as it handles both
            await api.patch('/users/me', updatePayload);

            await refreshUser();
            navigation.navigate("Bio");
        } catch (e: any) {
            console.error(e);
            Alert.alert("Erreur", "Impossible de sauvegarder l'avatar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.stepIndicator}>Étape 3 sur 4</Text>
                    <Text style={styles.title}>Une photo ?</Text>
                    <Text style={styles.subtitle}>Montre ton plus beau sourire aux autres membres.</Text>
                </View>

                <View style={styles.centerContainer}>
                    <TouchableOpacity onPress={handleOptions} activeOpacity={0.8}>
                        <Avatar
                            avatarUrl={imageUri}
                            avatarColor={avatarColor}
                            username={user?.username}
                            displayName={user?.displayName}
                            size={160}
                            style={styles.avatar}
                        />
                        <View style={styles.editBadge}>
                            <Ionicons name="pencil" size={20} color="white" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleOptions} style={styles.changeButton}>
                        <Text style={styles.changeText}>Modifier</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleNext}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>Continuer</Text>
                    )}
                </TouchableOpacity>
            </View>

            <DefaultAvatarPicker
                visible={showColorPicker}
                onClose={() => setShowColorPicker(false)}
                onSelectColor={(color) => {
                    setAvatarColor(color);
                    setImageUri(null); // Clear image if color picked
                    setShowColorPicker(false);
                }}
                username={user?.username}
            />
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
    centerContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
    },
    avatar: {
        // Avatar component has its own styles, but we can override if needed
    },
    editBadge: {
        position: "absolute",
        bottom: 5,
        right: 5,
        backgroundColor: theme.colors.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: theme.colors.background,
    },
    changeButton: {
        marginTop: 16,
        padding: 8,
    },
    changeText: {
        color: theme.colors.primary,
        fontWeight: "600",
        fontSize: 16,
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
