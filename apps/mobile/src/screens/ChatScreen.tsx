import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Platform,
    Image,
    Keyboard,
    Clipboard,
    Alert,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
    StatusBar,
    InteractionManager,
} from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { resolveImageUrl, api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { isSameDay } from "date-fns";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecording } from "../hooks/useAudioRecording";
import ImageView from "react-native-image-viewing";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { useAnimatedStyle } from "react-native-reanimated";
import {
    KeyboardStickyView,
    useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";

// Chat components
import {
    ChatMessageItem,
    ChatReplyBanner,
    ChatContextMenu,
    ChatDaySeparator,
    ChatInputBar,
    ChatHeader,
    ChatMessageList,
    Message,
    MessageReaction,
    ListItem,
} from "../components/chat";

// Chat hooks
import {
    useChatMessages,
    useChatInput,
    useChatActions,
    useChatOptimistic,
    useChatSocket,
} from "../hooks/chat";

export default function ChatScreen({ route, navigation }: any) {
    const { user, fetchUnreadCount } = useAuth();
    const { otherUser, conversationStatus: initialStatus, isRequest: initialIsRequest, isInitiator } = route.params;

    // Message request state (NORMAL, REQUEST, or REJECTED)
    const [conversationStatus, setConversationStatus] = useState<'NORMAL' | 'REQUEST' | 'REJECTED'>(initialStatus || 'NORMAL');
    const [isAccepting, setIsAccepting] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    // Derived states for UI
    const isRequest = conversationStatus === 'REQUEST';
    const isRejected = conversationStatus === 'REJECTED';
    const canSendMessage = conversationStatus === 'NORMAL' || (isRequest && isInitiator);

    // ========================================
    // HOOKS INITIALIZATION
    // ========================================

    // Messages hook
    const {
        messages,
        isLoadingInitial: loading,
        isLoadingMore: fetchingMore,
        conversationId,
        fetchMessages,
        loadMore: loadMoreMessages,
        refresh,
        syncMissedMessages,
        upsertMessage,
        updateMessage,
        markMessageEdited,
        markMessageDeleted,
        setMessages,
    } = useChatMessages({
        otherUserId: otherUser.id,
    });

    // Input hook
    const inputRef = useRef<TextInput | null>(null);
    const {
        inputText,
        setInputText,
        replyingTo,
        startReply,
        cancelReply,
        editingMessage,
        startEdit,
        cancelEdit,
        clearInput,
    } = useChatInput({ inputRef });

    // Actions hook (with throttled markRead)
    const {
        sendTextMessage,
        sendImageMessages,
        sendAudioMessage,
        editMessage,
        deleteMessage,
        addReaction,
        removeReaction,
        markConversationRead,
    } = useChatActions({
        otherUserId: otherUser.id,
        userId: user?.id || "",
        conversationId,
        fetchUnreadCount,
        onMessageUpdated: updateMessage,
        // Handle lazy conversation creation on first message
        onConversationCreated: (newConvoId, newStatus, newIsInitiator) => {
            console.log('[ChatScreen] Conversation created:', { newConvoId, newStatus, newIsInitiator });
            setConversationStatus(newStatus);
        },
    });

    // Optimistic updates hook
    const {
        createOptimisticTextMessage,
        createOptimisticAudioMessage,
        reconcileOptimistic,
        markOptimisticError,
    } = useChatOptimistic({
        userId: user?.id || "",
        otherUsername: otherUser.username,
    });

    // Socket hook
    useChatSocket({
        userId: user?.id || "",
        otherUserId: otherUser.id,
        conversationId,
        onNewMessage: (msg) => {
            // Check if it's potentially replacing an optimistic message
            if (msg.senderId === user?.id) {
                // Remove any 'sending' optimistic messages for own messages
                setMessages((prev) => {
                    if (prev.some((m) => m.id === msg.id)) return prev;
                    const filtered = prev.filter((m) => m.status !== "sending");
                    return [{ ...msg, status: "sent" }, ...filtered];
                });
            } else {
                // Other user's message
                upsertMessage(msg);
            }
        },
        onMessageEdited: markMessageEdited,
        onMessageDeleted: markMessageDeleted,
        onMessagesRead: () => {
            // Update our sent messages to show as read
            setMessages((prev) =>
                prev.map((m) =>
                    m.senderId === user?.id ? { ...m, read: true, status: "read" } : m
                )
            );
        },
        onSyncMissedMessages: syncMissedMessages,
        markAsRead: markConversationRead,
    });

    // ========================================
    // LOCAL STATE
    // ========================================
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [sending, setSending] = useState(false);

    // Scroll state
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [newMessageCount, setNewMessageCount] = useState(0);

    // Context menu state
    const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    // Audio recording
    const recording = useAudioRecording();

    // Image viewer
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Refs
    const flatListRef = useRef<FlatList | null>(null);

    // ========================================
    // EFFECTS
    // ========================================

    // Initial fetch + mark as read
    useEffect(() => {
        fetchMessages().then(() => {
            if (conversationId) {
                markConversationRead();
            }
        });
    }, [fetchMessages]);

    // Mark as read when conversationId becomes available
    useEffect(() => {
        if (conversationId) {
            markConversationRead();
        }
    }, [conversationId, markConversationRead]);

    // Auto-scroll when keyboard appears
    useEffect(() => {
        const keyboardShowListener = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => {
                requestAnimationFrame(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                });
            }
        );

        return () => {
            keyboardShowListener.remove();
        };
    }, []);

    // Auto-scroll on new messages (from me or when at bottom)
    useEffect(() => {
        if (messages.length > 0) {
            const latest = messages[0];
            if (latest.senderId === user?.id || isAtBottom) {
                requestAnimationFrame(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                });
            }
        }
    }, [messages, user?.id, isAtBottom]);

    // ========================================
    // LIST DATA WITH DAY SEPARATORS
    // ========================================
    const listData = useMemo((): ListItem[] => {
        if (messages.length === 0) return [];

        const result: ListItem[] = [];

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const msgDate = new Date(msg.createdAt);

            result.push({ type: "message", data: msg });

            const nextMsg = messages[i + 1];
            if (nextMsg) {
                const nextDate = new Date(nextMsg.createdAt);
                if (!isSameDay(msgDate, nextDate)) {
                    result.push({
                        type: "separator",
                        date: msgDate,
                        key: `sep-${msg.id}`,
                    });
                }
            } else {
                result.push({
                    type: "separator",
                    date: msgDate,
                    key: `sep-${msg.id}`,
                });
            }
        }

        return result;
    }, [messages]);

    // Image viewer data
    const viewerImages = useMemo(
        () =>
            messages
                .filter((m) => m.type === "IMAGE" && m.mediaUrl)
                .map((m) => ({ uri: resolveImageUrl(m.mediaUrl) || "" })),
        [messages]
    );

    // ========================================
    // HANDLERS
    // ========================================

    const formatTime = useCallback((dateStr: string) => {
        const date = new Date(dateStr);
        return format(date, "HH:mm", { locale: fr });
    }, []);

    // Scroll handlers
    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            const atBottom = offsetY < 50;
            setIsAtBottom(atBottom);
            if (atBottom) {
                setNewMessageCount(0);
            }
        },
        []
    );

    const scrollToBottom = useCallback(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        setNewMessageCount(0);
    }, []);

    const scrollToMessage = useCallback(
        (messageId: string) => {
            const index = listData.findIndex(
                (item) => item.type === "message" && item.data.id === messageId
            );
            if (index !== -1 && flatListRef.current) {
                flatListRef.current.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.5,
                });
            }
        },
        [listData]
    );

    // Send message (or save edit)
    const handleSendMessage = useCallback(async () => {
        // If editing, save the edit
        if (editingMessage) {
            if (!inputText.trim()) return;
            const success = await editMessage(editingMessage.id, inputText);
            if (success) {
                cancelEdit();
            }
            return;
        }

        if (!inputText.trim() && selectedImages.length === 0) return;

        const content = inputText.trim();
        const pendingImages = [...selectedImages];
        const replyToId = replyingTo?.id;

        // Clear input immediately
        setInputText("");
        setSelectedImages([]);
        cancelReply();
        Keyboard.dismiss();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            setSending(true);

            if (pendingImages.length === 0) {
                // Text only - add optimistic message
                const optimisticMsg = createOptimisticTextMessage(content, replyingTo);
                setMessages((prev) => [optimisticMsg, ...prev]);

                // Auto-scroll
                requestAnimationFrame(() => {
                    InteractionManager.runAfterInteractions(() => {
                        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                    });
                });

                await sendTextMessage(content, replyToId);
            } else {
                // Images
                await sendImageMessages(pendingImages, content, replyToId);
            }
        } catch (error) {
            console.error("[ChatScreen] Send error:", error);
            // Mark optimistic as error
            setMessages((prev) =>
                prev.map((m) =>
                    m.status === "sending" ? { ...m, status: "error" } : m
                )
            );
        } finally {
            setSending(false);
        }
    }, [
        editingMessage,
        inputText,
        selectedImages,
        replyingTo,
        setInputText,
        cancelReply,
        cancelEdit,
        editMessage,
        createOptimisticTextMessage,
        setMessages,
        sendTextMessage,
        sendImageMessages,
    ]);

    // Pick image
    const pickImage = useCallback(async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: 5,
        });

        if (!result.canceled) {
            setSelectedImages((prev) => [
                ...prev,
                ...result.assets.map((a) => a.uri),
            ]);
        }
    }, []);

    const removeImage = useCallback((index: number) => {
        setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // Audio recording
    const startRecording = useCallback(async () => {
        await recording.startRecording();
    }, [recording]);

    const cancelRecording = useCallback(async () => {
        await recording.cancelRecording();
    }, [recording]);

    const lockRecording = useCallback(async () => {
        await recording.lockRecording();
    }, [recording]);

    const stopRecording = useCallback(async () => {
        const result = await recording.stopRecording();
        if (!result) return;

        const { uri, durationMs } = result;

        const msg = await sendAudioMessage(uri, durationMs);
        if (msg) {
            await recording.markSent(msg.id);

            requestAnimationFrame(() => {
                InteractionManager.runAfterInteractions(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                });
            });
        }
    }, [recording, sendAudioMessage]);

    // Save image
    const saveImage = useCallback(async (uri: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permission refusée");
                return;
            }
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert("Succès", "Image enregistrée ! 📸");
        } catch (error) {
            Alert.alert("Erreur", "Impossible d'enregistrer l'image");
        }
    }, []);

    // Reply handler
    const handleReply = useCallback(
        (message: Message) => {
            startReply(message);
        },
        [startReply]
    );

    // Long press handler
    const handleLongPress = useCallback(
        (
            message: Message,
            position: { x: number; y: number; width: number; height: number }
        ) => {
            setContextMenuMessage(message);
            setContextMenuPosition(position);
        },
        []
    );

    // Context menu actions
    const handleSelectReaction = useCallback(
        async (emoji: string) => {
            if (!contextMenuMessage) return;

            const myReaction = contextMenuMessage.reactions?.find(
                (r) => r.userId === user?.id
            );

            if (myReaction?.emoji === emoji) {
                // Remove reaction
                await removeReaction(contextMenuMessage.id);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === contextMenuMessage.id
                            ? {
                                ...m,
                                reactions: m.reactions?.filter(
                                    (r) => r.userId !== user?.id
                                ),
                            }
                            : m
                    )
                );
            } else {
                // Add reaction
                const newReaction = await addReaction(contextMenuMessage.id, emoji);
                if (newReaction) {
                    setMessages((prev) =>
                        prev.map((m) => {
                            if (m.id !== contextMenuMessage.id) return m;
                            const existingReactions =
                                m.reactions?.filter((r) => r.userId !== user?.id) || [];
                            return {
                                ...m,
                                reactions: [...existingReactions, newReaction],
                            };
                        })
                    );
                }
            }
        },
        [contextMenuMessage, user?.id, addReaction, removeReaction, setMessages]
    );

    const handleCopy = useCallback(() => {
        if (contextMenuMessage?.content) {
            Clipboard.setString(contextMenuMessage.content);
        }
    }, [contextMenuMessage]);

    const handleContextReply = useCallback(() => {
        if (contextMenuMessage) {
            handleReply(contextMenuMessage);
        }
    }, [contextMenuMessage, handleReply]);

    const handleDelete = useCallback(async () => {
        if (!contextMenuMessage) return;

        const originalContent = contextMenuMessage.content;

        // Optimistic delete
        markMessageDeleted(contextMenuMessage.id);

        const success = await deleteMessage(contextMenuMessage, () => {
            // Rollback
            updateMessage(contextMenuMessage.id, {
                deletedAt: null,
                content: originalContent,
            });
        });
    }, [contextMenuMessage, markMessageDeleted, deleteMessage, updateMessage]);

    const handleEdit = useCallback(() => {
        if (contextMenuMessage && contextMenuMessage.type === "TEXT") {
            startEdit(contextMenuMessage);
        }
    }, [contextMenuMessage, startEdit]);

    // Image press handler
    const handleImagePress = useCallback(
        (url: string) => {
            const finalUrl = resolveImageUrl(url) || "";
            const index = viewerImages.findIndex((img) => img.uri === finalUrl);
            setCurrentImageIndex(index !== -1 ? index : 0);
            setIsViewerVisible(true);
        },
        [viewerImages]
    );

    // ========================================
    // RENDER ITEM
    // ========================================

    const { lastSentMessageId, mostRecentMessageId } = useMemo(() => {
        const lastSent = messages.find((m) => m.senderId === user?.id);
        const mostRecent = messages.length > 0 ? messages[0].id : null;
        return {
            lastSentMessageId: lastSent?.id,
            mostRecentMessageId: mostRecent,
        };
    }, [messages, user?.id]);

    const renderItem = useCallback(
        ({ item }: { item: ListItem }) => {
            if (item.type === "separator") {
                return <ChatDaySeparator date={item.date} />;
            }

            const isMe = item.data.senderId === user?.id;
            const isLastSentMessage = isMe && item.data.id === lastSentMessageId;
            const isMostRecentMessage = item.data.id === mostRecentMessageId;

            return (
                <ChatMessageItem
                    message={item.data}
                    isMe={isMe}
                    isLastSentMessage={isLastSentMessage}
                    isMostRecentMessage={isMostRecentMessage}
                    formatTime={formatTime}
                    onImagePress={handleImagePress}
                    onReply={handleReply}
                    onLongPress={handleLongPress}
                    onReplyTap={scrollToMessage}
                    currentUserId={user?.id}
                />
            );
        },
        [
            user?.id,
            lastSentMessageId,
            mostRecentMessageId,
            formatTime,
            handleImagePress,
            handleReply,
            handleLongPress,
            scrollToMessage,
        ]
    );

    const keyExtractor = useCallback((item: ListItem) => {
        return item.type === "separator" ? item.key : item.data.id;
    }, []);

    // ========================================
    // KEYBOARD ANIMATION
    // ========================================
    const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

    const messagesContainerStyle = useAnimatedStyle(() => ({
        paddingBottom: Math.max(0, -keyboardHeight.value),
    }));

    // ========================================
    // RENDER
    // ========================================
    return (
        <>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <SafeAreaView style={styles.container} edges={["top"]}>
                {/* Header */}
                <ChatHeader
                    otherUser={otherUser}
                    conversationId={conversationId}
                    onBack={() => navigation.goBack()}
                    onUserPress={() =>
                        navigation.navigate("UserProfile", { userId: otherUser.id })
                    }
                    onMenuPress={() =>
                        navigation.navigate("ConversationSettings", {
                            otherUser,
                            conversationId,
                        })
                    }
                />

                {/* Message Request Banner */}
                {isRequest && (
                    <View style={styles.requestBanner}>
                        {isInitiator ? (
                            <View style={styles.requestBannerContent}>
                                <Ionicons name="time" size={18} color="#FFA500" />
                                <Text style={styles.requestBannerText}>
                                    En attente — {otherUser.displayName || otherUser.username} doit accepter votre demande.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.requestBannerContent}>
                                <Ionicons name="mail" size={18} color="#FFA07A" />
                                <Text style={styles.requestBannerText}>
                                    Demande de message
                                </Text>
                                <View style={styles.requestButtonsRow}>
                                    <TouchableOpacity
                                        style={[styles.acceptButton, styles.rejectButton]}
                                        onPress={async () => {
                                            setIsRejecting(true);
                                            try {
                                                await api.delete(`/conversations/${route.params.conversationId}/request`);
                                                setConversationStatus('REJECTED');
                                                navigation.goBack();
                                            } catch (e) {
                                                console.error('Failed to reject request:', e);
                                                Alert.alert('Erreur', 'Impossible de refuser la demande');
                                            } finally {
                                                setIsRejecting(false);
                                            }
                                        }}
                                        disabled={isRejecting || isAccepting}
                                    >
                                        <Text style={styles.rejectButtonText}>
                                            {isRejecting ? '...' : 'Refuser'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.acceptButton}
                                        onPress={async () => {
                                            setIsAccepting(true);
                                            try {
                                                await api.post(`/conversations/${route.params.conversationId}/accept`);
                                                setConversationStatus('NORMAL');
                                            } catch (e) {
                                                console.error('Failed to accept request:', e);
                                                Alert.alert('Erreur', 'Impossible d\'accepter la demande');
                                            } finally {
                                                setIsAccepting(false);
                                            }
                                        }}
                                        disabled={isAccepting || isRejecting}
                                    >
                                        <Text style={styles.acceptButtonText}>
                                            {isAccepting ? '...' : 'Accepter'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* REJECTED Banner (sender only) */}
                {isRejected && isInitiator && (
                    <View style={[styles.requestBanner, styles.rejectedBanner]}>
                        <View style={styles.requestBannerContent}>
                            <Ionicons name="close-circle" size={18} color="#FF3B30" />
                            <Text style={[styles.requestBannerText, styles.rejectedText]}>
                                Demande refusée — vous ne pouvez plus envoyer de messages.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Messages List */}
                <ChatMessageList
                    listData={listData}
                    loading={loading}
                    fetchingMore={fetchingMore}
                    isAtBottom={isAtBottom}
                    newMessageCount={newMessageCount}
                    isRecordingActive={recording.isActive}
                    flatListRef={flatListRef}
                    containerStyle={messagesContainerStyle}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    onScroll={handleScroll}
                    onLoadMore={loadMoreMessages}
                    onScrollToBottom={scrollToBottom}
                />

                {/* Input area */}
                <KeyboardStickyView
                    style={styles.inputAreaContainer}
                    offset={{ closed: 0, opened: 0 }}
                >
                    {/* Image previews */}
                    {selectedImages.length > 0 && (
                        <View style={styles.previewContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {selectedImages.map((uri, index) => (
                                    <View key={index} style={styles.previewWrapper}>
                                        <Image
                                            source={{ uri }}
                                            style={styles.previewImage}
                                        />
                                        <TouchableOpacity
                                            style={styles.removePreviewButton}
                                            onPress={() => removeImage(index)}
                                        >
                                            <Ionicons name="close" size={14} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Reply banner */}
                    {replyingTo && (
                        <ChatReplyBanner
                            message={replyingTo}
                            senderName={
                                replyingTo.senderId === user?.id
                                    ? "Vous"
                                    : otherUser.username
                            }
                            onClose={cancelReply}
                        />
                    )}

                    {/* Editing banner */}
                    {editingMessage && (
                        <View style={styles.editingBanner}>
                            <View style={styles.editingBannerContent}>
                                <Ionicons name="pencil" size={16} color="#FFA07A" />
                                <Text style={styles.editingBannerText}>
                                    Modification du message
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={cancelEdit}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8E8E93" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input bar */}
                    <ChatInputBar
                        value={inputText}
                        onChangeText={setInputText}
                        onSend={handleSendMessage}
                        onAttach={pickImage}
                        onStartRecording={startRecording}
                        onStopRecording={stopRecording}
                        onCancelRecording={cancelRecording}
                        onLockRecording={lockRecording}
                        sending={sending}
                        hasContent={!!inputText.trim() || selectedImages.length > 0}
                        inputRef={inputRef}
                    />
                </KeyboardStickyView>

                {/* Image viewer */}
                <ImageView
                    images={viewerImages}
                    imageIndex={currentImageIndex}
                    visible={isViewerVisible}
                    onRequestClose={() => setIsViewerVisible(false)}
                    FooterComponent={({ imageIndex }) => (
                        <View style={styles.viewerFooter}>
                            <TouchableOpacity
                                style={styles.saveImageButton}
                                onPress={() => saveImage(viewerImages[imageIndex].uri)}
                            >
                                <Ionicons name="download-outline" size={22} color="#fff" />
                                <Text style={styles.saveImageText}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />

                {/* Context menu */}
                <ChatContextMenu
                    visible={!!contextMenuMessage}
                    messagePosition={contextMenuPosition}
                    isMyMessage={contextMenuMessage?.senderId === user?.id}
                    hasText={!!contextMenuMessage?.content}
                    onClose={() => {
                        setContextMenuMessage(null);
                        setContextMenuPosition(null);
                    }}
                    onCopy={handleCopy}
                    onReply={handleContextReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    selectedEmoji={
                        contextMenuMessage?.reactions?.find(
                            (r) => r.userId === user?.id
                        )?.emoji || null
                    }
                    onSelectEmoji={handleSelectReaction}
                />
            </SafeAreaView>
        </>
    );
}

// ========================================
// STYLES (reduced - most moved to components)
// ========================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    inputAreaContainer: {
        backgroundColor: "#FFFFFF",
    },
    previewContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#F8F8F8",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(0, 0, 0, 0.1)",
    },
    previewWrapper: {
        marginRight: 10,
        position: "relative",
    },
    previewImage: {
        width: 70,
        height: 70,
        borderRadius: 12,
    },
    removePreviewButton: {
        position: "absolute",
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    editingBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(255, 160, 122, 0.1)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(255, 160, 122, 0.3)",
    },
    editingBannerContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    editingBannerText: {
        fontSize: 14,
        color: "#FFA07A",
        fontWeight: "500",
    },
    viewerFooter: {
        padding: 20,
        alignItems: "center",
    },
    saveImageButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
    },
    saveImageText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
        marginLeft: 8,
    },
    // Message Request Banner
    requestBanner: {
        backgroundColor: "rgba(255, 160, 122, 0.1)",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255, 160, 122, 0.3)",
    },
    requestBannerContent: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
    },
    requestBannerText: {
        flex: 1,
        fontSize: 13,
        color: "#636366",
        lineHeight: 18,
    },
    acceptButton: {
        backgroundColor: "#FFA07A",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    acceptButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
    // Reject Button & Row
    requestButtonsRow: {
        flexDirection: "row",
        gap: 8,
    },
    rejectButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "#8E8E93",
    },
    rejectButtonText: {
        color: "#8E8E93",
        fontSize: 14,
        fontWeight: "600",
    },
    // REJECTED Banner
    rejectedBanner: {
        backgroundColor: "rgba(255, 59, 48, 0.1)",
        borderBottomColor: "rgba(255, 59, 48, 0.3)",
    },
    rejectedText: {
        color: "#FF3B30",
    },
});
