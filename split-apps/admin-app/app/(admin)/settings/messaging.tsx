import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  MessageSquare,
  Send,
  Clock,
  BarChart3,
  Plus,
  X,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit3,
  FileText,
  Users,
  DollarSign,
  Zap,
  Smartphone,
  ChevronDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Settings,
  Copy,
  Star,
  TrendingUp,
  Filter,
} from 'lucide-react-native'
import Colors from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import SMSService from '@/services/sms'
import AdminService from '@/services/admin'

let LocalSmsGateway: any = null
try {
  LocalSmsGateway = require('@lenzart/local-sms-gateway').default
} catch {}

const TABS = [
  { key: 'compose', label: 'Compose', icon: MessageSquare },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'history', label: 'History', icon: Clock },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

const AMOUNT_CHIPS = [100, 250, 500]

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  sent: { color: '#10B981', icon: CheckCircle },
  delivered: { color: '#10B981', icon: CheckCircle },
  failed: { color: '#EF4444', icon: XCircle },
  pending: { color: '#F59E0B', icon: AlertCircle },
  queued: { color: '#6366F1', icon: Clock },
}

export default function MessagingScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('compose')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [gatewayStatus, setGatewayStatus] = useState<any>(null)
  const [balance, setBalance] = useState(0)
  const [signature, setSignature] = useState('')
  const [templates, setTemplates] = useState<any[]>([])
  const [smsLogs, setSmsLogs] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])

  const [recipientModalVisible, setRecipientModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [buyModalVisible, setBuyModalVisible] = useState(false)
  const [buyPhoneNumber, setBuyPhoneNumber] = useState('')
  const [buyAmount, setBuyAmount] = useState(100)
  const [buyCustomAmount, setBuyCustomAmount] = useState('')
  const [buying, setBuying] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [analyticsData, setAnalyticsData] = useState<any>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [templatesRes, logsRes, clientsRes] = await Promise.all([
        supabase.from('sms_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(100),
        AdminService.getClients(),
      ])
      setTemplates(templatesRes.data || [])
      setSmsLogs(logsRes.data || [])
      setClients(clientsRes || [])

      if (LocalSmsGateway) {
        try {
          const status = await LocalSmsGateway.getStatus()
          setGatewayStatus(status)
          setBalance(status.balance || 0)
        } catch {
          setGatewayStatus({ online: false, balance: 0 })
        }
      }

      const defaultSig = templates.find((t: any) => t.is_default)
      if (defaultSig) setSignature(defaultSig.signature || '')
    } catch (err) {
      console.error('Failed to load messaging data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (activeTab === 'analytics') {
      computeAnalytics()
    }
  }, [activeTab, smsLogs, gatewayStatus])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const computeAnalytics = () => {
    const today = new Date().toISOString().split('T')[0]
    const todayLogs = smsLogs.filter((l: any) => l.created_at?.startsWith(today))
    const sentToday = todayLogs.filter((l: any) => l.status === 'sent' || l.status === 'delivered').length
    const failedToday = todayLogs.filter((l: any) => l.status === 'failed').length
    const queued = smsLogs.filter((l: any) => l.status === 'queued' || l.status === 'pending').length
    const total = smsLogs.length
    const successCount = smsLogs.filter((l: any) => l.status === 'sent' || l.status === 'delivered').length
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0.0'

    const last7Days: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const count = smsLogs.filter((l: any) => l.created_at?.startsWith(dateStr)).length
      last7Days.push({ date: dateStr, count })
    }

    const clientCounts: Record<string, number> = {}
    smsLogs.forEach((l: any) => {
      const key = l.client_name || l.phone_number || 'Unknown'
      clientCounts[key] = (clientCounts[key] || 0) + 1
    })
    const topClients = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    setAnalyticsData({ sentToday, failedToday, queued, successRate, last7Days, topClients, balance })
  }

  const sendSMS = async (bulk = false) => {
    if (!messageText.trim()) {
      Alert.alert('Error', 'Please enter a message')
      return
    }
    if (!phoneNumber.trim() && !selectedClient) {
      Alert.alert('Error', 'Please select a recipient')
      return
    }

    try {
      setSending(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const recipient = selectedClient?.phone || phoneNumber
      const recipientName = selectedClient?.name || 'Direct'

      await SMSService.send({
        phoneNumber: recipient,
        message: messageText + (signature ? `\n\n${signature}` : ''),
        clientId: selectedClient?.id || undefined,
      })

      await supabase.from('sms_logs').insert({
        phone_number: recipient,
        client_name: recipientName,
        client_id: selectedClient?.id || null,
        message: messageText,
        signature,
        status: 'sent',
        provider: 'local_gateway',
        cost: 0,
        user_id: user?.id,
      })

      Alert.alert('Success', 'SMS sent successfully')
      setMessageText('')
      setSelectedClient(null)
      setPhoneNumber('')
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to send SMS')
    } finally {
      setSending(false)
    }
  }

  const buyBundle = async () => {
    const amount = buyCustomAmount ? parseInt(buyCustomAmount) : buyAmount
    if (!buyPhoneNumber.trim()) {
      Alert.alert('Error', 'Enter a phone number')
      return
    }
    if (amount < 1) {
      Alert.alert('Error', 'Enter a valid amount')
      return
    }

    try {
      setBuying(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      if (LocalSmsGateway) {
        await LocalSmsGateway.buyBundle({ phone: buyPhoneNumber, amount })
      }
      Alert.alert('Success', `Purchased ${amount} SMS credits`)
      setBuyModalVisible(false)
      setBuyPhoneNumber('')
      setBuyAmount(100)
      setBuyCustomAmount('')
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to buy bundle')
    } finally {
      setBuying(false)
    }
  }

  const saveTemplate = async () => {
    if (!templateName.trim() || !templateBody.trim()) {
      Alert.alert('Error', 'Name and body are required')
      return
    }

    try {
      if (isDefaultTemplate) {
        await supabase.from('sms_templates').update({ is_default: false }).eq('is_default', true)
      }

      const payload = {
        name: templateName,
        body: templateBody,
        is_default: isDefaultTemplate,
        user_id: user?.id,
      }

      if (editingTemplate) {
        await supabase.from('sms_templates').update(payload).eq('id', editingTemplate.id)
      } else {
        await supabase.from('sms_templates').insert(payload)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setTemplateModalVisible(false)
      resetTemplateForm()
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to save template')
    }
  }

  const deleteTemplate = async (id: string) => {
    Alert.alert('Delete Template', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('sms_templates').delete().eq('id', id)
          await loadData()
        },
      },
    ])
  }

  const resetTemplateForm = () => {
    setTemplateName('')
    setTemplateBody('')
    setIsDefaultTemplate(false)
    setEditingTemplate(null)
  }

  const openTemplateEditor = (template?: any) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateName(template.name)
      setTemplateBody(template.body)
      setIsDefaultTemplate(template.is_default || false)
    } else {
      resetTemplateForm()
    }
    setTemplateModalVisible(true)
  }

  const applyTemplate = (template: any) => {
    setMessageText(template.body)
    setTemplateModalVisible(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients
    const q = searchQuery.toLowerCase()
    return clients.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }, [clients, searchQuery])

  const charCount = messageText.length + (signature ? signature.length + 2 : 0)
  const maxChars = 160

  const renderGatewayStatus = () => {
    if (!gatewayStatus) return null
    return (
      <View style={styles.gatewayCard}>
        <View style={styles.gatewayHeader}>
          <View style={[styles.statusDot, { backgroundColor: gatewayStatus.online ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.gatewayTitle}>Gateway {gatewayStatus.online ? 'Online' : 'Offline'}</Text>
          <TouchableOpacity onPress={() => LocalSmsGateway?.refresh?.()} style={styles.refreshBtn}>
            <RefreshCw size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.gatewayStats}>
          <View style={styles.gatewayStat}>
            <Text style={styles.gatewayStatValue}>{balance}</Text>
            <Text style={styles.gatewayStatLabel}>Balance</Text>
          </View>
          <View style={styles.gatewayStat}>
            <Text style={styles.gatewayStatValue}>{gatewayStatus.queue || 0}</Text>
            <Text style={styles.gatewayStatLabel}>Queued</Text>
          </View>
          <View style={styles.gatewayStat}>
            <Text style={styles.gatewayStatValue}>{gatewayStatus.sentToday || 0}</Text>
            <Text style={styles.gatewayStatLabel}>Sent Today</Text>
          </View>
          <View style={styles.gatewayStat}>
            <Text style={styles.gatewayStatValue}>{gatewayStatus.failedToday || 0}</Text>
            <Text style={styles.gatewayStatLabel}>Failed</Text>
          </View>
        </View>
        {gatewayStatus.simStatus && (
          <View style={styles.simRow}>
            <Smartphone size={14} color={Colors.textSecondary} />
            <Text style={styles.simText}>SIM: {gatewayStatus.simStatus}</Text>
          </View>
        )}
      </View>
    )
  }

  const renderComposeTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {renderGatewayStatus()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SMS Signature</Text>
        <TextInput
          style={styles.input}
          value={signature}
          onChangeText={setSignature}
          placeholder="Your signature..."
          placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Buy SMS Bundle</Text>
          <TouchableOpacity onPress={() => setBuyModalVisible(true)} style={styles.buyBtn}>
            <Zap size={14} color={Colors.primary} />
            <Text style={styles.buyBtnText}>Buy Credits</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recipient</Text>
        <TouchableOpacity style={styles.recipientSelector} onPress={() => setRecipientModalVisible(true)}>
          {selectedClient ? (
            <View style={styles.selectedRecipient}>
              <Users size={18} color={Colors.primary} />
              <View style={styles.recipientInfo}>
                <Text style={styles.recipientName}>{selectedClient.name}</Text>
                <Text style={styles.recipientPhone}>{selectedClient.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedClient(null)}>
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Users size={18} color={Colors.textSecondary} />
              <Text style={styles.recipientPlaceholder}>Select a client or enter phone number</Text>
              <ChevronDown size={18} color={Colors.textSecondary} />
            </>
          )}
        </TouchableOpacity>

        {!selectedClient && (
          <View style={styles.phoneInputRow}>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Message</Text>
          <TouchableOpacity onPress={() => { setEditingTemplate(null); setTemplateModalVisible(true) }}>
            <Text style={styles.applyTemplateText}>Templates</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type your message..."
          placeholderTextColor={Colors.textSecondary}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.charCountRow}>
          <Text style={[styles.charCount, charCount > maxChars && styles.charCountOver]}>
            {charCount}/{maxChars}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={() => sendSMS(false)}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
          <Text style={styles.sendBtnText}>Send SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bulkBtn, sending && styles.sendBtnDisabled]}
          onPress={() => sendSMS(true)}
          disabled={sending}
        >
          <Users size={18} color={Colors.primary} />
          <Text style={styles.bulkBtnText}>Bulk Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scheduleBtn}
          onPress={() => setScheduleModalVisible(true)}
        >
          <Calendar size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderTemplatesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Templates</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openTemplateEditor()}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Template</Text>
        </TouchableOpacity>
      </View>

      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Templates</Text>
          <Text style={styles.emptySubtitle}>Create templates to speed up messaging</Text>
        </View>
      ) : (
        templates.map((template: any) => (
          <TouchableOpacity
            key={template.id}
            style={styles.templateCard}
            onPress={() => applyTemplate(template)}
          >
            <View style={styles.templateHeader}>
              <View style={styles.templateNameRow}>
                <Text style={styles.templateName}>{template.name}</Text>
                {template.is_default && (
                  <View style={styles.defaultBadge}>
                    <Star size={10} color={Colors.primary} />
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <View style={styles.templateActions}>
                <TouchableOpacity onPress={() => openTemplateEditor(template)} style={styles.templateActionBtn}>
                  <Edit3 size={14} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteTemplate(template.id)} style={styles.templateActionBtn}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.templatePreview} numberOfLines={3}>
              {template.body}
            </Text>
            <View style={styles.templateHintRow}>
              <Text style={styles.variableHint}>Variables: {'{client_name}'}, {'{access_code}'}, {'{gallery_name}'}, {'{app_link}'}, {'{business_name}'}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderHistoryTab = () => (
    <FlatList
      data={smsLogs}
      keyExtractor={(item: any) => item.id}
      style={styles.tabContent}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Clock size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No SMS History</Text>
          <Text style={styles.emptySubtitle}>Sent messages will appear here</Text>
        </View>
      }
      renderItem={({ item }: { item: any }) => {
        const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
        const StatusIcon = statusConf.icon
        return (
          <View style={styles.logCard}>
            <View style={styles.logLeft}>
              <View style={[styles.logStatusIcon, { backgroundColor: statusConf.color + '20' }]}>
                <StatusIcon size={14} color={statusConf.color} />
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logClient}>{item.client_name || item.phone_number}</Text>
                <Text style={styles.logMessage} numberOfLines={1}>{item.message}</Text>
                <Text style={styles.logTimestamp}>
                  {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            <View style={styles.logRight}>
              <Text style={[styles.logStatus, { color: statusConf.color }]}>{item.status}</Text>
              <Text style={styles.logProvider}>{item.provider}</Text>
              {item.cost > 0 && <Text style={styles.logCost}>${item.cost.toFixed(2)}</Text>}
            </View>
          </View>
        )
      }}
    />
  )

  const renderAnalyticsTab = () => {
    if (!analyticsData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )
    }

    const maxChartValue = Math.max(...analyticsData.last7Days.map((d: any) => d.count), 1)

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#10B98120' }]}>
              <DollarSign size={18} color="#10B981" />
            </View>
            <Text style={styles.metricValue}>{analyticsData.balance}</Text>
            <Text style={styles.metricLabel}>Balance</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#6366F120' }]}>
              <ArrowUpRight size={18} color="#6366F1" />
            </View>
            <Text style={styles.metricValue}>{analyticsData.sentToday}</Text>
            <Text style={styles.metricLabel}>Sent Today</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#EF444420' }]}>
              <ArrowDownRight size={18} color="#EF4444" />
            </View>
            <Text style={styles.metricValue}>{analyticsData.failedToday}</Text>
            <Text style={styles.metricLabel}>Failed Today</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#F59E0B20' }]}>
              <Clock size={18} color="#F59E0B" />
            </View>
            <Text style={styles.metricValue}>{analyticsData.queued}</Text>
            <Text style={styles.metricLabel}>Queued</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Success Rate</Text>
          <View style={styles.successRateCard}>
            <View style={styles.successRateHeader}>
              <Text style={styles.successRateValue}>{analyticsData.successRate}%</Text>
              <TrendingUp size={16} color="#10B981" />
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(parseFloat(analyticsData.successRate), 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartBars}>
              {analyticsData.last7Days.map((day: any, i: number) => (
                <View key={i} style={styles.chartBarWrapper}>
                  <View style={styles.chartBarContainer}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${(day.count / maxChartValue) * 100}%`,
                          backgroundColor: Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarLabel}>
                    {new Date(day.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0)}
                  </Text>
                  <Text style={styles.chartBarValue}>{day.count}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Clients</Text>
          {analyticsData.topClients.length === 0 ? (
            <View style={styles.emptyStateSmall}>
              <Text style={styles.emptySubtitle}>No data yet</Text>
            </View>
          ) : (
            analyticsData.topClients.map((client: any, i: number) => (
              <View key={i} style={styles.topClientRow}>
                <View style={styles.topClientRank}>
                  <Text style={styles.topClientRankText}>{i + 1}</Text>
                </View>
                <Text style={styles.topClientName}>{client.name}</Text>
                <Text style={styles.topClientCount}>{client.count} SMS</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Messaging',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => {
                setActiveTab(tab.key)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Icon size={16} color={isActive ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          {activeTab === 'compose' && renderComposeTab()}
          {activeTab === 'templates' && renderTemplatesTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
        </>
      )}

      <Modal visible={recipientModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <TouchableOpacity onPress={() => setRecipientModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Search size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search clients..."
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            <FlatList
              data={filteredClients}
              keyExtractor={(item: any) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No clients found</Text>
              }
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.clientItem}
                  onPress={() => {
                    setSelectedClient(item)
                    setPhoneNumber(item.phone || '')
                    setRecipientModalVisible(false)
                    setSearchQuery('')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{item.name?.charAt(0) || '?'}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    <Text style={styles.clientPhone}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={templateModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTemplate ? 'Edit Template' : 'Templates'}</Text>
              <TouchableOpacity onPress={() => { setTemplateModalVisible(false); resetTemplateForm() }}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {editingTemplate !== null || templateName ? (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.fieldLabel}>Template Name</Text>
                <TextInput
                  style={styles.input}
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="e.g. Welcome Message"
                  placeholderTextColor={Colors.textSecondary}
                />
                <Text style={styles.fieldLabel}>Message Body</Text>
                <TextInput
                  style={[styles.input, styles.templateBodyInput]}
                  value={templateBody}
                  onChangeText={setTemplateBody}
                  placeholder="Type your template..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.variableHints}>
                  <Text style={styles.variableHintTitle}>Available Variables:</Text>
                  <Text style={styles.variableHintItem}>{'{client_name}'} — Client name</Text>
                  <Text style={styles.variableHintItem}>{'{access_code}'} — Access code</Text>
                  <Text style={styles.variableHintItem}>{'{gallery_name}'} — Gallery name</Text>
                  <Text style={styles.variableHintItem}>{'{app_link}'} — App link</Text>
                  <Text style={styles.variableHintItem}>{'{business_name}'} — Business name</Text>
                </View>
                <View style={styles.defaultToggle}>
                  <Text style={styles.defaultToggleLabel}>Set as Default</Text>
                  <TouchableOpacity
                    style={[styles.toggle, isDefaultTemplate && styles.toggleActive]}
                    onPress={() => setIsDefaultTemplate(!isDefaultTemplate)}
                  >
                    {isDefaultTemplate && <CheckCircle size={14} color="#fff" />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.saveTemplateBtn} onPress={saveTemplate}>
                  <Text style={styles.saveTemplateBtnText}>Save Template</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(item: any) => item.id}
                style={styles.modalBody}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <FileText size={36} color={Colors.textSecondary} />
                    <Text style={styles.emptyTitle}>No Templates</Text>
                  </View>
                }
                renderItem={({ item }: { item: any }) => (
                  <TouchableOpacity
                    style={styles.templateCard}
                    onPress={() => { setEditingTemplate(item); setTemplateName(item.name); setTemplateBody(item.body); setIsDefaultTemplate(item.is_default || false) }}
                  >
                    <View style={styles.templateHeader}>
                      <View style={styles.templateNameRow}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        {item.is_default && <View style={styles.defaultBadge}><Star size={10} color={Colors.primary} /><Text style={styles.defaultBadgeText}>Default</Text></View>}
                      </View>
                    </View>
                    <Text style={styles.templatePreview} numberOfLines={2}>{item.body}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={buyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buy SMS Credits</Text>
              <TouchableOpacity onPress={() => setBuyModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={buyPhoneNumber}
                onChangeText={setBuyPhoneNumber}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
              />
              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={styles.chipsRow}>
                {AMOUNT_CHIPS.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.chip, buyAmount === amt && !buyCustomAmount && styles.chipActive]}
                    onPress={() => { setBuyAmount(amt); setBuyCustomAmount('') }}
                  >
                    <Text style={[styles.chipText, buyAmount === amt && !buyCustomAmount && styles.chipTextActive]}>{amt}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[styles.input, styles.customChipInput]}
                  value={buyCustomAmount}
                  onChangeText={setBuyCustomAmount}
                  placeholder="Custom"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, buying && styles.sendBtnDisabled]}
                onPress={buyBundle}
                disabled={buying}
              >
                {buying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Zap size={18} color="#fff" />
                )}
                <Text style={styles.sendBtnText}>Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule SMS</Text>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={scheduleDate}
                onChangeText={setScheduleDate}
                placeholder="2024-01-15"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.fieldLabel}>Time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={scheduleTime}
                onChangeText={setScheduleTime}
                placeholder="09:00"
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => {
                  if (!scheduleDate || !scheduleTime) {
                    Alert.alert('Error', 'Enter date and time')
                    return
                  }
                  Alert.alert('Scheduled', `SMS scheduled for ${scheduleDate} at ${scheduleTime}`)
                  setScheduleModalVisible(false)
                  setScheduleDate('')
                  setScheduleTime('')
                }}
              >
                <Calendar size={18} color="#fff" />
                <Text style={styles.sendBtnText}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gatewayCard: {
    backgroundColor: Colors.card,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  gatewayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  gatewayStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gatewayStat: {
    alignItems: 'center',
  },
  gatewayStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  gatewayStatLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  simRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  simText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },
  messageInput: {
    height: 120,
    paddingTop: 12,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  charCountOver: {
    color: '#EF4444',
  },
  recipientSelector: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  recipientPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  recipientPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  phoneInputRow: {
    marginTop: 8,
  },
  phoneInput: {
    flex: 1,
  },
  applyTemplateText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  sendBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bulkBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bulkBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  templateCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  templateActionBtn: {
    padding: 4,
  },
  templatePreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  templateHintRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  variableHint: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
  },
  logLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  logStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logClient: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  logMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logTimestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  logStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logProvider: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  logCost: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  successRateCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
  },
  successRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  successRateValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarContainer: {
    height: 100,
    width: 20,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  chartBarValue: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  topClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  topClientRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topClientRankText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  topClientName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  topClientCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalBody: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    margin: 16,
    marginBottom: 0,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  clientPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyListText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    paddingVertical: 30,
    fontSize: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  templateBodyInput: {
    height: 140,
    paddingTop: 12,
    marginBottom: 12,
  },
  variableHints: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  variableHintTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  variableHintItem: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  defaultToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  defaultToggleLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  saveTemplateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveTemplateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextActive: {
    color: '#fff',
  },
  customChipInput: {
    width: 80,
    textAlign: 'center',
  },
})
