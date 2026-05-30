/**
 * ChatWrapper — decides whether to show the thread list or the single chat.
 *
 * Rules:
 * - 0 or 1 linked photographer → go straight to ChatScreen (existing behaviour)
 * - 2+ linked photographers → show ChatThreadList first; tapping a thread
 *   opens ChatScreen with that photographer's adminId passed as a param
 */
import { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ChatThreadList, { type AdminThread } from '@/components/ChatThreadList';
import ChatScreen from './index';

export default function ChatWrapper() {
  const { isDemoMode } = useAuth();
  const params = useLocalSearchParams<{ adminId?: string }>();

  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [selectedThread, setSelectedThread] = useState<AdminThread | null>(null);

  // If a specific adminId was passed (e.g. from a notification), skip the list
  const forcedAdminId = params.adminId ?? null;

  useEffect(() => {
    if (isDemoMode || forcedAdminId) {
      setAdminCount(1); // skip thread list
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAdminCount(0); return; }

      const { count } = await supabase
        .from('clients')
        .select('owner_admin_id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setAdminCount(count ?? 0);
    })();
  }, [isDemoMode, forcedAdminId]);

  // Still loading
  if (adminCount === null) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  // Single photographer or forced adminId — render existing ChatScreen unchanged
  if (adminCount <= 1 || forcedAdminId || selectedThread) {
    return <ChatScreen />;
  }

  // Multiple photographers — show thread list
  return (
    <ChatThreadList
      onSelectThread={(thread) => setSelectedThread(thread)}
    />
  );
}
