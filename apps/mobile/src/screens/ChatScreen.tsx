import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, PanResponder, Animated, ScrollView } from "react-native";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, socket } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { uploadFile } from "../lib/api";
import { AudioMessage } from "../components/AudioMessage";
import { Waveform } from "../components/Waveform";
import ImageView from "react-native-image-viewing";
import * as MediaLibrary from 'expo-media-library';
import { Alert } from "react-native";
import { Swipeable } from 'react-native-gesture-handler';

// Separate component to handle Swipeable refs and layout
const MessageItem = React.memo(({ item, user, onReply, onImagePress, onLongPress, highlighted, scrollToMessage, getStatusText }: any) => {
    const isMe = item.senderId === user?.id;
    const swipeableRef = useRef<Swipeable>(null);
    const highlightAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (highlighted) {
            // Reset
            highlightAnim.setValue(1);
            // Sequence: Wait 2s, then Fade out over 1s
            Animated.sequence([
                Animated.delay(2000),
                Animated.timing(highlightAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false // Specific for color
                })
            ]).start();
        } else {
            // If not highlighted (or toggled off), ensure we are at 0
            // But we rarely toggle off manually unless scrolling to another
            // highlightAnim.setValue(0); 
        }
    }, [highlighted]);

    const backgroundColor = highlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            isMe ? theme.colors.primary : "#F0F0F0",
            theme.colors.accent
        ]
    });

    const renderRightActions = (progress: any, dragX: any) => {
        return (
            <View style={{ width: 80, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="reply" size={24} color={theme.colors.text.secondary} />
            </View>
        );
    };

    const renderLeftActions = (progress: any, dragX: any) => {
        // Timestamp reveal logic (Drag Left -> Right side revealed)
        // Actually, typically Timestamp is on the right side of the screen when swiping left.
        // If I drag LEFT, I see content from the RIGHT. So this is renderRightActions.
        // Wait, the user said: "glisser le message vers la gauche... l'heure exacte tout a droite".
        // Dragging LEFT reveals RIGHT actions.
        return (
            <View style={{ justifyContent: 'center', paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 10, color: '#888' }}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    // User requested "glisser à droite" (Drag Right) -> Reply.
    // Drag Right reveals LEFT actions.

    const renderReplyAction = () => (
        <View style={{ width: 60, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
            <Ionicons name="arrow-undo" size={24} color={theme.colors.primary} />
        </View>
    );

    const renderTimestampAction = () => (
        <View style={{ width: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text.secondary }}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
    );


    const renderReplyContext = (reply: any) => {
        if (!reply) return null;
        const isReplyYours = reply.sender.id === user?.id;
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => scrollToMessage(reply.id)}
                style={[styles.replyContextBubble, { backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)' }]}
            >
                <View style={[styles.replyBar, { backgroundColor: isReplyYours ? theme.colors.primary : '#888' }]} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.replySender}>{isReplyYours ? "Vous" : reply.sender.username}</Text>
                    <Text numberOfLines={1} style={styles.replyTextPreview}>
                        {reply.type === 'IMAGE' ? '📷 Photo' : reply.type === 'AUDIO' ? '🎵 Audio' : reply.content}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Swipeable
            ref={swipeableRef}
            renderLeftActions={renderReplyAction} // Drag Right -> Reply
            renderRightActions={renderTimestampAction} // Drag Left -> Timestamp
            onSwipeableLeftOpen={() => {
                onReply(item);
                swipeableRef.current?.close(); // Auto-close
            }}
            overshootLeft={false}
            overshootRight={false}
        >
            <View style={[styles.messageContainer, isMe ? styles.myContainer : styles.theirContainer]}>
                <Animated.View style={[
                    styles.messageBubble,
                    isMe ? styles.myMessage : styles.theirMessage,
                    item.type === 'IMAGE' && { padding: 4 },
                    { backgroundColor } // Animated background
                ]}>
                    {/* Reply Context */}
                    {item.replyTo && renderReplyContext(item.replyTo)}

                    {item.type === 'IMAGE' ? (
                        <View style={{ marginBottom: 4 }}>
                            <TouchableOpacity onPress={() => onImagePress(item.mediaUrl)}>
                                <Image
                                    source={{ uri: item.mediaUrl.startsWith("http") ? item.mediaUrl : `http://localhost:3000${item.mediaUrl}` }}
                                    style={{ width: 220, height: 220, borderRadius: 16, margin: 4 }}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                            {item.content ? (
                                <Text style={[styles.messageText, { marginTop: 4, paddingHorizontal: 8 }, isMe ? styles.myMessageText : styles.theirMessageText]}>
                                    {item.content}
                                </Text>
                            ) : null}
                        </View>
                    ) : item.type === 'AUDIO' ? (
                        <AudioMessage uri={item.mediaUrl} isMe={isMe} initialDuration={item.duration || 0} messageId={item.id} />
                    ) : (
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                            {item.content}
                        </Text>
                    )}
                </Animated.View >
                {/* Status always visible but typically small. User asked for Swipe to reveal exact time. 
                    We keep status here but maybe user implies they want ONLY status on swipe? 
                    Let's keep existing status (Sent 5m ago) as is, and swipe shows EXACT time (14:32).
                */}
                <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                    {getStatusText(item)}
                </Text>
            </View >
        </Swipeable>
    );
});

export default function ChatScreen({ route, navigation }: any) {
    const { user, fetchUnreadCount } = useAuth();
    const { otherUser } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingLevels, setRecordingLevels] = useState<number[]>(new Array(30).fill(0));
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    // Robust State Machine for Recording: 'IDLE' | 'STARTING' | 'RECORDING' | 'STOPPING'
    const recordingStateRef = useRef<'IDLE' | 'STARTING' | 'STOPPING_REQUESTED' | 'RECORDING'>('IDLE');
    const recordingInstanceRef = useRef<Audio.Recording | null>(null);
    const [isCanceling, setIsCanceling] = useState(false);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

    const scrollToMessage = (messageId: string) => {
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            setHighlightedMessageId(messageId);
            // Keep state true long enough for animation (2s hold + 1s fade)
            setTimeout(() => setHighlightedMessageId(null), 3500);
        }
    };

    // PanResponder for Slide to Cancel
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                startRecording();
            },
            onPanResponderMove: (_, gestureState) => {
                // If dragged left significantly
                if (gestureState.dx < -100) {
                    setIsCanceling(true);
                } else {
                    setIsCanceling(false);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -100) {
                    cancelRecording();
                } else {
                    stopRecording();
                }
                setIsCanceling(false);
            },
            onPanResponderTerminate: () => {
                cancelRecording();
                setIsCanceling(false);
            },
        })
    ).current;

    useEffect(() => {
        fetchAndMark();

        const handleNewMessage = (msg: any) => {
            console.log("Socket received message:", msg);
            // Check if message belongs to this conversation (either from me to them, or them to me)
            if (
                (msg.senderId === user?.id && msg.recipientId === otherUser.id) ||
                (msg.senderId === otherUser.id && msg.recipientId === user?.id)
            ) {
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [msg, ...prev];
                });

                // If sent by OTHER, we must ACK it (Delivered)
                if (msg.senderId === otherUser.id) {
                    socket.emit("message:ack", { messageId: msg.id, userId: msg.senderId });
                    // Also mark as read since we are on the screen? 
                    // Ideally yes, but we rely on fetchAndMark / focus. 
                    // For now ACK is enough for "Double Grey". 
                    // "Double Blue" is handled by markAsRead API calling.
                }
            }
        };

        const handleMessageUpdated = (updatedMsg: any) => {
            console.log("Message Updated", updatedMsg);
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
        };

        const handleMessageRead = ({ conversationId: cid, readerId }: any) => {
            if (cid === conversationId || cid === undefined) { // Simplify: if we are here, assume updates apply
                // Mark all MY messages as read
                setMessages(prev => prev.map(m => (m.senderId === user?.id) ? { ...m, read: true, delivered: true } : m));
            }
        };

        socket.on("message:new", handleNewMessage);
        socket.on("message:updated", handleMessageUpdated);
        socket.on("message:read", handleMessageRead);

        return () => {
            socket.off("message:new", handleNewMessage);
            socket.off("message:updated", handleMessageUpdated);
            socket.off("message:read", handleMessageRead);
        };
    }, [otherUser.id, conversationId, user?.id]);

    const fetchMessages = async () => {
        try {
            const res = await api.get(`/messages/with/${otherUser.id}`);
            setMessages(res.data.messages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (convoId: string) => {
        try {
            await api.post(`/messages/read/${convoId}`);
        } catch (e) {
            console.error("Failed to mark messages as read:", e);
        }
    };

    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [fetchingMore, setFetchingMore] = useState(false);

    // Refactored fetch to get ID
    const fetchAndMark = async () => {
        try {
            const res = await api.get(`/messages/with/${otherUser.id}`);
            setMessages(res.data.messages);
            setNextCursor(res.data.nextCursor);

            if (res.data.conversationId) {
                setConversationId(res.data.conversationId);
                await api.post(`/messages/read/${res.data.conversationId}`);
                // Refresh global unread count immediately
                fetchUnreadCount();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const loadMoreMessages = async () => {
        if (!nextCursor || fetchingMore) return;
        setFetchingMore(true);
        try {
            const res = await api.get(`/messages/with/${otherUser.id}?cursor=${nextCursor}`);
            setMessages(prev => [...prev, ...res.data.messages]);
            setNextCursor(res.data.nextCursor);
        } catch (error) {
            console.error("Failed to load more messages", error);
        } finally {
            setFetchingMore(false);
        }
    };


    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [replyingTo, setReplyingTo] = useState<any | null>(null);

    // Image Viewer Logic
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const viewersImages = messages
        .filter(m => m.type === 'IMAGE')
        .map(m => ({ uri: m.mediaUrl.startsWith("http") ? m.mediaUrl : `http://localhost:3000${m.mediaUrl}` }));

    const saveImage = async (uri: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour enregistrer les images.");
                return;
            }
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert("Succès", "Image enregistrée dans la galerie ! 📸");
        } catch (error) {
            console.error(error);
            Alert.alert("Erreur", "Impossible d'enregistrer l'image.");
        }
    };

    const ImageFooter = ({ imageIndex }: { imageIndex: number }) => {
        const image = viewersImages[imageIndex];
        return (
            <View style={styles.footerContainer}>
                <TouchableOpacity style={styles.downloadButton} onPress={() => saveImage(image.uri)}>
                    <Ionicons name="download-outline" size={24} color="#fff" />
                    <Text style={styles.downloadText}>Enregistrer dans la galerie</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const sendMessage = async () => {
        if (!inputText.trim() && selectedImages.length === 0) return;

        const content = inputText.trim();
        const pendingImages = [...selectedImages];

        // Optimistic clear
        setInputText("");
        setSelectedImages([]);

        try {
            setSending(true);

            // Scenario 1: Text Only
            if (pendingImages.length === 0) {
                await api.post(`/messages/to/${otherUser.id}`, {
                    content,
                    type: 'TEXT',
                    replyToId: replyingTo?.id
                });
            }
            // Scenario 2: Images (with optional text on first one)
            else {
                for (let i = 0; i < pendingImages.length; i++) {
                    const uri = pendingImages[i];
                    // Upload
                    const { url } = await uploadFile(uri, "image/jpeg");

                    // Attach content ONLY to the first image
                    const msgContent = (i === 0 && content) ? content : null;

                    await api.post(`/messages/to/${otherUser.id}`, {
                        content: msgContent,
                        type: 'IMAGE',
                        mediaUrl: url,
                        replyToId: (i === 0 && replyingTo) ? replyingTo.id : null // Only thread the first image if replying
                    });
                }
            }

            setReplyingTo(null); // Clear reply state

        } catch (error) {
            console.error(error);
            alert("Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsMultipleSelection: true, // Enable multiple selection
            selectionLimit: 5, // Reasonable limit
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setSelectedImages(prev => [...prev, ...newUris]);
        }
    };

    const removeImage = (indexToRemove: number) => {
        setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const startRecording = async () => {
        if (recordingStateRef.current !== 'IDLE') return;
        recordingStateRef.current = 'STARTING';

        try {
            if (permissionResponse?.status !== 'granted') {
                console.log("Requesting permission..");
                await requestPermission();
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log("Starting recording..");
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                (status) => {
                    if (status.isRecording && status.metering !== undefined) {
                        const db = status.metering;
                        // Normalize dB (-160 to 0) to 0-1. Usually speech is around -40 to 0.
                        // Let's take -60 as roughly 0 level.
                        const level = Math.max(0, (db + 60) / 60);
                        setRecordingLevels(prev => [...prev.slice(1), level]);
                    }
                },
                100 // Update every 100ms
            );

            // Critical check: Did user ask to stop while we were initializing?
            // TS thinks it's still STARTING, but it might have changed async
            if ((recordingStateRef.current as string) === 'STOPPING_REQUESTED') {
                console.log("Stop was requested during start, cleaning up immediately.");
                await newRecording.stopAndUnloadAsync();
                recordingStateRef.current = 'IDLE';
                return;
            }

            recordingInstanceRef.current = newRecording;
            setRecording(newRecording);
            recordingStateRef.current = 'RECORDING';
            console.log("Recording started");
        } catch (err) {
            console.error("Failed to start recording", err);
            recordingStateRef.current = 'IDLE';
        }
    };

    const cancelRecording = async () => {
        if (recordingStateRef.current === 'STARTING') {
            recordingStateRef.current = 'STOPPING_REQUESTED';
            return;
        }
        if (recordingInstanceRef.current) {
            try {
                await recordingInstanceRef.current.stopAndUnloadAsync();
            } catch (e) { console.log(e); }
        }
        setRecording(null);
        recordingInstanceRef.current = null;
        setRecordingLevels(new Array(30).fill(0));
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        recordingStateRef.current = 'IDLE';
        console.log("Recording cancelled");
    };

    const stopRecording = async () => {
        if (recordingStateRef.current === 'IDLE') return;

        if (recordingStateRef.current === 'STARTING') {
            recordingStateRef.current = 'STOPPING_REQUESTED';
            return;
        }

        // Mark as stopping so specific logic can't re-trigger
        // But we assume if it's RECORDING it's safe to stop

        const rec = recordingInstanceRef.current;
        if (!rec) {
            recordingStateRef.current = 'IDLE';
            return;
        }

        try {
            // Check duration
            const status = await rec.getStatusAsync();
            if (status.durationMillis < 500) {
                console.log("Recording too short, discarding.");
                await rec.stopAndUnloadAsync();
                setRecording(null);
                recordingInstanceRef.current = null;
                setRecordingLevels(new Array(30).fill(0));
                recordingStateRef.current = 'IDLE';
                return;
            }

            // Capture duration before unloading
            const duration = status.durationMillis;
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();

            setRecording(null);
            recordingInstanceRef.current = null;
            setRecordingLevels(new Array(30).fill(0));
            console.log("Recording stopped and stored at", uri, "Duration:", duration);
            recordingStateRef.current = 'IDLE'; // Reset state BEFORE upload to allow new recording while uploading

            if (uri && duration > 500) {
                try {
                    const { url } = await uploadFile(uri, "audio/m4a");
                    await api.post(`/messages/to/${otherUser.id}`, {
                        mediaUrl: url,
                        type: 'AUDIO',
                        duration
                    });
                } catch (err) {
                    console.error("Audio upload failed", err);
                    alert("Echec de l'envoi de l'audio");
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });
        } catch (error) {
            console.error("Failed to stop recording", error);
            recordingStateRef.current = 'IDLE';
        }
    };

    const getStatusText = (item: any) => {
        const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr });
        if (item.senderId !== user?.id) return timeAgo;

        if (item.read) return `Vu ${timeAgo}`;
        if (item.delivered) return `Délivré ${timeAgo}`;
        return `Envoyé ${timeAgo}`;
    };

    // renderReplyContext moved inside MessageItem

    const renderItem = ({ item }: any) => {
        return (
            <MessageItem
                item={item}
                user={user}
                onReply={setReplyingTo}
                onImagePress={(url: string) => {
                    const finalUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;
                    const index = viewersImages.findIndex(img => img.uri === finalUrl);
                    setCurrentImageIndex(index !== -1 ? index : 0);
                    setIsViewerVisible(true);
                }}
                highlighted={highlightedMessageId === item.id}
                scrollToMessage={scrollToMessage}
                getStatusText={getStatusText}
            />
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => navigation.navigate("UserProfile", { userId: otherUser.id })}
                >
                    <Image
                        source={{ uri: otherUser.avatarUrl || `https://ui-avatars.com/api/?name=${otherUser.username}&background=random&size=64` }}
                        style={styles.avatar}
                    />
                    <Text style={styles.headerTitle}>{otherUser.username}</Text>
                </TouchableOpacity>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    style={{ flex: 1 }}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    inverted
                    onEndReached={loadMoreMessages}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={fetchingMore ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
                    onScrollToIndexFailed={info => {
                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                        wait.then(() => {
                            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                        });
                    }}
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                {/* Reply Preview Bar */}
                {replyingTo && (
                    <View style={styles.replyBarContainer}>
                        <View style={styles.replyBarContent}>
                            <View style={[styles.replyBarLine, { backgroundColor: replyingTo.senderId === user?.id ? theme.colors.primary : '#888' }]} />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                                <Text style={styles.replyBarSender}>
                                    Réponse à {replyingTo.senderId === user?.id ? "vous" : (replyingTo.sender?.username || "l'utilisateur")}
                                </Text>
                                <Text numberOfLines={1} style={styles.replyBarText}>
                                    {replyingTo.type === 'IMAGE' ? '📷 Photo' : replyingTo.type === 'AUDIO' ? '🎵 Audio' : replyingTo.content}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                <Ionicons name="close-circle" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Image Preview Area */}
                {selectedImages.length > 0 && (
                    <View style={styles.imagePreviewContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {selectedImages.map((uri, index) => (
                                <View key={index} style={{ marginRight: 10 }}>
                                    <Image source={{ uri }} style={styles.previewImage} />
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={() => removeImage(index)}
                                    >
                                        <Ionicons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    {recording ? (
                        <>
                            <View style={styles.recordingContainer}>
                                <View style={styles.waveformContainer}>
                                    {isCanceling ? (
                                        <View style={styles.cancelContainer}>
                                            <Ionicons name="trash" size={24} color={theme.colors.error} />
                                            <Text style={styles.cancelText}>Relâcher pour annuler</Text>
                                        </View>
                                    ) : (
                                        <Waveform levels={recordingLevels} color={theme.colors.error} gap={2} barWidth={3} />
                                    )}
                                </View>
                                {!isCanceling && (
                                    <View style={styles.slideCancelHint}>
                                        <Ionicons name="chevron-back" size={16} color={theme.colors.text.secondary} />
                                        <Text style={styles.slideText}>Glisser pour annuler</Text>
                                    </View>
                                )}
                            </View>

                            <View
                                style={[styles.sendButton, { backgroundColor: isCanceling ? theme.colors.background : theme.colors.error }]}
                                {...panResponder.panHandlers}
                            >
                                <Ionicons name="mic" size={20} color={isCanceling ? theme.colors.error : "#fff"} />
                            </View>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
                                <Ionicons name="add" size={24} color={theme.colors.primary} />
                            </TouchableOpacity>

                            <TextInput
                                style={styles.input}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Votre message..."
                                placeholderTextColor={theme.colors.text.secondary}
                                multiline
                                editable={!recording}
                            />

                            {inputText.trim() || selectedImages.length > 0 ? (
                                <TouchableOpacity onPress={sendMessage} style={styles.sendButton} disabled={sending}>
                                    {sending ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Ionicons name="arrow-up" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View
                                    style={styles.sendButton}
                                    {...panResponder.panHandlers}
                                >
                                    <Ionicons name="mic-outline" size={20} color="#fff" />
                                </View>
                            )}
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>

            <ImageView
                images={viewersImages}
                imageIndex={currentImageIndex}
                visible={isViewerVisible}
                onRequestClose={() => setIsViewerVisible(false)}
                FooterComponent={({ imageIndex }) => <ImageFooter imageIndex={imageIndex} />}
            />
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
        backgroundColor: '#fff',
    },
    backButton: {
        padding: 8,
    },
    headerInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        backgroundColor: '#eee'
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: theme.colors.text.primary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    messageContainer: {
        maxWidth: "80%",
        marginBottom: 12,
    },
    myContainer: {
        alignSelf: "flex-end",
        alignItems: "flex-end", // Ensures bubble wraps text tightly
    },
    theirContainer: {
        alignSelf: "flex-start",
        alignItems: "flex-start",
    },
    messageBubble: {
        padding: 12,
        borderRadius: 20,
    },
    myMessage: {
        backgroundColor: theme.colors.primary,
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        backgroundColor: "#F0F0F0",
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    myMessageText: {
        color: "#fff",
    },
    theirMessageText: {
        color: theme.colors.text.primary,
    },
    timeText: {
        fontSize: 10,
        marginTop: 4,
    },
    myTimeText: {
        color: theme.colors.text.secondary,
        textAlign: 'right',
    },
    theirTimeText: {
        color: theme.colors.text.secondary,
        textAlign: 'left',
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "rgba(0,0,0,0.05)",
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 34 : 12, // Handle safe area manually if needed or rely on KAV
    },
    input: {
        flex: 1,
        backgroundColor: "#F5F5F5",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        maxHeight: 100,
        marginRight: 10,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    iconButton: {
        padding: 8,
        marginRight: 4,
    },
    disabledSend: {
        backgroundColor: "#ccc",
    },
    recordingContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },
    waveformContainer: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 25,
        paddingHorizontal: 10,
    },
    cancelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        marginLeft: 8,
        color: theme.colors.error,
        fontWeight: '600',
    },
    slideCancelHint: {
        position: 'absolute',
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.5,
    },
    slideText: {
        fontSize: 10,
        color: theme.colors.text.secondary,
        marginLeft: 4,
    },
    imagePreviewContainer: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: 'transparent', // Cleaner look
    },
    previewImage: {
        width: 100,
        height: 100,
        borderRadius: 12, // Slightly more rounded
        backgroundColor: '#eee',
    },
    removeImageButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: theme.colors.error,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 1, // Ensure clickable
    },
    // Viewer Styles
    footerContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    downloadButton: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        alignItems: 'center',
    },
    downloadText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
    },
    // Reply Styles
    replyContextBubble: {
        marginBottom: 8,
        borderRadius: 8,
        padding: 6,
        flexDirection: 'row',
        overflow: 'hidden',
        minWidth: 120, // Min width to look good
    },
    replyBar: {
        width: 4,
        borderRadius: 2,
    },
    replySender: {
        fontWeight: '700',
        fontSize: 12,
        marginBottom: 2,
        marginLeft: 6,
        color: '#555',
    },
    replyTextPreview: {
        fontSize: 12,
        marginLeft: 6,
        color: '#666',
    },
    replyBarContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    replyBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 8,
    },
    replyBarLine: {
        width: 4,
        height: '100%',
        borderRadius: 2,
    },
    replyBarSender: {
        fontWeight: '700',
        color: theme.colors.primary,
        fontSize: 12,
        marginBottom: 2,
    },
    replyBarText: {
        color: '#666',
        fontSize: 12,
    }
});
