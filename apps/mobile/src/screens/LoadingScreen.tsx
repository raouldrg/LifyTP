import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { theme } from "../theme";

const { width } = Dimensions.get("window");

export default function LoadingScreen() {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(progress, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: false,
                }),
                Animated.timing(progress, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: false,
                }),
            ])
        ).start();
    }, []);

    const widthInterpolated = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
    });

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.logo}>
                    LIFY<Text style={styles.dot}>.</Text>
                </Text>

                <View style={styles.progressContainer}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            { width: widthInterpolated }
                        ]}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background, // Light/Cream background
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        alignItems: "center",
        width: width * 0.6,
    },
    logo: {
        fontSize: 48,
        fontWeight: "700",
        color: theme.colors.text.primary, // Dark text
        marginBottom: 40,
        letterSpacing: 2,
        fontFamily: "System",
    },
    dot: {
        color: theme.colors.accent,
    },
    progressContainer: {
        height: 4,
        width: "100%",
        backgroundColor: "rgba(0,0,0,0.1)", // Light track
        borderRadius: 2,
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        backgroundColor: theme.colors.accent,
        borderRadius: 2,
    },
});
