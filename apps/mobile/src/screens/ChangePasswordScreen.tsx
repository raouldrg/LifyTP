import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordScreen() {
    const navigation = useNavigation();
    const { user, signOut } = useAuth();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    const isValid =
        currentPassword.length > 0 &&
        newPassword.length >= 6 &&
        newPassword === confirmPassword;

    const handleSubmit = async () => {
        if (!isValid) return;

        setIsLoading(true);
        try {
            await api.patch('/users/me/password', {
                currentPassword,
                newPassword
            });

            Alert.alert(
                "Succès",
                "Votre mot de passe a été modifié. Veuillez vous reconnecter.",
                [
                    {
                        text: "Se reconnecter",
                        onPress: () => {
                            signOut();
                            // Navigation to Login is handled by AuthContext state change usually
                            // But just in case invoke a navigation reset if needed? 
                            // Usually signOut clears the token and valid session, forcing the root navigator to switch to Auth stack.
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.message || "Une erreur est survenue";

            if (msg.includes("Incorrect current password") || msg.includes("incorrect")) {
                Alert.alert("Erreur", "Le mot de passe actuel est incorrect.");
            } else {
                Alert.alert("Erreur", msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Modifier le mot de passe</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>

                    {/* Hidden/Read-only username field to assist iOS Keychain */}
                    {/* iOS sometimes needs to see the username associated with the password fields */}
                    <View style={styles.usernameContainer}>
                        <Text style={styles.usernameLabel}>Compte : @{user?.username}</Text>
                        {/* Visually hidden input for username context if needed, but text display is often enough */}
                        <TextInput
                            value={user?.username || ''}
                            editable={false}
                            style={{ height: 0, opacity: 0 }}
                            textContentType="username"
                            autoComplete="username"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mot de passe actuel</Text>
                        <TextInput
                            style={styles.input}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Entrez votre mot de passe actuel"
                            secureTextEntry
                            autoCapitalize="none"
                            // iOS AutoFill props
                            textContentType="password"
                            autoComplete="password" // or "current-password"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nouveau mot de passe</Text>
                        <TextInput
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="6 caractères minimum"
                            secureTextEntry
                            autoCapitalize="none"
                            // iOS AutoFill props
                            textContentType="newPassword"
                            autoComplete="new-password"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirmer le mot de passe</Text>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Répétez le mot de passe"
                            secureTextEntry
                            autoCapitalize="none"
                            // iOS AutoFill props
                            textContentType="newPassword"
                            autoComplete="new-password"
                        />
                    </View>

                    {newPassword.length > 0 && newPassword.length < 6 && (
                        <Text style={styles.errorText}>Le mot de passe doit contenir au moins 6 caractères</Text>
                    )}

                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
                    )}

                    <TouchableOpacity
                        style={[styles.saveButton, (!isValid || isLoading) && styles.saveButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={!isValid || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.saveButtonText}>Mettre à jour</Text>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    content: {
        padding: 20,
    },
    usernameContainer: {
        marginBottom: 24,
        alignItems: 'center',
    },
    usernameLabel: {
        fontSize: 15,
        color: '#8E8E93',
        fontWeight: '500',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F2F2F7',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#000',
    },
    saveButton: {
        backgroundColor: theme.colors.accent,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonDisabled: {
        backgroundColor: '#CCC',
        opacity: 0.8,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 13,
        marginTop: -10,
        marginBottom: 20,
        marginLeft: 4,
    }
});
