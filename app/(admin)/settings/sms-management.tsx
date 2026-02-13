import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Modal, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, FileText, History, Plus, X, User, Check, Trash2, Smartphone, Search } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SMSService, SMSTemplate, SMSLog, SMSLogWithClient } from '@/services/sms';
import { AdminService, Client } from '@/services/admin';

type Tab = 'compose' | 'templates' | 'logs';

export default function SmsManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('compose');

  // Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [logs, setLogs] = useState<SMSLogWithClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Selection Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Template Editor State
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<SMSTemplate> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsData, templatesData, logsData] = await Promise.all([
        AdminService.clients.list(),
        SMSService.templates.list(),
        SMSService.logs.list()
      ]);
      setClients(clientsData || []);
      setTemplates(templatesData || []);
      setLogs(logsData || []);
    } catch (error) {
      console.error('Error loading SMS data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // --- Compose Logic ---

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    setPhoneNumber(client.phone || '');
    setShowClientModal(false);

    try {
      // Auto-fill logic
      // 1. Get detailed info (access code, etc)
      const details = await SMSService.utils.getClientDetails(client.id);
      
      // 2. Find default template or use generic
      const defaultTemplate = templates.find(t => t.is_default);
      let templateBody = defaultTemplate?.body || "Hello {client_name}, your photos are ready! Access Code: {access_code}. View here: {gallery_link}";

      // 3. Compile message
      const compiled = SMSService.utils.compileTemplate(templateBody, {
        client_name: client.name,
        access_code: details.gallery?.access_code || 'PENDING',
        gallery_link: details.gallery ? `https://rork.app/g/${details.gallery.access_code}` : 'PENDING', // Mock link
        studio_name: 'Our Studio' // TODO: Get from brand settings
      });

      setMessage(compiled);
    } catch (error) {
      console.error('Error auto-filling client data:', error);
    }
  };

  const handleSendSMS = async () => {
    if (!phoneNumber || !message) {
      Alert.alert('Missing Info', 'Please provide a phone number and message.');
      return;
    }

    setSending(true);
    try {
      const result = await SMSService.send({
        phoneNumber,
        message,
        clientId: selectedClient?.id
      });
      
      if (result === 'sent') {
        Alert.alert('Success', 'SMS sent successfully!');
        setMessage('');
        // Refresh logs
        const logsData = await SMSService.logs.list();
        setLogs(logsData || []);
      } else if (result === 'cancelled') {
        // User cancelled, do nothing or show toast
      } else {
        Alert.alert('Info', 'SMS status unknown. Check your messages app.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const handleApplyTemplate = (template: SMSTemplate) => {
    // Compile with currently selected client if available
    const compiled = SMSService.utils.compileTemplate(template.body, {
      client_name: selectedClient?.name || '{client_name}',
      access_code: '{access_code}', // Would need to re-fetch to get real code if client selected
      gallery_link: '{gallery_link}',
      studio_name: 'Our Studio'
    });
    
    // If client is selected, we should re-run the fetch logic ideally, 
    // but for now simple substitution or just raw template if no client
    if (selectedClient) {
       // Re-trigger the full fill
       handleSelectClient(selectedClient).then(() => {
          // Override the message with THIS template's body but compiled
           SMSService.utils.getClientDetails(selectedClient.id).then(details => {
              const recompiled = SMSService.utils.compileTemplate(template.body, {
                client_name: selectedClient.name,
                access_code: details.gallery?.access_code || 'PENDING',
                gallery_link: details.gallery ? `https://rork.app/g/${details.gallery.access_code}` : 'PENDING',
                studio_name: 'Our Studio'
              });
              setMessage(recompiled);
           });
       });
    } else {
      setMessage(template.body);
    }
    setShowTemplateModal(false);
  };

  // --- Template Logic ---

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.body) {
      Alert.alert('Error', 'Name and Body are required');
      return;
    }

    try {
      if (editingTemplate.id) {
        await SMSService.templates.update(editingTemplate.id, editingTemplate);
      } else {
        const name = editingTemplate.name;
        const body = editingTemplate.body;
        if (!name || !body) {
          Alert.alert('Error', 'Name and Body are required');
          return;
        }

        await SMSService.templates.create({
          name,
          body,
          is_default: editingTemplate.is_default ?? false
        });
      }
      
      // Refresh
      const templatesData = await SMSService.templates.list();
      setTemplates(templatesData || []);
      setShowTemplateEditor(false);
      setEditingTemplate(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    Alert.alert('Delete Template', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await SMSService.templates.delete(id);
            const templatesData = await SMSService.templates.list();
            setTemplates(templatesData || []);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete template');
          }
        } 
      }
    ]);
  };

  // --- Render Helpers ---

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>SMS Manager</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, activeTab === 'compose' && styles.activeTab]} 
          onPress={() => setActiveTab('compose')}
        >
          <Send size={16} color={activeTab === 'compose' ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'compose' && styles.activeTabText]}>Compose</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'templates' && styles.activeTab]} 
          onPress={() => setActiveTab('templates')}
        >
          <FileText size={16} color={activeTab === 'templates' ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}>Templates</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'logs' && styles.activeTab]} 
          onPress={() => setActiveTab('logs')}
        >
          <History size={16} color={activeTab === 'logs' ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>History</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* COMPOSE TAB */}
            {activeTab === 'compose' && (
              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                  <Text style={styles.label}>Recipient</Text>
                  <Pressable style={styles.selector} onPress={() => setShowClientModal(true)}>
                    {selectedClient ? (
                      <View style={styles.selectedClient}>
                        <User size={16} color={Colors.gold} />
                        <Text style={styles.selectedClientText}>{selectedClient.name}</Text>
                      </View>
                    ) : (
                      <Text style={styles.placeholder}>Select Client...</Text>
                    )}
                    <ChevronLeft size={20} color={Colors.textMuted} style={{ transform: [{ rotate: '-90deg' }] }} />
                  </Pressable>

                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="+254..."
                    keyboardType="phone-pad"
                  />

                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Message</Text>
                    <Pressable onPress={() => setShowTemplateModal(true)}>
                      <Text style={styles.link}>Use Template</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Type your message..."
                    multiline
                    textAlignVertical="top"
                  />
                  
                  <View style={styles.helperText}>
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                      {message.length} chars
                    </Text>
                  </View>

                  <Pressable 
                    style={[styles.sendBtn, sending && styles.disabledBtn]} 
                    onPress={handleSendSMS}
                    disabled={sending}
                  >
                    {sending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Send size={18} color="#fff" />
                        <Text style={styles.sendBtnText}>Send SMS via SIM</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            )}

            {/* TEMPLATES TAB */}
            {activeTab === 'templates' && (
              <ScrollView contentContainerStyle={styles.scrollContent}>
                <Pressable 
                  style={styles.addBtn} 
                  onPress={() => {
                    setEditingTemplate({ name: '', body: '', is_default: false });
                    setShowTemplateEditor(true);
                  }}
                >
                  <Plus size={20} color="#fff" />
                  <Text style={styles.addBtnText}>New Template</Text>
                </Pressable>

                {templates.map(t => (
                  <View key={t.id} style={styles.templateCard}>
                    <View style={styles.templateHeader}>
                      <Text style={styles.templateName}>{t.name}</Text>
                      {t.is_default && <View style={styles.badge}><Text style={styles.badgeText}>Default</Text></View>}
                    </View>
                    <Text style={styles.templateBody}>{t.body}</Text>
                    <View style={styles.templateActions}>
                      <Pressable onPress={() => { setEditingTemplate(t); setShowTemplateEditor(true); }}>
                        <Text style={styles.actionText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeleteTemplate(t.id)}>
                        <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* LOGS TAB */}
            {activeTab === 'logs' && (
              <FlatList
                data={logs}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.scrollContent}
                renderItem={({ item }) => (
                  <View style={styles.logItem}>
                    <View style={styles.logIcon}>
                      <Smartphone size={16} color={item.status === 'sent' ? Colors.success : Colors.textMuted} />
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.logClient}>
                        {item.clients?.name || item.phone_number}
                      </Text>
                      <Text style={styles.logBody} numberOfLines={2}>{item.message_body}</Text>
                      <Text style={styles.logMeta}>
                        {new Date(item.created_at).toLocaleString()} · {item.status}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </>
        )}
      </View>

      {/* Client Modal */}
      <Modal visible={showClientModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client</Text>
            <Pressable onPress={() => setShowClientModal(false)}>
              <X size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.textMuted} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search clients..."
              value={clientSearch}
              onChangeText={setClientSearch}
            />
          </View>
          <FlatList
            data={filteredClients}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.clientItem} onPress={() => handleSelectClient(item)}>
                <User size={20} color={Colors.textMuted} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientPhone}>{item.phone || 'No phone'}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Template Selection Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View style={styles.centeredModal}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Template</Text>
            {templates.map(t => (
              <Pressable 
                key={t.id} 
                style={styles.templateOption} 
                onPress={() => handleApplyTemplate(t)}
              >
                <Text style={styles.templateName}>{t.name}</Text>
                <Text numberOfLines={1} style={styles.templatePreview}>{t.body}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.closeBtn} onPress={() => setShowTemplateModal(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Template Editor Modal */}
      <Modal visible={showTemplateEditor} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingTemplate?.id ? 'Edit Template' : 'New Template'}</Text>
            <Pressable onPress={() => setShowTemplateEditor(false)}>
              <X size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.label}>Template Name</Text>
            <TextInput
              style={styles.input}
              value={editingTemplate?.name}
              onChangeText={text => setEditingTemplate(prev => ({ ...prev, name: text }))}
              placeholder="e.g. Wedding Delivery"
            />
            
            <Text style={styles.label}>Message Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editingTemplate?.body}
              onChangeText={text => setEditingTemplate(prev => ({ ...prev, body: text }))}
              placeholder="Use {client_name}, {access_code}, {gallery_link}"
              multiline
            />
            
            <Text style={styles.hint}>
              Available variables: {'{client_name}'}, {'{access_code}'}, {'{gallery_link}'}, {'{studio_name}'}
            </Text>

            <Pressable 
              style={styles.checkbox} 
              onPress={() => setEditingTemplate(prev => ({ ...prev, is_default: !prev?.is_default }))}
            >
              <View style={[styles.checkCircle, editingTemplate?.is_default && styles.checked]}>
                {editingTemplate?.is_default && <Check size={14} color="#fff" />}
              </View>
              <Text style={styles.checkLabel}>Set as default template</Text>
            </Pressable>

            <Pressable style={styles.saveBtn} onPress={handleSaveTemplate}>
              <Text style={styles.saveBtnText}>Save Template</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  tabText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  activeTabText: { color: Colors.gold },
  content: { flex: 1 },
  scrollContent: { padding: 20 },
  
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: Colors.inputBg,
  },
  placeholder: { color: Colors.textMuted },
  selectedClient: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedClientText: { fontWeight: '500', color: Colors.textPrimary },
  
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  link: { color: Colors.gold, fontSize: 13, fontWeight: '500' },
  helperText: { alignItems: 'flex-end', marginBottom: 16 },
  
  sendBtn: {
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  disabledBtn: { opacity: 0.7 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  // Templates
  addBtn: {
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  templateName: { fontWeight: '600', fontSize: 16 },
  templateBody: { color: Colors.textSecondary, marginBottom: 12, lineHeight: 20 },
  badge: { backgroundColor: Colors.gold + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: Colors.gold, fontSize: 10, fontWeight: '600' },
  templateActions: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end' },
  actionText: { fontWeight: '500', color: Colors.gold },
  
  // Logs
  logItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  logIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center'
  },
  logInfo: { flex: 1 },
  logClient: { fontWeight: '600', marginBottom: 2 },
  logBody: { color: Colors.textSecondary, fontSize: 13, marginBottom: 4 },
  logMeta: { color: Colors.textMuted, fontSize: 11 },
  
  // Modals
  modalContainer: { flex: 1, backgroundColor: Colors.background, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 20, marginTop: 0,
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, gap: 8
  },
  searchInput: { flex: 1, height: 24 },
  clientItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  clientName: { fontWeight: '600', fontSize: 16 },
  clientPhone: { color: Colors.textMuted },
  
  centeredModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  templateOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  templatePreview: { color: Colors.textMuted, fontSize: 12 },
  closeBtn: { marginTop: 16, alignItems: 'center' },
  closeBtnText: { color: Colors.error, fontWeight: '600' },
  
  hint: { fontSize: 12, color: Colors.textMuted, marginBottom: 16 },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  checkCircle: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: Colors.gold },
  checkLabel: { color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.gold, padding: 16, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' }
});
