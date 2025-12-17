import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from "react-native";
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

export default function ChatScreen({ route, navigation }: any) {
    const { user, fetchUnreadCount } = useAuth();
    const { otherUser } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [permissionResponse, requestPermission] = Audio.usePermissions();

    useEffect(() => {
        fetchAndMark();

        const handleNewMessage = (msg: any) => {
            // Check if message belongs to this conversation (either from me to them, or them to me)
            if (
                (msg.senderId === user?.id && msg.recipientId === otherUser.id) ||
                (msg.senderId === otherUser.id && msg.recipientId === user?.id)
            ) {
                // For inverted list, new messages go to index 0 (start of array)
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [msg, ...prev];
                });
                // If we receive a message while in chat, mark it as read? 
                // We'd need the conversationId. 
            }
        };

        socket.on("message:new", handleNewMessage);

        return () => {
            socket.off("message:new", handleNewMessage);
        };
    }, [otherUser.id, conversationId]);

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

    // Refactored fetch to get ID
    const fetchAndMark = async () => {
        try {
            const res = await api.get(`/messages/with/${otherUser.id}`);
            setMessages(res.data.messages);
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


    const sendMessage = async () => {
        if (!inputText.trim()) return;
        const content = inputText;
        setInputText(""); // Optimistic clear

        try {
            await api.post(`/messages/to/${otherUser.id}`, { content, type: 'TEXT' });
            // Socket will handle the append
        } catch (error) {
            console.error(error);
            alert("Failed to send message");
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
        });

        if (!result.canceled) {
            try {
                const { url } = await uploadFile(result.assets[0].uri, "image/jpeg");
                await api.post(`/messages/to/${otherUser.id}`, {
                    mediaUrl: url,
                    type: 'IMAGE'
                });
            } catch (err) {
                console.error("Image upload failed", err);
                alert("Echec de l'envoi de l'image");
            }
        }
    };

    const startRecording = async () => {
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
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            console.log("Recording started");
        } catch (err) {
            console.error("Failed to start recording", err);
        }
    };

    const stopRecording = async () => {
        console.log("Stopping recording..");
        if (!recording) return;

        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        console.log("Recording stopped and stored at", uri);

        if (uri) {
            try {
                // Determine mime type (m4a usually for iOS/HighQuality)
                const { url } = await uploadFile(uri, "audio/m4a");
                await api.post(`/messages/to/${otherUser.id}`, {
                    mediaUrl: url,
                    type: 'AUDIO'
                });
            } catch (err) {
                console.error("Audio upload failed", err);
                alert("Echec de l'envoi de l'audio");
            }
        }

        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
        });
    };

    const renderItem = ({ item }: any) => {
        const isMe = item.senderId === user?.id;
        return (
            <View style={[styles.messageContainer, isMe ? styles.myContainer : styles.theirContainer]}>
                <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, item.type === 'IMAGE' && { padding: 4 }]}>
                    {item.type === 'IMAGE' ? (
                        <Image
                            source={{ uri: item.mediaUrl.startsWith("http") ? item.mediaUrl : `http://localhost:3000${item.mediaUrl}` }}
                            style={{ width: 200, height: 200, borderRadius: 16 }}
                            resizeMode="cover"
                        />
                    ) : item.type === 'AUDIO' ? (
                        <AudioMessage uri={item.mediaUrl} isMe={isMe} />
                    ) : (
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                            {item.content}
                        </Text>
                    )}
                </View>
                <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr })}
                </Text>
            </View>
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
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    inverted
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <View style={styles.inputContainer}>
                    <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
                        <Ionicons name="add" size={24} color={theme.colors.primary} />
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder={recording ? "Enregistrement..." : "Votre message..."}
                        placeholderTextColor={theme.colors.text.secondary}
                        multiline
                        editable={!recording}
                    />

                    {inputText.trim() ? (
                        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                            <Ionicons name="arrow-up" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPressIn={startRecording}
                            onPressOut={stopRecording}
                            style={[styles.sendButton, recording && { backgroundColor: theme.colors.error }]}
                        >
                            <Ionicons name={recording ? "mic" : "mic-outline"} size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF", // Force white as requested
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
    }
});
