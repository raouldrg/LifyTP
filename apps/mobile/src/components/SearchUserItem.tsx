import React from 'react';
import { StyleSheet, Text, View, Image, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    FadeInDown,
    Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { resolveImageUrl } from '../services/api';

interface User {
    id: string;
    username: string;
    avatarUrl?: string;
    bio?: string;
}

interface SearchUserItemProps {
    user: User;
    index: number;
    onPress: (user: User) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SearchUserItem({ user, index, onPress }: SearchUserItemProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withTiming(0.97, {
            duration: 100,
            easing: Easing.out(Easing.cubic),
        });
        opacity.value = withTiming(0.9, { duration: 100 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
        });
        opacity.value = withTiming(1, { duration: 200 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress(user);
    };

    const getAvatarUri = () => {
        if (user.avatarUrl) {
            return resolveImageUrl(user.avatarUrl) ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=FFA07A&color=fff&size=96`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=FFA07A&color=fff&size=96`;
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).duration(300).easing(Easing.out(Easing.cubic))}
        >
            <AnimatedPressable
                style={[styles.container, animatedStyle]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
            >
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: getAvatarUri() }} style={styles.avatar} />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.username} numberOfLines={1}>{user.username}</Text>
                    <Text style={styles.handle} numberOfLines={1}>@{user.username.toLowerCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </AnimatedPressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    },
    avatarContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F2F2F7',
    },
    userInfo: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        letterSpacing: -0.2,
    },
    handle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 2,
    },
});
