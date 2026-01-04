import React, { memo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme } from "../../theme";
import { resolveImageUrl } from "../../services/api";

interface OtherUser {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
}

interface ChatHeaderProps {
    otherUser: OtherUser;
    conversationId: string | null;
    onBack: () => void;
    onUserPress: () => void;
    onCallPress?: () => void;
    onVideoPress?: () => void;
    onMenuPress?: () => void;
}

/**
 * ChatHeader - Instagram-style chat header
 * Left: Back + Avatar + Username
 * Right: Call + Video + Menu icons
 */
function ChatHeaderComponent({
    otherUser,
    conversationId,
    onBack,
    onUserPress,
    onCallPress,
    onVideoPress,
    onMenuPress,
}: ChatHeaderProps) {
    // Display name with fallback
    const displayName = otherUser.displayName || otherUser.username;

    const avatarUri =
        resolveImageUrl(otherUser.avatarUrl) ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            displayName
        )}&background=random&size=96`;

    const handleIconPress = (callback?: () => void) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        callback?.();
    };

    return (
        <View style={styles.header}>
            {/* Left side: Back + Avatar + Name */}
            <View style={styles.headerLeft}>
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.headerBackButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name="chevron-back"
                        size={28}
                        color={theme.colors.primary}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerUserInfo}
                    onPress={onUserPress}
                    activeOpacity={0.7}
                >
                    <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
                    <Text style={styles.headerName} numberOfLines={1}>
                        {displayName}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Right side: Call + Video + Menu */}
            <View style={styles.headerRight}>
                <TouchableOpacity
                    style={styles.headerIconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    onPress={() => handleIconPress(onCallPress)}
                >
                    <Ionicons
                        name="call-outline"
                        size={22}
                        color={theme.colors.primary}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerIconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    onPress={() => handleIconPress(onVideoPress)}
                >
                    <Ionicons
                        name="videocam-outline"
                        size={24}
                        color={theme.colors.primary}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerIconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
                    onPress={() => handleIconPress(onMenuPress)}
                >
                    <Ionicons
                        name="ellipsis-horizontal"
                        size={24}
                        color={theme.colors.primary}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export const ChatHeader = memo(ChatHeaderComponent);

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        height: 50,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(0, 0, 0, 0.08)",
        zIndex: 10,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    headerBackButton: {
        width: 36,
        height: 40,
        justifyContent: "center",
        alignItems: "flex-start",
    },
    headerUserInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerIconButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F0F0F0",
        marginRight: 8,
    },
    headerName: {
        fontSize: 16,
        fontWeight: "600",
        fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
        letterSpacing: -0.3,
        color: "#1A1A1A",
        maxWidth: 140,
    },
});
