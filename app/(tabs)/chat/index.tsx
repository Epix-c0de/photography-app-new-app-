import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send, Clock, Check, CheckCheck, Paperclip } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useBranding } from '@/contexts/BrandingContext';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'client' | 'admin';
  timestamp: string;
  read: boolean;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isClient = message.sender === 'client';

  return (
    <View style={[styles.messageBubbleRow, isClient && styles.messageBubbleRowClient]}>
      <View style={[styles.messageBubble, isClient ? styles.clientBubble : styles.photoBubble]}>
        <Text style={[styles.messageText, isClient && styles.clientMessageText]}>{message.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isClient && styles.clientMessageTime]}>{message.timestamp}</Text>
          {isClient && (
            message.read
              ? <CheckCheck size={12} color={Colors.gold} />
              : <Check size={12} color={Colors.textMuted} />
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { initialMessage } = useLocalSearchParams<{ initialMessage: string }>();
  const insets = useSafeAreaInsets();
  const { brandName } = useBranding();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>(initialMessage || '');

  const scrollRef = useRef<ScrollView>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  // TODO: Implement real-time chat using Supabase when 'messages' table is available.
  // For now, this screen starts empty.

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const newMessage: ChatMessage = {
      id: String(Date.now()),
      text: inputText.trim(),
      sender: 'client',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, sendScale]);

  const isOfficeHours = () => {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 18;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1552642986-ccb41e7059e7?w=100&h=100&fit=crop' }}
          style={styles.headerAvatar}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{brandName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, !isOfficeHours() && styles.offlineDot]} />
            <Text style={styles.statusLabel}>
              {isOfficeHours() ? 'Online \u2022 Usually replies instantly' : 'Office hours: 8AM - 6PM'}
            </Text>
          </View>
        </View>
      </View>

      {!isOfficeHours() && (
        <View style={styles.officeHoursBanner}>
          <Clock size={14} color={Colors.gold} />
          <Text style={styles.officeHoursText}>
            We&apos;re currently outside office hours. We&apos;ll respond first thing in the morning.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
             <View style={styles.emptyState}>
               <Text style={styles.emptyText}>No messages yet. Start a conversation!</Text>
             </View>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable style={styles.attachButton} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
            <Paperclip size={20} color={Colors.textSecondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Pressable onPress={handleSend} disabled={!inputText.trim()}>
            <Animated.View style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled, { transform: [{ scale: sendScale }] }]}>
              <Send size={20} color={Colors.white} />
            </Animated.View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  offlineDot: {
    backgroundColor: Colors.textMuted,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  officeHoursBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  officeHoursText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gold,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  messageBubbleRowClient: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  photoBubble: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 4,
  },
  clientBubble: {
    backgroundColor: Colors.gold,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.white,
    lineHeight: 22,
  },
  clientMessageText: {
    color: Colors.background,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  clientMessageTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 12,
  },
  attachButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    color: Colors.white,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.card,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  }
});
