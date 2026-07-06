import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MessageCircle, ChevronDown, ChevronUp, Send, HelpCircle, BookOpen, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import SettingsHeader from '@/components/SettingsHeader';
import { supabase } from '@/lib/supabase';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export default function HelpSupport() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [faqsResult, ticketsResult] = await Promise.all([
        supabase.from('faqs').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      if (faqsResult.data) setFaqs(faqsResult.data);
      if (ticketsResult.data) setTickets(ticketsResult.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleFaq = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const submitTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        status: 'open',
        priority: 'normal',
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Submitted!', 'Your support ticket has been created. We typically respond within 24 hours.');
      setShowTicketForm(false);
      setTicketSubject('');
      setTicketMessage('');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'resolved': return '#22c55e';
      default: return Colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsHeader title="Help & Support" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Help & Support" />
      
      <View style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable 
            style={styles.actionCard}
            onPress={() => router.push('/chat')}
          >
            <MessageCircle size={24} color={Colors.gold} />
            <Text style={styles.actionTitle}>Live Chat</Text>
            <Text style={styles.actionDesc}>Chat with support</Text>
          </Pressable>
          
          <Pressable 
            style={styles.actionCard}
            onPress={() => setShowTicketForm(true)}
          >
            <Send size={24} color={Colors.gold} />
            <Text style={styles.actionTitle}>Submit Ticket</Text>
            <Text style={styles.actionDesc}>Get help via email</Text>
          </Pressable>
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <HelpCircle size={20} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          </View>
          
          {faqs.map((faq) => (
            <Pressable 
              key={faq.id} 
              style={styles.faqItem}
              onPress={() => toggleFaq(faq.id)}
            >
              <View style={styles.faqQuestion}>
                <Text style={styles.faqText}>{faq.question}</Text>
                {expandedFaq === faq.id ? (
                  <ChevronUp size={20} color={Colors.textMuted} />
                ) : (
                  <ChevronDown size={20} color={Colors.textMuted} />
                )}
              </View>
              {expandedFaq === faq.id && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Recent Tickets */}
        {tickets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={20} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Your Recent Tickets</Text>
            </View>
            
            {tickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticketItem}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  <View style={[styles.ticketStatus, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                    <Text style={[styles.ticketStatusText, { color: getStatusColor(ticket.status) }]}>
                      {ticket.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ticketDate}>
                  {new Date(ticket.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.contactSection}>
          <View style={styles.contactItem}>
            <Phone size={16} color={Colors.textMuted} />
            <Text style={styles.contactText}>+254 XXX XXX XXX</Text>
          </View>
          <Text style={styles.contactHours}>Mon-Fri 9AM-6PM EAT</Text>
        </View>
      </View>

      {/* Ticket Form Modal */}
      {showTicketForm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Submit Support Ticket</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Subject"
              placeholderTextColor={Colors.textMuted}
              value={ticketSubject}
              onChangeText={setTicketSubject}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your issue..."
              placeholderTextColor={Colors.textMuted}
              value={ticketMessage}
              onChangeText={setTicketMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <Pressable 
                style={styles.cancelButton}
                onPress={() => setShowTicketForm(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.submitButton, submitting && styles.submitDisabled]}
                onPress={submitTicket}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.submitText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 12,
    lineHeight: 20,
  },
  ticketItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  ticketStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ticketStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  ticketDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  contactSection: {
    alignItems: 'center',
    gap: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  contactHours: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: Colors.white,
    fontWeight: '600',
  },
});