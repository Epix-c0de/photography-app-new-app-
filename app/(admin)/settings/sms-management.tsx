import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Modal, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, PermissionsAndroid, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, FileText, History, Plus, X, User, Check, Trash2, Smartphone, Search } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SMSService, SMSTemplate, SMSLog, SMSLogWithClient } from '@/services/sms';
import { AdminService, Client } from '@/services/admin';
import { LocalSmsGateway, type LocalSmsGatewayStatus } from '@lenzart/local-sms-gateway';

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
  const [balance, setBalance] = useState<number>(0);
  const [gatewayStatus, setGatewayStatus] = useState<LocalSmsGatewayStatus | null>(null);
  const [sentToday, setSentToday] = useState<number>(0);
  const [failedToday, setFailedToday] = useState<number>(0);
  const [queueRemaining, setQueueRemaining] = useState<number>(0);

  // Compose State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [editMessage, setEditMessage] = useState(false);
  const [adminPhoneNumber, setAdminPhoneNumber] = useState('');
  const [bundleAmount, setBundleAmount] = useState<number>(100);
  const [customBundle, setCustomBundle] = useState<string>('');
  const [buyingBundle, setBuyingBundle] = useState(false);
  
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

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await SMSService.queue.processNow();
      setQueueRemaining(res.remaining);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const refreshGatewayStatus = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const status = await LocalSmsGateway.getStatus();
      setGatewayStatus(status);
    } catch {
      setGatewayStatus(null);
    }
  }, []);

  const requestSmsPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      ]);
      await refreshGatewayStatus();
    } catch (e: any) {
      Alert.alert('Permission Error', e?.message ?? 'Failed to request permissions');
    }
  }, [refreshGatewayStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsData, templatesData, logsData, bal] = await Promise.all([
        AdminService.clients.list(),
        SMSService.templates.list(),
        SMSService.logs.list(),
        AdminService.sms.getBalance()
      ]);
      setClients(clientsData || []);
      setTemplates(templatesData || []);
      setLogs(logsData || []);
      setBalance(bal || 0);
      await refreshGatewayStatus();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const startMs = todayStart.getTime();
      const sent = (logsData || []).filter(l => l.status === 'sent' && new Date(l.created_at).getTime() >= startMs).length;
      const failed = (logsData || []).filter(l => l.status === 'failed' && new Date(l.created_at).getTime() >= startMs).length;
      setSentToday(sent);
      setFailedToday(failed);
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
      let templateBody = defaultTemplate?.body || "Hello {client_name}, your photos are ready! Use code: {access_code}. {business_name}";

      // 3. Compile message
      const compiled = SMSService.utils.compileTemplate(templateBody, {
        client_name: client.name,
        access_code: details.gallery?.access_code || 'PENDING',
        gallery_name: details.gallery?.name || '',
        app_link: 'https://rork.app',
        business_name: 'Epix Visuals Studios.co'
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
    if (balance <= 0) {
      Alert.alert('Low Balance', 'You have no SMS credits. Buy a bundle to continue.');
      return;
    }

    setSending(true);
    try {
      const result = await SMSService.send({
        phoneNumber,
        message,
        clientId: selectedClient?.id
      });
      
      if (result === 'sent') Alert.alert('Success', 'SMS sent successfully!');
      if (result === 'queued') Alert.alert('Queued', 'No service. SMS queued and will send when signal returns.');
      if (result === 'failed') Alert.alert('Failed', 'SMS failed to send.');

      setMessage('');
      setSelectedClient(null);
      setPhoneNumber('');

      const [logsData, bal] = await Promise.all([SMSService.logs.list(), AdminService.sms.getBalance()]);
      setLogs(logsData || []);
      setBalance(bal || 0);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const handleBuyBundle = async () => {
    const pn = adminPhoneNumber.trim();
    const selectedAmount = customBundle.trim() ? Number(customBundle.trim()) : bundleAmount;
    if (!pn) {
      Alert.alert('Missing Info', 'Enter your phone number to receive the STK push.');
      return;
    }
    if (!Number.isFinite(selectedAmount) || selectedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid SMS amount.');
      return;
    }

    setBuyingBundle(true);
    try {
      const data = await AdminService.sms.purchaseCredits(Math.round(selectedAmount), pn);
      Alert.alert('STK Push Sent', `Complete payment on your phone.\n\nCheckout ID: ${data?.checkout_request_id || data?.CheckoutRequestID || 'N/A'}`);
    } catch (e: any) {
      Alert.alert('Purchase Failed', e?.message ?? 'Failed to start purchase');
    } finally {
      setBuyingBundle(false);
    }
  };

  const handleApplyTemplate = (template: SMSTemplate) => {
    // Compile with currently selected client if available
    const compiled = SMSService.utils.compileTemplate(template.body, {
      client_name: selectedClient?.name || '{client_name}',
      access_code: '{access_code}', // Would need to re-fetch to get real code if client selected
      gallery_name: '{gallery_name}',
      app_link: '{app_link}',
      business_name: '{business_name}'
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
                gallery_name: details.gallery?.name || '',
                app_link: 'https://rork.app',
                business_name: 'Epix Visuals Studios.co'
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
        <Text style={styles.headerTitle}>SMS Gateway</Text>
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
                  <Text style={styles.sectionTitle}>Gateway Status</Text>

                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>SMS Balance</Text>
                    <Text style={styles.statusValue}>{balance}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Queued</Text>
                    <Text style={styles.statusValue}>{queueRemaining}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Sent Today</Text>
                    <Text style={styles.statusValue}>{sentToday}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Failed Today</Text>
                    <Text style={styles.statusValue}>{failedToday}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>SIM Status</Text>
                    <Text style={styles.statusValue}>{gatewayStatus?.simState ?? 'unknown'}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>SEND_SMS</Text>
                    <Text style={styles.statusValue}>{gatewayStatus?.sendSmsPermission ?? 'unknown'}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>READ_SMS</Text>
                    <Text style={styles.statusValue}>{gatewayStatus?.readSmsPermission ?? 'unknown'}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>READ_PHONE_STATE</Text>
                    <Text style={styles.statusValue}>{gatewayStatus?.readPhoneStatePermission ?? 'unknown'}</Text>
                  </View>

                  <View style={styles.rowBetween}>
                    <Pressable style={styles.secondaryBtn} onPress={refreshGatewayStatus}>
                      <Text style={styles.secondaryBtnText}>Check Status</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryBtn} onPress={requestSmsPermissions}>
                      <Text style={styles.secondaryBtnText}>Grant Permissions</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.warningText}>SMS will be sent from your SIM card. Carrier charges may apply.</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Buy SMS Bundle (M-Pesa)</Text>
                  <Text style={styles.label}>Your Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={adminPhoneNumber}
                    onChangeText={setAdminPhoneNumber}
                    placeholder="+254..."
                    keyboardType="phone-pad"
                  />

                  <View style={styles.rowBetween}>
                    <Pressable style={[styles.bundleChip, !customBundle && bundleAmount === 100 && styles.bundleChipActive]} onPress={() => { setCustomBundle(''); setBundleAmount(100); }}>
                      <Text style={[styles.bundleChipText, !customBundle && bundleAmount === 100 && styles.bundleChipTextActive]}>100</Text>
                    </Pressable>
                    <Pressable style={[styles.bundleChip, !customBundle && bundleAmount === 250 && styles.bundleChipActive]} onPress={() => { setCustomBundle(''); setBundleAmount(250); }}>
                      <Text style={[styles.bundleChipText, !customBundle && bundleAmount === 250 && styles.bundleChipTextActive]}>250</Text>
                    </Pressable>
                    <Pressable style={[styles.bundleChip, !customBundle && bundleAmount === 500 && styles.bundleChipActive]} onPress={() => { setCustomBundle(''); setBundleAmount(500); }}>
                      <Text style={[styles.bundleChipText, !customBundle && bundleAmount === 500 && styles.bundleChipTextActive]}>500</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>Custom Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={customBundle}
                    onChangeText={setCustomBundle}
                    placeholder="e.g. 120"
                    keyboardType="number-pad"
                  />

                  <Pressable style={[styles.sendBtn, buyingBundle && styles.disabledBtn]} onPress={handleBuyBundle} disabled={buyingBundle}>
                    {buyingBundle ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Buy SMS Bundle</Text>}
                  </Pressable>
                </View>

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
                    <View style={styles.row}>
                      <Pressable onPress={() => setShowTemplateModal(true)}>
                        <Text style={styles.link}>Use Template</Text>
                      </Pressable>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Edit</Text>
                        <Switch value={editMessage} onValueChange={setEditMessage} />
                      </View>
                    </View>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Type your message..."
                    multiline
                    textAlignVertical="top"
                    editable={editMessage}
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
                      <Smartphone size={16} color={item.status === 'sent' ? Colors.success : item.status === 'failed' ? Colors.error : Colors.textMuted} />
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.logClient}>
                        {item.clients?.name || item.phone_number}
                      </Text>
                      <Text style={styles.logBody} numberOfLines={2}>{item.message}</Text>
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
              placeholder="Use {client_name}, {access_code}, {gallery_name}, {app_link}, {business_name}"
              multiline
            />
            
            <Text style={styles.hint}>
              Available variables: {'{client_name}'}, {'{access_code}'}, {'{gallery_name}'}, {'{app_link}'}, {'{business_name}'}
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  statusValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  warningText: {
    marginTop: 12,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 12,
    marginRight: 10,
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  bundleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 10,
    marginBottom: 12,
  },
  bundleChipActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(201, 168, 109, 0.12)',
  },
  bundleChipText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  bundleChipTextActive: {
    color: Colors.gold,
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
  
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
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
