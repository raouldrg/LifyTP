/**
 * getConversationPreview - Centralized logic for conversation preview text
 * 
 * Handles all preview cases in priority order:
 * 1. Typing indicator (highest priority)
 * 2. Deleted message
 * 3. Audio message
 * 4. Image message
 * 5. Text message
 * 
 * Each case prefixed with "Vous : " if sent by current user
 */

export interface PreviewMessage {
    id: string;
    content?: string | null;
    type: 'TEXT' | 'IMAGE' | 'AUDIO';
    senderId: string;
    deletedAt?: string | null;
    createdAt: string;
}

export interface ConversationPreviewOptions {
    lastMessage: PreviewMessage | null | undefined;
    currentUserId: string;
    otherUsername?: string;
    isTyping?: boolean;
}

export interface ConversationPreviewResult {
    text: string;
    isTyping: boolean;
    isDeleted: boolean;
    isMedia: boolean;
}

/**
 * Get conversation preview text with priority handling
 * 
 * Priority order:
 * 1. isTyping → "✍️ Écrit…"
 * 2. deletedAt → "🚫 Message supprimé"
 * 3. AUDIO → "🎤 Message vocal"
 * 4. IMAGE → "📷 Photo"
 * 5. TEXT → content
 * 6. No message → "Nouvelle conversation"
 */
export function getConversationPreview({
    lastMessage,
    currentUserId,
    otherUsername = 'Utilisateur',
    isTyping = false,
}: ConversationPreviewOptions): ConversationPreviewResult {
    // Case 1: Typing indicator (highest priority)
    if (isTyping) {
        return {
            text: `✍️ ${otherUsername} écrit…`,
            isTyping: true,
            isDeleted: false,
            isMedia: false,
        };
    }

    // Case 6: No message
    if (!lastMessage) {
        return {
            text: "Nouvelle conversation",
            isTyping: false,
            isDeleted: false,
            isMedia: false,
        };
    }

    const isMe = lastMessage.senderId === currentUserId;
    const prefix = isMe ? "Vous : " : "";

    // Case 2: Deleted message
    if (lastMessage.deletedAt) {
        return {
            text: `${prefix}🚫 Message supprimé`,
            isTyping: false,
            isDeleted: true,
            isMedia: false,
        };
    }

    // Case 3: Audio message
    if (lastMessage.type === 'AUDIO') {
        return {
            text: `${prefix}🎤 Message vocal`,
            isTyping: false,
            isDeleted: false,
            isMedia: true,
        };
    }

    // Case 4: Image message
    if (lastMessage.type === 'IMAGE') {
        const imageText = lastMessage.content
            ? `📷 ${lastMessage.content}`
            : "📷 Photo";
        return {
            text: `${prefix}${imageText}`,
            isTyping: false,
            isDeleted: false,
            isMedia: true,
        };
    }

    // Case 5: Text message
    const content = lastMessage.content || "";
    return {
        text: `${prefix}${content}`,
        isTyping: false,
        isDeleted: false,
        isMedia: false,
    };
}
