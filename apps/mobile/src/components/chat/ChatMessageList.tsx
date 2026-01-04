import React, { memo, useCallback, RefObject } from "react";
import {
    View,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Platform,
    NativeSyntheticEvent,
    NativeScrollEvent,
    TouchableWithoutFeedback,
    Keyboard,
    Text,
    TouchableOpacity,
} from "react-native";
import Animated, {
    FadeInDown,
    FadeOut,
    AnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";

// Re-export types for consumers
export interface MessageReaction {
    id: string;
    userId: string;
    emoji: string;
}

export interface Message {
    id: string;
    conversationId?: string;
    senderId: string;
    content?: string;
    type: "TEXT" | "IMAGE" | "AUDIO";
    mediaUrl?: string;
    duration?: number;
    createdAt: string;
    editedAt?: string | null;
    deletedAt?: string | null;
    read?: boolean;
    delivered?: boolean;
    replyTo?: {
        id: string;
        content?: string;
        type: string;
        sender?: { username?: string; id?: string };
    };
    reactions?: MessageReaction[];
    status?: "sending" | "sent" | "delivered" | "read" | "error";
    tempId?: string;
}

export type ListItem =
    | { type: "message"; data: Message }
    | { type: "separator"; date: Date; key: string };

interface ChatMessageListProps {
    listData: ListItem[];
    loading: boolean;
    fetchingMore: boolean;
    isAtBottom: boolean;
    newMessageCount: number;
    isRecordingActive: boolean;
    flatListRef: RefObject<FlatList | null>;
    containerStyle?: AnimatedStyle;
    renderItem: (info: { item: ListItem }) => React.ReactElement | null;
    keyExtractor: (item: ListItem) => string;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLoadMore: () => void;
    onScrollToBottom: () => void;
}

/**
 * ChatMessageList - Optimized FlatList wrapper for chat messages
 * Handles inverted list, loading states, pagination, and "new messages" button
 */
function ChatMessageListComponent({
    listData,
    loading,
    fetchingMore,
    isAtBottom,
    newMessageCount,
    isRecordingActive,
    flatListRef,
    containerStyle,
    renderItem,
    keyExtractor,
    onScroll,
    onLoadMore,
    onScrollToBottom,
}: ChatMessageListProps) {
    const ListFooter = useCallback(() => {
        if (!fetchingMore) return null;
        return (
            <ActivityIndicator
                size="small"
                color={theme.colors.accent}
                style={styles.loadingFooter}
            />
        );
    }, [fetchingMore]);

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <Animated.View style={[styles.messagesContainer, containerStyle]}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.accent} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={listData}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        contentContainerStyle={styles.messagesContent}
                        inverted
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.3}
                        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
                        ListFooterComponent={ListFooter}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        removeClippedSubviews={Platform.OS === "android"}
                        maxToRenderPerBatch={15}
                        windowSize={10}
                        initialNumToRender={20}
                        scrollEnabled={!isRecordingActive}
                    />
                )}

                {/* New messages button */}
                {newMessageCount > 0 && !isAtBottom && (
                    <Animated.View
                        entering={FadeInDown.duration(200)}
                        exiting={FadeOut.duration(150)}
                        style={styles.newMessageButton}
                        pointerEvents="box-none"
                    >
                        <TouchableOpacity
                            onPress={onScrollToBottom}
                            style={styles.newMessageButtonInner}
                        >
                            <Ionicons name="chevron-down" size={18} color="#fff" />
                            <Text style={styles.newMessageButtonText}>
                                {newMessageCount} nouveau
                                {newMessageCount > 1 ? "x" : ""} message
                                {newMessageCount > 1 ? "s" : ""}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

export const ChatMessageList = memo(ChatMessageListComponent);

const styles = StyleSheet.create({
    messagesContainer: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    messagesContent: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexGrow: 1,
    },
    loadingFooter: {
        marginVertical: 10,
    },
    newMessageButton: {
        position: "absolute",
        bottom: 12,
        alignSelf: "center",
    },
    newMessageButtonInner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    newMessageButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
        marginLeft: 4,
    },
});
