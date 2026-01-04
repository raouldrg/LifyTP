import { useState, useCallback, useRef } from "react";
import { api } from "../../services/api";
import { Message } from "../../components/chat";

interface UseChatMessagesOptions {
    otherUserId: string;
    onConversationId?: (conversationId: string) => void;
}

interface UseChatMessagesReturn {
    messages: Message[];
    isLoadingInitial: boolean;
    isLoadingMore: boolean;
    isSyncing: boolean;
    conversationId: string | null;
    fetchMessages: () => Promise<void>;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
    syncMissedMessages: () => Promise<void>;
    getLastMessageAt: () => string | null;
    upsertMessage: (message: Message) => void;
    upsertMessages: (newMessages: Message[]) => void;
    updateMessage: (messageId: string, updates: Partial<Message>) => void;
    removeMessage: (messageId: string) => void;
    markMessageEdited: (messageId: string, content: string, editedAt: string) => void;
    markMessageDeleted: (messageId: string) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/**
 * useChatMessages - Hook for managing chat messages state
 * 
 * Handles:
 * - Initial fetch of messages (GET /messages/with/:id)
 * - Pagination via cursor
 * - Message state updates (upsert, update, remove)
 * - Anti-duplicate protection using Set
 * 
 * IMPORTANT: This hook does NOT call /messages/read or /messages/unread
 * to prevent spam loops. Those are handled in useChatActions.
 */
export function useChatMessages({
    otherUserId,
    onConversationId,
}: UseChatMessagesOptions): UseChatMessagesReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    // Track seen message IDs to prevent duplicates
    const seenIdsRef = useRef<Set<string>>(new Set());

    /**
     * Fetch initial messages
     */
    const fetchMessages = useCallback(async () => {
        try {
            setIsLoadingInitial(true);
            const res = await api.get(`/messages/with/${otherUserId}`);

            // Determine initial status based on read/delivered fields
            const messagesWithStatus: Message[] = res.data.messages.map((m: Message) => ({
                ...m,
                status: m.read ? "read" : m.delivered ? "delivered" : "sent",
            }));

            // Track IDs
            seenIdsRef.current.clear();
            messagesWithStatus.forEach((m: Message) => seenIdsRef.current.add(m.id));

            setMessages(messagesWithStatus);
            setNextCursor(res.data.nextCursor);

            if (res.data.conversationId) {
                setConversationId(res.data.conversationId);
                onConversationId?.(res.data.conversationId);
            }
        } catch (error) {
            console.error("[useChatMessages] Fetch error:", error);
        } finally {
            setIsLoadingInitial(false);
        }
    }, [otherUserId, onConversationId]);

    /**
     * Load more messages (pagination)
     */
    const loadMore = useCallback(async () => {
        if (!nextCursor || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const res = await api.get(`/messages/with/${otherUserId}?cursor=${nextCursor}`);
            const newMessages: Message[] = res.data.messages;

            // Filter duplicates and add to seen set
            const uniqueMessages = newMessages.filter((m) => {
                if (seenIdsRef.current.has(m.id)) return false;
                seenIdsRef.current.add(m.id);
                return true;
            });

            setMessages((prev) => [...prev, ...uniqueMessages]);
            setNextCursor(res.data.nextCursor);
        } catch (error) {
            console.error("[useChatMessages] Load more error:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [otherUserId, nextCursor, isLoadingMore]);

    /**
     * Refresh messages (re-fetch from start)
     */
    const refresh = useCallback(async () => {
        await fetchMessages();
    }, [fetchMessages]);

    /**
     * Get the createdAt timestamp of the most recent message
     * Used for sync to determine what messages to fetch
     */
    const getLastMessageAt = useCallback((): string | null => {
        if (messages.length === 0) return null;
        return messages[0].createdAt;
    }, [messages]);
    /**
     * Upsert a single message (add or update if exists)
     * Used by socket handlers for new messages
     */
    const upsertMessage = useCallback((message: Message) => {
        // Check if we've already seen this message
        if (seenIdsRef.current.has(message.id)) {
            // Update existing
            setMessages((prev) =>
                prev.map((m) => (m.id === message.id ? { ...m, ...message } : m))
            );
        } else {
            // Add new (at start for inverted list)
            seenIdsRef.current.add(message.id);
            setMessages((prev) => [message, ...prev]);
        }
    }, []);

    /**
     * Upsert multiple messages
     */
    const upsertMessages = useCallback((newMessages: Message[]) => {
        setMessages((prev) => {
            const updatedMap = new Map(prev.map((m) => [m.id, m]));

            newMessages.forEach((msg) => {
                if (updatedMap.has(msg.id)) {
                    // Update existing
                    updatedMap.set(msg.id, { ...updatedMap.get(msg.id)!, ...msg });
                } else {
                    // Add new
                    seenIdsRef.current.add(msg.id);
                    updatedMap.set(msg.id, msg);
                }
            });

            // Sort by createdAt descending (newest first for inverted list)
            return Array.from(updatedMap.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        });
    }, []);

    /**
     * Sync missed messages (fetch only messages newer than lastMessageAt)
     * Called on socket reconnect and app foreground
     * 
     * IMPORTANT: 
     * - Does NOT trigger if no messages loaded (fetchMessages handles initial load)
     * - Anti-duplicate via upsertMessages + seenIdsRef
     * - No spam: only called on events, not polling
     */
    const syncMissedMessages = useCallback(async () => {
        const lastAt = getLastMessageAt();

        // Don't sync if no messages loaded yet (initial fetch handles this)
        if (!lastAt) {
            console.log("[useChatMessages] No messages to sync from, skipping");
            return;
        }

        // Prevent parallel syncs
        if (isSyncing) {
            console.log("[useChatMessages] Already syncing, skipping");
            return;
        }

        setIsSyncing(true);
        console.log(`[useChatMessages] Syncing messages since ${lastAt}`);

        try {
            const res = await api.get(
                `/messages/with/${otherUserId}?since=${encodeURIComponent(lastAt)}`
            );

            const newMessages: Message[] = res.data.messages || [];

            if (newMessages.length > 0) {
                console.log(`[useChatMessages] Synced ${newMessages.length} missed messages`);

                // Add status to new messages and cast properly
                const messagesWithStatus: Message[] = newMessages.map((m: Message) => ({
                    ...m,
                    status: (m.read ? "read" : m.delivered ? "delivered" : "sent") as Message["status"],
                }));

                // upsertMessages handles deduplication
                upsertMessages(messagesWithStatus);
            } else {
                console.log("[useChatMessages] No missed messages");
            }
        } catch (error) {
            console.error("[useChatMessages] Sync error:", error);
        } finally {
            setIsSyncing(false);
        }
    }, [otherUserId, getLastMessageAt, isSyncing, upsertMessages]);

    /**
     * Update a specific message by ID
     */
    const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
        );
    }, []);

    /**
     * Remove a message by ID
     */
    const removeMessage = useCallback((messageId: string) => {
        seenIdsRef.current.delete(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }, []);

    /**
     * Mark a message as edited
     */
    const markMessageEdited = useCallback(
        (messageId: string, content: string, editedAt: string) => {
            updateMessage(messageId, { content, editedAt });
        },
        [updateMessage]
    );

    /**
     * Mark a message as deleted
     */
    const markMessageDeleted = useCallback(
        (messageId: string) => {
            updateMessage(messageId, {
                deletedAt: new Date().toISOString(),
                content: undefined,
            });
        },
        [updateMessage]
    );

    return {
        messages,
        isLoadingInitial,
        isLoadingMore,
        isSyncing,
        conversationId,
        fetchMessages,
        loadMore,
        refresh,
        syncMissedMessages,
        getLastMessageAt,
        upsertMessage,
        upsertMessages,
        updateMessage,
        removeMessage,
        markMessageEdited,
        markMessageDeleted,
        setMessages,
    };
}
