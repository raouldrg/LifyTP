import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { api, uploadFile } from "../../services/api";
import { setAudioModeAsync } from "expo-audio";
import { Message, MessageReaction } from "../../components/chat";

interface SendMessagePayload {
    content?: string;
    type: "TEXT" | "IMAGE" | "AUDIO";
    mediaUrl?: string;
    duration?: number;
    replyToId?: string;
}

interface UseChatActionsOptions {
    otherUserId: string;
    userId: string;
    conversationId: string | null;
    fetchUnreadCount: () => Promise<void>;
    onMessageSent?: (message: Message) => void;
    onMessageUpdated?: (messageId: string, updates: Partial<Message>) => void;
    // Called when conversation is created on first message (lazy creation)
    onConversationCreated?: (conversationId: string, status: 'NORMAL' | 'REQUEST', isInitiator: boolean) => void;
}

interface UseChatActionsReturn {
    sending: boolean;
    sendTextMessage: (
        content: string,
        replyToId?: string
    ) => Promise<Message | null>;
    sendImageMessages: (
        imageUris: string[],
        content?: string,
        replyToId?: string
    ) => Promise<void>;
    sendAudioMessage: (
        uri: string,
        durationMs: number
    ) => Promise<Message | null>;
    editMessage: (
        messageId: string,
        newContent: string
    ) => Promise<boolean>;
    deleteMessage: (
        message: Message,
        onRollback: () => void
    ) => Promise<boolean>;
    addReaction: (messageId: string, emoji: string) => Promise<MessageReaction | null>;
    removeReaction: (messageId: string) => Promise<boolean>;
    markConversationRead: () => Promise<void>;
}

/**
 * useChatActions - Hook for chat API actions
 * 
 * Handles:
 * - Send message (text, image, audio)
 * - Edit message
 * - Delete message
 * - Add/remove reactions
 * - Mark conversation as read (THROTTLED)
 * 
 * CRITICAL: markConversationRead is throttled to max 1 call per 2 seconds
 * and only triggers if conversationId is valid.
 */
export function useChatActions({
    otherUserId,
    userId,
    conversationId,
    fetchUnreadCount,
    onMessageSent,
    onMessageUpdated,
    onConversationCreated,
}: UseChatActionsOptions): UseChatActionsReturn {
    const sendingRef = useRef(false);

    // ========================================
    // THROTTLED MARK AS READ
    // ========================================
    const lastReadRef = useRef<number>(0);
    const lastReadConversationRef = useRef<string | null>(null);

    /**
     * Mark conversation as read - THROTTLED
     * 
     * Rules:
     * - Max 1 call per 2 seconds
     * - Only if conversationId is valid
     * - Tracks last read conversation to avoid redundant calls
     */
    const markConversationRead = useCallback(async () => {
        if (!conversationId) return;

        const now = Date.now();

        // Throttle: max once per 2 seconds
        if (now - lastReadRef.current < 2000) {
            return;
        }

        // Skip if we already marked this conversation as read recently
        if (
            lastReadConversationRef.current === conversationId &&
            now - lastReadRef.current < 5000
        ) {
            return;
        }

        lastReadRef.current = now;
        lastReadConversationRef.current = conversationId;

        try {
            await api.post(`/messages/read/${conversationId}`);
            // Update global unread count (already throttled in AuthContext)
            fetchUnreadCount();
        } catch (e) {
            console.error("[useChatActions] Mark read failed:", e);
        }
    }, [conversationId, fetchUnreadCount]);

    // ========================================
    // SEND TEXT MESSAGE
    // ========================================
    const sendTextMessage = useCallback(
        async (content: string, replyToId?: string): Promise<Message | null> => {
            if (!content.trim()) return null;

            try {
                const res = await api.post(`/messages/to/${otherUserId}`, {
                    content: content.trim(),
                    type: "TEXT",
                    replyToId,
                });

                // Handle lazy conversation creation
                const { conversation, conversationStatus, isInitiator, message } = res.data;
                if (conversation && onConversationCreated) {
                    onConversationCreated(conversation.id, conversationStatus, isInitiator);
                }

                return message;
            } catch (error) {
                console.error("[useChatActions] Send text error:", error);
                Alert.alert("Erreur", "Impossible d'envoyer le message");
                return null;
            }
        },
        [otherUserId, onConversationCreated]
    );

    // ========================================
    // SEND IMAGE MESSAGES
    // ========================================
    const sendImageMessages = useCallback(
        async (
            imageUris: string[],
            content?: string,
            replyToId?: string
        ): Promise<void> => {
            for (let i = 0; i < imageUris.length; i++) {
                const uri = imageUris[i];
                try {
                    const { url } = await uploadFile(uri, "image/jpeg");
                    const msgContent = i === 0 && content ? content : null;

                    await api.post(`/messages/to/${otherUserId}`, {
                        content: msgContent,
                        type: "IMAGE",
                        mediaUrl: url,
                        replyToId: i === 0 ? replyToId : undefined,
                    });
                } catch (error) {
                    console.error("[useChatActions] Send image error:", error);
                    Alert.alert("Erreur", "Impossible d'envoyer l'image");
                }
            }
        },
        [otherUserId]
    );

    // ========================================
    // SEND AUDIO MESSAGE
    // ========================================
    const sendAudioMessage = useCallback(
        async (uri: string, durationMs: number): Promise<Message | null> => {
            try {
                // Reset audio mode for playback
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });

                // Upload the audio file
                const { url } = await uploadFile(uri, "audio/m4a");

                // Send the message
                const response = await api.post(`/messages/to/${otherUserId}`, {
                    mediaUrl: url,
                    type: "AUDIO",
                    duration: durationMs,
                });

                return response.data?.message;
            } catch (error) {
                console.error("[useChatActions] Send audio error:", error);
                Alert.alert("Erreur", "Impossible d'envoyer le message audio");
                return null;
            }
        },
        [otherUserId]
    );

    // ========================================
    // EDIT MESSAGE
    // ========================================
    const editMessage = useCallback(
        async (messageId: string, newContent: string): Promise<boolean> => {
            if (!newContent.trim()) return false;

            try {
                const res = await api.patch(`/messages/${messageId}`, {
                    content: newContent.trim(),
                });

                onMessageUpdated?.(messageId, {
                    content: res.data.message.content,
                    editedAt: res.data.message.editedAt,
                });

                return true;
            } catch (error) {
                console.error("[useChatActions] Edit error:", error);
                Alert.alert("Erreur", "Impossible de modifier le message");
                return false;
            }
        },
        [onMessageUpdated]
    );

    // ========================================
    // DELETE MESSAGE
    // ========================================
    const deleteMessage = useCallback(
        async (message: Message, onRollback: () => void): Promise<boolean> => {
            return new Promise((resolve) => {
                Alert.alert(
                    "Supprimer ce message ?",
                    "Cette action est irréversible.",
                    [
                        {
                            text: "Annuler",
                            style: "cancel",
                            onPress: () => resolve(false),
                        },
                        {
                            text: "Supprimer",
                            style: "destructive",
                            onPress: async () => {
                                try {
                                    await api.delete(`/messages/${message.id}`);
                                    Haptics.notificationAsync(
                                        Haptics.NotificationFeedbackType.Success
                                    );
                                    resolve(true);
                                } catch (e) {
                                    console.error("[useChatActions] Delete error:", e);
                                    onRollback();
                                    Alert.alert("Erreur", "Échec de la suppression");
                                    resolve(false);
                                }
                            },
                        },
                    ]
                );
            });
        },
        []
    );

    // ========================================
    // ADD REACTION
    // ========================================
    const addReaction = useCallback(
        async (messageId: string, emoji: string): Promise<MessageReaction | null> => {
            try {
                const res = await api.post(`/messages/${messageId}/reactions`, {
                    emoji,
                });
                return res.data.reaction;
            } catch (error) {
                console.error("[useChatActions] Add reaction error:", error);
                return null;
            }
        },
        []
    );

    // ========================================
    // REMOVE REACTION
    // ========================================
    const removeReaction = useCallback(
        async (messageId: string): Promise<boolean> => {
            try {
                await api.delete(`/messages/${messageId}/reactions`);
                return true;
            } catch (error) {
                console.error("[useChatActions] Remove reaction error:", error);
                return false;
            }
        },
        []
    );

    return {
        sending: sendingRef.current,
        sendTextMessage,
        sendImageMessages,
        sendAudioMessage,
        editMessage,
        deleteMessage,
        addReaction,
        removeReaction,
        markConversationRead,
    };
}
