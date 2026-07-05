import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, MessageCircle, Phone } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Message = {
  id: string;
  content: string;
  sender_role: 'photographer' | 'super_admin';
  is_read: boolean;
  created_at: string;
};

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);

      // Mark super_admin messages as read
      const unread = (data || []).filter((m: any) => m.sender_role === 'super_admin' && !m.is_read);
      if (unread.length > 0) {
        await supabase
          .from('support_messages')
          .update({ is_read: true })
          .in('id', unread.map((m: any) => m.id));
      }
    } catch (e) {
      console.warn('Support messages error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('support-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `photographer_id=eq.${user.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        // Mark as read
        if ((payload.new as Message).sender_role === 'super_admin') {
          supabase
            .from('support_messages')
            .update({ is_read: true })
            .eq('id', (payload.new as Message).id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user?.id || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase.from('support_messages').insert({
        photographer_id: user.id,
        content,
        sender_role: 'photographer',
        is_read: false,
      });
      if (error) throw error;
    } catch (e) {
      console.warn('Send failed:', e);
      setNewMessage(content);
    }
    setSending(false);
  };

  const openWhatsApp = async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_whatsapp_number')
      .single();
    if (data?.value) {
      const phone = data.value.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent('Hello, I need support with my Epix Visuals account.');
      const link = `https://wa.me/${phone}?text=${msg}`;
      // In React Native, use Linking
      const { Linking } = require('react-native');
      Linking.openURL(link);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <MessageCircle size={18} color={Colors.gold} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Support</Text>
            <Text style={styles.headerSub}>Epix Visuals Team</Text>
          </View>
        </View>
        <Pressable style={styles.whatsappBtn} onPress={openWhatsApp}>
          <Phone size={16} color="#25D366" />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.empty}>
              <MessageCircle size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySub}>Send a message to get help from our team</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isPhotographer = item.sender_role === 'photographer';
          return (
            <View style={[styles.messageBubble, isPhotographer ? styles.myMessage : styles.theirMessage]}>
              <Text style={[styles.messageText, isPhotographer && styles.myMessageText]}>
                {item.content}
              </Text>
              <Text style={[styles.messageTime, isPhotographer && styles.myMessageTime]}>
                {new Date(item.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          <Send size={18} color={newMessage.trim() ? '#080810' : 'rgba(255,255,255,0.3)'} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(212,175,55,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  whatsappBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(37,211,102,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  messagesList: { padding: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginTop: 12 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  messageBubble: {
    maxWidth: '78%', padding: 12, borderRadius: 16, marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end', backgroundColor: Colors.gold, borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  myMessageText: { color: '#080810' },
  messageTime: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, alignSelf: 'flex-end' },
  myMessageTime: { color: 'rgba(8,8,16,0.5)' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 8,
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 15, color: '#FFFFFF', maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
