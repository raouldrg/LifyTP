import React from "react";
import { View, Text, Button, SafeAreaView, StyleSheet } from "react-native";

type Props = {
    // Navigation props can be typed more strictly later
    navigation: any;
    route: any;
};

export default function HomeScreen({ navigation, route }: Props) {
    const { user } = route.params || {};

    function onLogout() {
        // In a real app we would clear context/storage
        navigation.replace("Login");
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome Home 🏠</Text>
                {user && <Text style={styles.subtitle}>Hello, {user.username}!</Text>}

                <View style={styles.card}>
                    <Text>Your feed will appear here.</Text>
                </View>

                <Button title="Logout" onPress={onLogout} color="#ff5c5c" />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f2f2f2" },
    content: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
    subtitle: { fontSize: 18, color: "#666", marginBottom: 24 },
    card: {
        padding: 20,
        backgroundColor: "white",
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginBottom: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    }
});
