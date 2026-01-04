import { useEffect, useCallback, useRef } from "react";
import { socket } from "../../services/socket";
import { SocketManager } from "../../services/SocketManager";
import { Message } from "../../components/chat";

interface UseChatSocketOptions {
    userId: string;
    otherUserId: string;
    conversationId: string | null;
    onNewMessage: (message: Message) => void;
    onMessageEdited: (messageId: string, content: string, editedAt: string) => void;
    onMessageDeleted: (messageId: string) => void;
    onMessagesRead: () => void;
    onSyncMissedMessages: () => void;  // Called on reconnect/foreground
    markAsRead: () => void;
}

/**
 * useChatSocket - Hook for socket event listeners
 * 
 * Handles:
 * - message:new - New incoming messages
 * - message:edited - Message edit notifications
 * - message:deleted - Message delete notifications  
 * - message:read - Read receipts
 * - Reconnect sync via SocketManager
 * 
 * IMPORTANT: Properly cleans up all listeners on unmount.
 * Does NOT trigger /messages/unread calls - delegates to callbacks.
 */
export function useChatSocket({
    userId,
    otherUserId,
    conversationId,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onMessagesRead,
    onSyncMissedMessages,
    markAsRead,
}: UseChatSocketOptions): void {
    // Store callbacks in refs to avoid dependency issues
    const callbacksRef = useRef({
        onNewMessage,
        onMessageEdited,
        onMessageDeleted,
        onMessagesRead,
        onSyncMissedMessages,
        markAsRead,
    });

    // Update refs when callbacks change
    useEffect(() => {
        callbacksRef.current = {
            onNewMessage,
            onMessageEdited,
            onMessageDeleted,
            onMessagesRead,
            onSyncMissedMessages,
            markAsRead,
        };
    }, [onNewMessage, onMessageEdited, onMessageDeleted, onMessagesRead, onSyncMissedMessages, markAsRead]);

    useEffect(() => {
        // ========================================
        // NEW MESSAGE HANDLER
        // ========================================
        const handleNewMessage = (msg: any) => {
            // Filter: only messages for this conversation
            const isRelevant =
                (msg.senderId === userId && msg.recipientId === otherUserId) ||
                (msg.senderId === otherUserId && msg.recipientId === userId);

            if (!isRelevant) return;

            // Transform and notify
            const message: Message = {
                ...msg,
                status: "sent",
            };

            callbacksRef.current.onNewMessage(message);

            // If message is from other user, mark conversation as read
            if (msg.senderId === otherUserId) {
                callbacksRef.current.markAsRead();
            }
        };

        // ========================================
        // MESSAGE READ HANDLER
        // ========================================
        const handleMessageRead = (payload: { conversationId: string }) => {
            // We receive this when the OTHER user reads our messages
            // This is for updating read receipts on our sent messages
            callbacksRef.current.onMessagesRead();
        };

        // ========================================
        // MESSAGE EDITED HANDLER
        // ========================================
        const handleMessageEdited = (payload: {
            messageId: string;
            content: string;
            editedAt: string;
        }) => {
            callbacksRef.current.onMessageEdited(
                payload.messageId,
                payload.content,
                payload.editedAt
            );
        };

        // ========================================
        // MESSAGE DELETED HANDLER
        // ========================================
        const handleMessageDeleted = (payload: { messageId: string }) => {
            callbacksRef.current.onMessageDeleted(payload.messageId);
        };

        // ========================================
        // RECONNECT / FOREGROUND SYNC HANDLER
        // ========================================
        const handleSync = () => {
            console.log("[useChatSocket] Socket synced, triggering missed messages sync...");
            callbacksRef.current.onSyncMissedMessages();
        };

        // Subscribe to events
        socket.on("message:new", handleNewMessage);
        socket.on("message:read", handleMessageRead);
        socket.on("message:edited", handleMessageEdited);
        socket.on("message:deleted", handleMessageDeleted);

        // Register for offline sync (reconnection)
        SocketManager.getInstance().addSyncListener(handleSync);

        // Cleanup on unmount
        return () => {
            socket.off("message:new", handleNewMessage);
            socket.off("message:read", handleMessageRead);
            socket.off("message:edited", handleMessageEdited);
            socket.off("message:deleted", handleMessageDeleted);
            SocketManager.getInstance().removeSyncListener(handleSync);
        };
    }, [userId, otherUserId]); // Only stable IDs - no state dependencies!
}
