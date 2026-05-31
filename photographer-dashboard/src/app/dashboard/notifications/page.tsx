'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotificationsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [sentHistory, setSentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: clientData }, { data: notifData }] = await Promise.all([
      supabase.from('clients').select('id, name, phone, user_id').eq('owner_admin_id', user.id).order('name'),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);

    setClients(clientData || []);
    setSentHistory(notifData || []);
    setLoading(false);
  };

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedClients(clients.map((c) => c.user_id).filter(Boolean));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('Title and message are required.'); return; }
    if (selectedClients.length === 0) { setError('Select at least one client.'); return; }

    setError(''); setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert notifications for each selected client
      const notifications = selectedClients.map((userId) => ({
        user_id: userId,
        type: 'admin_broadcast',
        title,
        body,
        data: { from_admin: user!.id },
        read: false,
      }));

      const { error: notifError } = await supabase.from('notifications').insert(notifications);
      if (notifError) throw notifError;

      // Send SMS if enabled
      if (sendSms) {
        const clientsToSms = clients.filter((c) => selectedClients.includes(c.user_id) && c.phone);
        for (const client of clientsToSms) {
          await supabase.functions.invoke('send_sms', {
            body: { phoneNumber: client.phone, message: `${title}: ${body}` },
          }).catch(() => {}); // Don't fail if SMS fails
        }
      }

      setSuccess(`Notification sent to ${selectedClients.length} client${selectedClients.length !== 1 ? 's' : ''}!`);
      setTitle(''); setBody(''); setSelectedClients([]);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Send Notifications</h1>
        <p className="text-gray-400 mt-1">Send in-app notifications and SMS to your clients</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <form onSubmit={handleSend} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold">Compose Message</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="Your gallery is ready!" required />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Message *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 resize-none"
              placeholder="Hi! Your photos are ready to view..." required />
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="sms" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)}
              className="w-4 h-4 accent-yellow-500" />
            <label htmlFor="sms" className="text-sm text-gray-300">Also send as SMS (uses SMS credits)</label>
          </div>

          <div className="bg-[#0A0A0E] border border-white/5 rounded-xl p-3 text-xs text-gray-500">
            📱 In-app notification: free · 💬 SMS: 1 credit per client
          </div>

          <button type="submit" disabled={sending || selectedClients.length === 0}
            className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
            {sending ? 'Sending...' : `🔔 Send to ${selectedClients.length} client${selectedClients.length !== 1 ? 's' : ''}`}
          </button>
        </form>

        {/* Client selector */}
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Select Clients</h2>
            <button onClick={selectAll} className="text-xs text-yellow-400 hover:underline">Select all</button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No clients yet.</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {clients.map((client) => (
                <label key={client.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.user_id)}
                    onChange={() => toggleClient(client.user_id)}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <div>
                    <p className="text-sm font-medium">{client.name}</p>
                    {client.phone && <p className="text-xs text-gray-500">{client.phone}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sent history */}
      <div>
        <h2 className="text-xl font-bold mb-4">Recent Notifications</h2>
        <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
          {sentHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No notifications sent yet.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {sentHistory.map((n) => (
                <div key={n.id} className="px-6 py-4">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{n.body}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    {new Date(n.created_at).toLocaleString('en-KE')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
