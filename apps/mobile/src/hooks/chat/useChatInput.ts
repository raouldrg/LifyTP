import { useState, useCallback, RefObject } from "react";
import { TextInput } from "react-native";
import { Message } from "../../components/chat";

interface UseChatInputOptions {
    inputRef?: RefObject<TextInput | null>;
}

interface UseChatInputReturn {
    // Text state
    inputText: string;
    setInputText: (text: string) => void;

    // Reply state
    replyingTo: Message | null;
    startReply: (message: Message) => void;
    cancelReply: () => void;

    // Edit state
    editingMessage: Message | null;
    startEdit: (message: Message) => void;
    cancelEdit: () => void;

    // Combined helpers
    clearInput: () => void;
    isEditing: boolean;
    isReplying: boolean;
}

/**
 * useChatInput - Hook for managing chat input state
 * 
 * Handles:
 * - Text input state
 * - Reply mode (with message context)
 * - Edit mode (with original message)
 * - Focus management via inputRef
 * 
 * No network calls - purely local state.
 */
export function useChatInput({
    inputRef,
}: UseChatInputOptions = {}): UseChatInputReturn {
    const [inputText, setInputText] = useState("");
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);

    /**
     * Start replying to a message
     */
    const startReply = useCallback(
        (message: Message) => {
            // Cancel any edit in progress
            setEditingMessage(null);
            setReplyingTo(message);
            inputRef?.current?.focus();
        },
        [inputRef]
    );

    /**
     * Cancel reply mode
     */
    const cancelReply = useCallback(() => {
        setReplyingTo(null);
    }, []);

    /**
     * Start editing a message
     */
    const startEdit = useCallback(
        (message: Message) => {
            if (message.type !== "TEXT") return; // Can only edit text messages

            // Cancel any reply in progress
            setReplyingTo(null);
            setEditingMessage(message);
            setInputText(message.content || "");
            inputRef?.current?.focus();
        },
        [inputRef]
    );

    /**
     * Cancel edit mode
     */
    const cancelEdit = useCallback(() => {
        setEditingMessage(null);
        setInputText("");
    }, []);

    /**
     * Clear all input state
     */
    const clearInput = useCallback(() => {
        setInputText("");
        setReplyingTo(null);
        setEditingMessage(null);
    }, []);

    return {
        inputText,
        setInputText,
        replyingTo,
        startReply,
        cancelReply,
        editingMessage,
        startEdit,
        cancelEdit,
        clearInput,
        isEditing: editingMessage !== null,
        isReplying: replyingTo !== null,
    };
}
