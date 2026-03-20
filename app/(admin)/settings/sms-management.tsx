import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Modal, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, PermissionsAndroid, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, FileText, History, Plus, X, User, Check, Trash2, Smartphone, Search, BarChart3 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { SMSService, SMSTemplate, SMSLog, SMSLogWithClient } from '@/services/sms';
import { AdminService, Client } from '@/services/admin';
import { LocalSmsGateway, type LocalSmsGatewayStatus } from '@lenzart/local-sms-gateway';

type Tab = 'compose' | 'templates' | 'logs' | 'analytics';

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

  // Modal States
  const [showClientModal, setShowClientModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // SMS Signature State
  const [smsSignature, setSmsSignature] = useState('');

  // Template Editor State
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<SMSTemplate> | null>(null);

  // Compose State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Bundle Purchase State
  const [adminPhoneNumber, setAdminPhoneNumber] = useState('');
  const [customBundle, setCustomBundle] = useState('');
  const [bundleAmount, setBundleAmount] = useState(100);
  const [buyingBundle, setBuyingBundle] = useState(false);

  // Bulk Send State
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0 });
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Scheduler State
  const [scheduleClients, setScheduleClients] = useState<Client[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

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
      // If there are no templates yet, seed defaults from current system messages
      if (!templatesData || templatesData.length === 0) {
        try {
          const defaults = [
            {
              name: 'Gallery Ready (SMS)',
              body:
                'Hello {client_name}, your photos are ready!\n\n' +
                'Direct Link: {app_link}{access_code}\n\n' +
                'Use code: {access_code} to unlock if the link doesn\'t open.\n\n' +
                '{business_name}',
              is_default: true as const
            },
            {
              name: 'Gallery Ready (WhatsApp)',
              body:
                'Hello {client_name}, your photos are ready!\n\n' +
                'Direct Link: {app_link}{access_code}\n\n' +
                'Use code: {access_code} to unlock if the link doesn\'t open.\n\n' +
                '{business_name}',
              is_default: false as const
            },
            {
              name: 'In-App Notification Title',
              body: 'Hello {client_name} 👋, your {gallery_name} gallery is ready!',
              is_default: false as const
            },
            {
              name: 'In-App Notification Body',
              body: 'Your photos from {gallery_name} are now available. Tap to view your gallery.',
              is_default: false as const
            }
          ];
          for (const t of defaults) {
            await SMSService.templates.create(t);
          }
          const refreshed = await SMSService.templates.list();
          setTemplates(refreshed || []);
        } catch {
          setTemplates([]);
        }
      } else {
        setTemplates(templatesData || []);
      }
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

      // 3. Resolve dynamic links from admin settings
      const links = await SMSService.utils.getAdminLinks();
      const appLinkBase = links?.access_code_delivery_link || links?.share_app_link || 'https://rork.app';

      // 4. Compile message with signature
      const baseMessage = SMSService.utils.compileTemplate(templateBody, {
        client_name: client.name,
        access_code: details.gallery?.access_code || 'PENDING',
        gallery_name: details.gallery?.name || '',
        app_link: appLinkBase,
        business_name: 'Epix Visuals Studios.co'
      });

      const finalMessage = smsSignature ? `${baseMessage}\n\n${smsSignature}` : baseMessage;
      setMessage(finalMessage);
    } catch (error) {
      console.error('Error auto-filling client data:', error);
    }
  };

  const handleSendSMS = async () => {
    if (!phoneNumber || !message) {
      Alert.alert('Missing Info', 'Please provide a phone number and message.');
      return;
    }
    // Allow sending via local gateway even if balance is 0
    const gatewayOk = await SMSService.isAvailable();
    if (!gatewayOk && balance <= 0) {
      Alert.alert('Low Balance', 'You have no SMS credits and local gateway is unavailable.');
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
      // Fallback: inform user they can send via local gateway without bundles
      Alert.alert(
        'Purchase Failed',
        (e?.message ?? 'Failed to send a request to the Edge Function') +
          '\n\nTip: You can still send SMS using the Local SMS Gateway on Android without bundles. Make sure SMS permissions are granted.'
      );
    } finally {
      setBuyingBundle(false);
    }
  };

  const handleBulkSend = async () => {
    if (selectedClients.length === 0 || !message) {
      Alert.alert('Missing Info', 'Please select clients and provide a message.');
      return;
    }
    const gatewayOk = await SMSService.isAvailable();
    if (!gatewayOk && balance < selectedClients.length) {
      Alert.alert('Insufficient Balance', `You need ${selectedClients.length} SMS credits but only have ${balance}.`);
      return;
    }

    setBulkSending(true);
    setBulkProgress({ sent: 0, total: selectedClients.length });
    let successCount = 0;

    try {
      for (let i = 0; i < selectedClients.length; i++) {
        const client = selectedClients[i];
        if (!client.phone) continue;

        try {
          const result = await SMSService.send({
            phoneNumber: client.phone,
            message,
            clientId: client.id
          });

          if (result === 'sent') successCount++;
        } catch (error) {
          console.error(`Failed to send to ${client.name}:`, error);
        }

        setBulkProgress({ sent: i + 1, total: selectedClients.length });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      }

      Alert.alert('Bulk Send Complete', `Sent to ${successCount}/${selectedClients.length} clients successfully!`);

      // Refresh data
      const [logsData, bal] = await Promise.all([SMSService.logs.list(), AdminService.sms.getBalance()]);
      setLogs(logsData || []);
      setBalance(bal || 0);

      setShowBulkModal(false);
      setSelectedClients([]);
      setMessage('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send bulk SMS');
    } finally {
      setBulkSending(false);
      setBulkProgress({ sent: 0, total: 0 });
    }
  };

  const getOptimalSendTime = () => {
    // Smart scheduling based on day/time analysis
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sunday, 6=Saturday

    // Business hours: 9 AM - 6 PM, avoid weekends
    if (day === 0 || day === 6) {
      // Weekend - schedule for Monday morning
      const monday = new Date(now);
      monday.setDate(now.getDate() + (8 - day)); // Next Monday
      monday.setHours(9, 0, 0, 0);
      return monday;
    }

    if (hour < 9) {
      // Before business hours - schedule for 9 AM today
      const today9AM = new Date(now);
      today9AM.setHours(9, 0, 0, 0);
      return today9AM;
    }

    if (hour >= 18) {
      // After business hours - schedule for 9 AM tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }

    // During business hours - schedule in 30 minutes
    const soon = new Date(now);
    soon.setMinutes(now.getMinutes() + 30);
    return soon;
  };

  const handleScheduleSMS = async () => {
    if (scheduleClients.length === 0 || !scheduleMessage) {
      Alert.alert('Missing Info', 'Please select clients and provide a message.');
      return;
    }

    const scheduledDateTime = scheduledTime ? new Date(scheduledTime) : getOptimalSendTime();

    if (scheduledDateTime <= new Date()) {
      Alert.alert('Invalid Time', 'Scheduled time must be in the future.');
      return;
    }

    setScheduling(true);
    try {
      // For now, we'll store scheduled messages locally
      // In a production app, this would be stored on the server
      const scheduledSMS = {
        id: `scheduled_${Date.now()}`,
        clients: scheduleClients,
        message: scheduleMessage,
        scheduledFor: scheduledDateTime.toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Store in AsyncStorage for demo (would be server-side in production)
      const existing = await AsyncStorage.getItem('scheduled_sms') || '[]';
      const scheduled = JSON.parse(existing);
      scheduled.push(scheduledSMS);
      await AsyncStorage.setItem('scheduled_sms', JSON.stringify(scheduled));

      Alert.alert('Scheduled', `SMS scheduled for ${scheduledDateTime.toLocaleString()}`);

      setShowScheduler(false);
      setScheduleClients([]);
      setScheduleMessage('');
      setScheduledTime('');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule SMS');
    } finally {
      setScheduling(false);
    }
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
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
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

  const handleApplyTemplate = async (template: SMSTemplate) => {
    const templateBody = template.body;
    const clientName = selectedClient?.name || 'Client';

    const links = await SMSService.utils.getAdminLinks();
    const appLinkBase = links?.access_code_delivery_link || links?.share_app_link || 'https://rork.app';
    const baseMessage = SMSService.utils.compileTemplate(templateBody, {
      client_name: clientName,
      access_code: 'CODE',
      gallery_name: 'Gallery',
      app_link: appLinkBase,
      business_name: 'Epix Visuals Studios.co'
    });

    const finalMessage = smsSignature ? `${baseMessage}\n\n${smsSignature}` : baseMessage;
    setMessage(finalMessage);
    setShowTemplateModal(false);
  };

  const toggleClientSelection = (client: Client) => {
    setSelectedClients(prev => {
      const exists = prev.find(c => c.id === client.id);
      if (exists) {
        return prev.filter(c => c.id !== client.id);
      } else {
        return [...prev, client];
      }
    });
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
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} color={activeTab === 'analytics' ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>Analytics</Text>
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
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>SMS Signature Branding</Text>
                  <Text style={styles.label}>Custom Signature (added to all SMS)</Text>
                  <TextInput
                    style={styles.input}
                    value={smsSignature}
                    onChangeText={setSmsSignature}
                    placeholder="e.g. - Sent via Epix Visuals Studio"
                    multiline
                    maxLength={50}
                  />
                  <Text style={styles.hint}>
                    Max 50 characters. Added to end of all SMS messages.
                  </Text>
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
                    </View>
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

                  <View style={styles.rowBetween}>
                    <Pressable style={styles.secondaryBtn} onPress={() => setShowBulkModal(true)}>
                      <Text style={styles.secondaryBtnText}>Bulk Send</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryBtn} onPress={() => setShowScheduler(true)}>
                      <Text style={styles.secondaryBtnText}>Schedule</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryBtn} onPress={handleSendSMS} disabled={sending}>
                      <Text style={styles.secondaryBtnText}>Send Test SMS</Text>
                    </Pressable>
                  </View>
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

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>SMS Analytics Dashboard</Text>

                  {/* Key Metrics */}
                  <View style={analyticsStyles.metricsGrid}>
                    <View style={analyticsStyles.metricCard}>
                      <Text style={analyticsStyles.metricValue}>{balance}</Text>
                      <Text style={analyticsStyles.metricLabel}>SMS Balance</Text>
                      <View style={[analyticsStyles.metricIndicator, balance > 50 && analyticsStyles.metricIndicatorGood]} />
                    </View>

                    <View style={analyticsStyles.metricCard}>
                      <Text style={analyticsStyles.metricValue}>{sentToday}</Text>
                      <Text style={analyticsStyles.metricLabel}>Sent Today</Text>
                      <View style={[analyticsStyles.metricIndicator, sentToday > 0 && analyticsStyles.metricIndicatorGood]} />
                    </View>

                    <View style={analyticsStyles.metricCard}>
                      <Text style={analyticsStyles.metricValue}>{failedToday}</Text>
                      <Text style={analyticsStyles.metricLabel}>Failed Today</Text>
                      <View style={[analyticsStyles.metricIndicator, failedToday === 0 && analyticsStyles.metricIndicatorGood]} />
                    </View>

                    <View style={analyticsStyles.metricCard}>
                      <Text style={analyticsStyles.metricValue}>{queueRemaining}</Text>
                      <Text style={analyticsStyles.metricLabel}>Queued</Text>
                      <View style={[analyticsStyles.metricIndicator, queueRemaining < 5 && analyticsStyles.metricIndicatorGood]} />
                    </View>
                  </View>

                  {/* Success Rate Chart */}
                  <View style={analyticsStyles.chartCard}>
                    <Text style={analyticsStyles.chartTitle}>Success Rate</Text>
                    <View style={analyticsStyles.successRateContainer}>
                      <View style={analyticsStyles.successRateBar}>
                        <View
                          style={[
                            analyticsStyles.successRateFill,
                            { width: `${logs.length > 0 ? Math.round((logs.filter(l => l.status === 'sent').length / logs.length) * 100) : 0}%` }
                          ]}
                        />
                      </View>
                      <Text style={analyticsStyles.successRateText}>
                        {logs.length > 0 ? Math.round((logs.filter(l => l.status === 'sent').length / logs.length) * 100) : 0}% Success
                      </Text>
                    </View>
                  </View>

                  {/* Recent Activity */}
                  <View style={analyticsStyles.chartCard}>
                    <Text style={analyticsStyles.chartTitle}>Recent Activity (Last 7 Days)</Text>
                    <View style={analyticsStyles.activityChart}>
                      {Array.from({ length: 7 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - (6 - i));
                        const dayLogs = logs.filter(l => {
                          const logDate = new Date(l.created_at);
                          return logDate.toDateString() === date.toDateString();
                        });
                        const sent = dayLogs.filter(l => l.status === 'sent').length;
                        const height = Math.max(sent * 8, 20); // Minimum height of 20
                        return (
                          <View key={i} style={analyticsStyles.activityBar}>
                            <View style={[analyticsStyles.activityBarFill, { height }]} />
                            <Text style={analyticsStyles.activityBarLabel}>
                              {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Top Clients */}
                  <View style={analyticsStyles.chartCard}>
                    <Text style={analyticsStyles.chartTitle}>Top Clients by SMS</Text>
                    {(() => {
                      const clientStats = logs.reduce((acc, log) => {
                        if (log.clients?.name) {
                          acc[log.clients.name] = (acc[log.clients.name] || 0) + 1;
                        }
                        return acc;
                      }, {} as Record<string, number>);

                      const topClients = Object.entries(clientStats)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5);

                      return topClients.map(([name, count], index) => (
                        <View key={name} style={analyticsStyles.clientStat}>
                          <Text style={analyticsStyles.clientStatRank}>#{index + 1}</Text>
                          <Text style={analyticsStyles.clientStatName} numberOfLines={1}>{name}</Text>
                          <Text style={analyticsStyles.clientStatCount}>{count} SMS</Text>
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              </ScrollView>
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

      {/* Bulk SMS Modal */}
      <Modal visible={showBulkModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk SMS Send</Text>
            <Pressable onPress={() => setShowBulkModal(false)}>
              <X size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {bulkSending ? (
            <View style={bulkStyles.bulkProgress}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={bulkStyles.bulkProgressText}>
                Sending {bulkProgress.sent}/{bulkProgress.total} messages...
              </Text>
              <View style={bulkStyles.progressBar}>
                <View
                  style={[
                    bulkStyles.progressFill,
                    { width: `${bulkProgress.total > 0 ? (bulkProgress.sent / bulkProgress.total) * 100 : 0}%` }
                  ]}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={bulkStyles.bulkSummary}>
                <Text style={bulkStyles.bulkSummaryText}>
                  Selected: {selectedClients.length} clients
                </Text>
                <Text style={bulkStyles.bulkSummaryText}>
                  Required SMS: {selectedClients.length}
                </Text>
                <Text style={bulkStyles.bulkSummaryText}>
                  Available Balance: {balance}
                </Text>
                {selectedClients.length > balance && (
                  <Text style={bulkStyles.bulkWarning}>
                    ⚠️ Insufficient balance for bulk send
                  </Text>
                )}
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
                renderItem={({ item }) => {
                  const isSelected = selectedClients.some(c => c.id === item.id);
                  return (
                    <Pressable
                      style={[bulkStyles.bulkClientItem, isSelected && bulkStyles.bulkClientSelected]}
                      onPress={() => toggleClientSelection(item)}
                    >
                      <View style={bulkStyles.bulkClientInfo}>
                        <Text style={bulkStyles.bulkClientName}>{item.name}</Text>
                        <Text style={bulkStyles.bulkClientPhone}>{item.phone || 'No phone'}</Text>
                      </View>
                      <View style={[bulkStyles.bulkCheckBox, isSelected && bulkStyles.bulkCheckBoxSelected]}>
                        {isSelected && <Check size={16} color="#fff" />}
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={bulkStyles.emptyState}>
                    <Text style={bulkStyles.emptyText}>No clients found</Text>
                  </View>
                }
              />

              <View style={bulkStyles.bulkActions}>
                <Pressable
                  style={[bulkStyles.bulkSendBtn, (selectedClients.length === 0 || selectedClients.length > balance) && styles.disabledBtn]}
                  onPress={handleBulkSend}
                  disabled={selectedClients.length === 0 || selectedClients.length > balance}
                >
                  <Text style={bulkStyles.bulkSendBtnText}>
                    Send to {selectedClients.length} Clients
                  </Text>
                </Pressable>
              </View>
            </>
          )}
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
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, margin: 20, marginTop: 0,
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, gap: 8
  },
  searchInput: { flex: 1, height: 24 },
  clientItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  clientName: { fontWeight: '600', fontSize: 16 },
  clientPhone: { color: Colors.textMuted },

  centeredModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { width: '85%', backgroundColor: Colors.card, borderRadius: 16, padding: 20 },
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

// Analytics Styles
const analyticsStyles = StyleSheet.create({
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  metricIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    marginTop: 8,
  },
  metricIndicatorGood: {
    backgroundColor: Colors.success,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  successRateContainer: {
    alignItems: 'center',
  },
  successRateBar: {
    width: '100%',
    height: 12,
    backgroundColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  successRateFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 6,
  },
  successRateText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  activityChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingVertical: 20,
  },
  activityBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  activityBarFill: {
    width: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 4,
    minHeight: 20,
  },
  activityBarLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  clientStat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clientStatRank: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold,
    width: 30,
  },
  clientStatName: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  clientStatCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});

// Bulk SMS Styles
const bulkStyles = StyleSheet.create({
  bulkSummary: {
    backgroundColor: Colors.card,
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bulkSummaryText: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  bulkWarning: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
    marginTop: 8,
  },
  bulkClientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bulkClientSelected: {
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  bulkClientInfo: {
    flex: 1,
  },
  bulkClientName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bulkClientPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bulkCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkCheckBoxSelected: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  bulkActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  bulkSendBtn: {
    backgroundColor: Colors.gold,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bulkSendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bulkProgress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  bulkProgressText: {
    fontSize: 16,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
