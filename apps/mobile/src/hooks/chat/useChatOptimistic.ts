import { useCallback, useRef } from "react";
import { Message } from "../../components/chat";

interface UseChatOptimisticOptions {
    userId: string;
    otherUsername: string;
}

interface OptimisticMessage extends Message {
    isOptimistic: true;
}

interface UseChatOptimisticReturn {
    createOptimisticTextMessage: (
        content: string,
        replyTo?: Message | null
    ) => OptimisticMessage;
    createOptimisticImageMessage: (
        imageUri: string,
        content?: string,
        replyTo?: Message | null
    ) => OptimisticMessage;
    createOptimisticAudioMessage: (
        durationMs: number
    ) => OptimisticMessage;
    reconcileOptimistic: (
        tempId: string,
        realMessage: Message,
        messages: Message[]
    ) => Message[];
    removeOptimistic: (
        tempId: string,
        messages: Message[]
    ) => Message[];
    markOptimisticError: (
        tempId: string,
        messages: Message[]
    ) => Message[];
    generateTempId: () => string;
}

/**
 * useChatOptimistic - Hook for optimistic updates
 * 
 * Handles:
 * - Creating optimistic messages with tempId
 * - Reconciling optimistic messages with real server responses
 * - Removing failed optimistic messages
 * - Anti-duplicate key generation
 */
export function useChatOptimistic({
    userId,
    otherUsername,
}: UseChatOptimisticOptions): UseChatOptimisticReturn {
    // Counter to ensure unique tempIds even within same millisecond
    const counterRef = useRef(0);

    /**
     * Generate a unique temporary ID
     */
    const generateTempId = useCallback(() => {
        counterRef.current += 1;
        return `temp-${Date.now()}-${counterRef.current}`;
    }, []);

    /**
     * Create an optimistic text message
     */
    const createOptimisticTextMessage = useCallback(
        (content: string, replyTo?: Message | null): OptimisticMessage => {
            const tempId = generateTempId();
            return {
                id: tempId,
                tempId,
                senderId: userId,
                content,
                type: "TEXT",
                createdAt: new Date().toISOString(),
                status: "sending",
                isOptimistic: true,
                replyTo: replyTo
                    ? {
                        id: replyTo.id,
                        content: replyTo.content,
                        type: replyTo.type,
                        sender: {
                            username: otherUsername,
                            id: replyTo.senderId,
                        },
                    }
                    : undefined,
            };
        },
        [userId, otherUsername, generateTempId]
    );

    /**
     * Create an optimistic image message
     */
    const createOptimisticImageMessage = useCallback(
        (
            imageUri: string,
            content?: string,
            replyTo?: Message | null
        ): OptimisticMessage => {
            const tempId = generateTempId();
            return {
                id: tempId,
                tempId,
                senderId: userId,
                content,
                type: "IMAGE",
                mediaUrl: imageUri, // Local URI for preview
                createdAt: new Date().toISOString(),
                status: "sending",
                isOptimistic: true,
                replyTo: replyTo
                    ? {
                        id: replyTo.id,
                        content: replyTo.content,
                        type: replyTo.type,
                        sender: {
                            username: otherUsername,
                            id: replyTo.senderId,
                        },
                    }
                    : undefined,
            };
        },
        [userId, otherUsername, generateTempId]
    );

    /**
     * Create an optimistic audio message
     */
    const createOptimisticAudioMessage = useCallback(
        (durationMs: number): OptimisticMessage => {
            const tempId = generateTempId();
            return {
                id: tempId,
                tempId,
                senderId: userId,
                type: "AUDIO",
                duration: durationMs,
                createdAt: new Date().toISOString(),
                status: "sending",
                isOptimistic: true,
            };
        },
        [userId, generateTempId]
    );

    /**
     * Reconcile optimistic message with real server response
     * Removes the temp message and ensures real message is present
     */
    const reconcileOptimistic = useCallback(
        (tempId: string, realMessage: Message, messages: Message[]): Message[] => {
            // Remove optimistic and check if real already exists
            const hasReal = messages.some((m) => m.id === realMessage.id);

            if (hasReal) {
                // Just remove the optimistic
                return messages.filter((m) => m.id !== tempId);
            }

            // Replace optimistic with real
            return messages.map((m) =>
                m.id === tempId ? { ...realMessage, status: "sent" } : m
            );
        },
        []
    );

    /**
     * Remove an optimistic message (on failure)
     */
    const removeOptimistic = useCallback(
        (tempId: string, messages: Message[]): Message[] => {
            return messages.filter((m) => m.id !== tempId);
        },
        []
    );

    /**
     * Mark an optimistic message as error
     */
    const markOptimisticError = useCallback(
        (tempId: string, messages: Message[]): Message[] => {
            return messages.map((m) =>
                m.id === tempId ? { ...m, status: "error" } : m
            );
        },
        []
    );

    return {
        createOptimisticTextMessage,
        createOptimisticImageMessage,
        createOptimisticAudioMessage,
        reconcileOptimistic,
        removeOptimistic,
        markOptimisticError,
        generateTempId,
    };
}
