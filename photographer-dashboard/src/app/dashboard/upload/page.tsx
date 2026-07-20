'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { compressImage, getRecommendedPreset, formatFileSize } from '@/lib/compression';

type UploadFile = {
  file: File;
  id: string;
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  compressedSize?: number;
  originalSize?: number;
};

type Client = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

type DeliveryMethod = 'sms' | 'whatsapp' | 'email' | 'in_app';

const SHOOT_TYPES = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion', 'Other'];
const CONCURRENCY = 3;

export default function UploadPage() {
  // Client state
  const [clients, setClients] = useState<Client[]>([]);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [clientData, setClientData] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [checkingClient, setCheckingClient] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Gallery config
  const [galleryName, setGalleryName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [price, setPrice] = useState('');
  const [shootType, setShootType] = useState('Wedding');
  const [isPaid, setIsPaid] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['in_app']);
  const [sendNotification, setSendNotification] = useState(true);
  const [autoSms, setAutoSms] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  // Files
  const [files, setFiles] = useState<UploadFile[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [step, setStep] = useState<'setup' | 'uploading' | 'done'>('setup');
  const [creating, setCreating] = useState(false);
  const [totalUploaded, setTotalUploaded] = useState(0);
  const [galleryId, setGalleryId] = useState('');
  const [finalAccessCode, setFinalAccessCode] = useState('');
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  useEffect(() => { loadClients(); }, []);

  // Auto-generate access code from gallery title prefix
  useEffect(() => {
    if (galleryName.trim()) {
      const prefix = galleryName.split(' ')[0].toUpperCase().slice(0, 3);
      const digits = Math.floor(1000 + Math.random() * 9000);
      setAccessCode(`${prefix}-${digits}`);
    }
  }, [galleryName]);

  const loadClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, email')
      .eq('owner_admin_id', user.id)
      .order('name');
    setClients(data || []);
  };

  const normalizePhone = (v: string) => v.replace(/[^\d+]/g, '');

  const checkClientByPhone = useCallback((phone: string) => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 10) { setClientData(null); setIsNewClient(false); return; }
    const found = clients.find(c => normalizePhone(c.phone || '') === normalized);
    if (found) { setClientData(found); setIsNewClient(false); }
    else { setClientData(null); setIsNewClient(true); }
  }, [clients]);

  useEffect(() => {
    if (phoneSearch.length >= 10) checkClientByPhone(phoneSearch);
    else { setClientData(null); setIsNewClient(false); }
  }, [phoneSearch, checkClientByPhone]);

  const createClient = async () => {
    if (!phoneSearch || creatingClient) return;
    setCreatingClient(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Normalize phone
      const normalizedPhone = normalizePhone(phoneSearch);

      // Create client with phone only — owner_admin_id links them to this photographer
      const { data, error: err } = await supabase.from('clients').insert({
        owner_admin_id: user.id,
        name: normalizedPhone,   // use phone as name placeholder until client sets their name
        phone: normalizedPhone,
        mobile_number: normalizedPhone,
      }).select().single();
      if (err) throw err;
      setClients(prev => [data, ...prev]);
      setClientData(data);
      setIsNewClient(false);
    } catch (e: any) { setError(e.message); }
    finally { setCreatingClient(false); }
  };

  const selectClient = (c: Client) => {
    setClientData(c);
    setPhoneSearch(c.phone || '');
    setIsNewClient(false);
    setShowClientList(false);
  };

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.phone || '').includes(clientSearch))
    : clients;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  }, []);

  const addFiles = (newFiles: File[]) => {
    const mapped: UploadFile[] = newFiles.map(f => ({
      file: f, id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      status: 'pending', progress: 0,
    }));
    setFiles(prev => [...prev, ...mapped]);
  };

  const toggleDelivery = (m: DeliveryMethod) => {
    setDeliveryMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const checkDuplicate = async (): Promise<boolean> => {
    if (!clientData?.id || !galleryName.trim()) return false;
    const { data } = await supabase.from('galleries')
      .select('name').eq('client_id', clientData.id).ilike('name', galleryName.trim());
    return (data?.length || 0) > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData?.id) { setError('Please select or create a client.'); return; }
    if (!galleryName.trim()) { setError('Please enter a gallery name.'); return; }
    if (files.length === 0) { setError('Please add at least one photo.'); return; }
    setError('');

    const isDuplicate = await checkDuplicate();
    if (isDuplicate) { setShowDuplicateModal(true); return; }
    await proceedWithUpload();
  };

  const proceedWithUpload = async () => {
    setShowDuplicateModal(false);
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: gallery, error: gErr } = await supabase.from('galleries').insert({
        client_id: clientData!.id,
        owner_admin_id: user!.id,
        created_by_admin_id: user!.id,
        name: galleryName,
        access_code: accessCode,
        price: parseFloat(price) || 0,
        shoot_type: shootType,
        is_paid: isPaid,
        is_locked: !isPaid,
        is_active: true,
      }).select().single();
      if (gErr) throw gErr;

      setGalleryId(gallery.id);
      setFinalAccessCode(gallery.access_code);
      setStep('uploading');
      await uploadConcurrent(gallery.id, clientData!.id, gallery.access_code);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const uploadConcurrent = async (gId: string, clientId: string, code: string) => {
    let uploaded = 0;
    let index = 0;
    const total = files.length;

    const worker = async () => {
      while (index < total) {
        const i = index++;
        const f = files[i];
        setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'compressing', originalSize: f.file.size } : p));
        try {
          // Compress image if it's a photo (target 5-10MB like Pixieset)
          let uploadFile = f.file;
          let compressedSize = f.file.size;

          if (f.file.type.startsWith('image/') && f.file.size > 5 * 1024 * 1024) {
            const preset = getRecommendedPreset(f.file.size);
            try {
              const compressed = await compressImage(f.file, preset);
              // Convert base64 back to blob
              const binaryString = atob(compressed.compressedBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              uploadFile = new Blob([bytes], { type: `image/${compressed.format}` });
              compressedSize = compressed.compressedSize;
              console.log(`Compressed ${f.file.name}: ${formatFileSize(f.file.size)} → ${formatFileSize(compressedSize)} (${compressed.compressionRatio})`);
              setFiles(prev => prev.map(p => p.id === f.id ? { ...p, compressedSize } : p));
            } catch (compressionError) {
              console.warn('Compression failed, uploading original:', compressionError);
            }
          }

          setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'uploading', progress: 0 } : p));
          const ext = f.file.name.split('.').pop() || 'jpg';
          const path = `clients/${clientId}/${gId}/images/${Date.now()}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from('client-photos').upload(path, uploadFile, {
            contentType: f.file.type, upsert: true,
          });
          if (upErr) throw upErr;
          await supabase.from('gallery_photos').insert({
            gallery_id: gId, photo_url: path, file_name: f.file.name,
            file_size: compressedSize, mime_type: f.file.type, upload_order: i,
          });
          if (i === 0) {
            await supabase.from('galleries').update({ cover_photo_url: path }).eq('id', gId).is('cover_photo_url', null);
          }
          uploaded++;
          setTotalUploaded(uploaded);
          setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'done', progress: 100 } : p));
        } catch (e: any) {
          setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'error', error: e.message } : p));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));

    // Send in-app notification
    if (sendNotification && clientData?.id) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('notifications').insert({
          client_id: clientData.id,
          admin_id: user!.id,
          gallery_id: gId,
          type: 'gallery_ready',
          title: `Your ${galleryName} gallery is ready!`,
          body: `Your photos are now available. Use code ${code} to unlock.`,
          data: { galleryId: gId, accessCode: code },
          is_read: false,
        });
      } catch (e) { console.warn('Notification failed:', e); }
    }

    setStep('done');
  };

  const sendSMS = async () => {
    if (!clientData?.phone || !finalAccessCode) return;
    const msg = customMessage ||
      `Hello ${clientData.name}, your photos are ready! Use code: ${finalAccessCode} to unlock your gallery.`;
    try {
      const { SMSCloudService } = await import('@/lib/messaging');
      await SMSCloudService.send({
        phone_number: clientData.phone,
        message: msg,
        photographer_id: (await supabase.auth.getUser()).data.user?.id,
        client_id: clientData.id,
        gallery_id: galleryId,
      });
      showToast('SMS sent successfully!');
    } catch (e: any) {
      // Fallback to browser SMS
      window.open(`sms:${clientData.phone}?body=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const sendWhatsApp = async () => {
    if (!clientData?.phone || !finalAccessCode) return;
    const msg = customMessage ||
      `Hello ${clientData.name}, your photos are ready! Use code: ${finalAccessCode} to unlock your gallery.`;
    try {
      const { WhatsAppService } = await import('@/lib/messaging');
      await WhatsAppService.send({
        phone_number: clientData.phone,
        message: msg,
        photographer_id: (await supabase.auth.getUser()).data.user?.id,
        client_id: clientData.id,
        gallery_id: galleryId,
      });
      showToast('WhatsApp sent successfully!');
    } catch (e: any) {
      // Fallback to browser WhatsApp
      const phone = clientData.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const copyCode = () => navigator.clipboard.writeText(finalAccessCode);

  const resetForm = () => {
    setStep('setup'); setFiles([]); setGalleryId(''); setFinalAccessCode('');
    setTotalUploaded(0); setGalleryName(''); setPrice(''); setAccessCode('');
    setClientData(null); setPhoneSearch(''); setIsNewClient(false);
    setNewClientName(''); setNewClientEmail(''); setError('');
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black">Upload Gallery</h1>
        <p className="text-gray-400 mt-1">Create a gallery and upload photos for a client</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

      {/* Duplicate warning modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#111118] border border-yellow-500/20 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-yellow-400">⚠️ Duplicate Gallery</h3>
            <p className="text-gray-300 text-sm">A gallery named <strong>"{galleryName}"</strong> already exists for this client. Continue anyway?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDuplicateModal(false)}
                className="flex-1 border border-white/10 text-gray-300 py-2 rounded-xl text-sm hover:bg-white/5">Cancel</button>
              <button onClick={proceedWithUpload}
                className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded-xl text-sm hover:opacity-90">Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* SETUP STEP */}
      {step === 'setup' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Client lookup */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Client</h2>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                <input value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  placeholder="+254712345678" />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={() => setShowClientList(!showClientList)}
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/10 whitespace-nowrap">
                  Browse Clients
                </button>
              </div>
            </div>

            {/* Client found */}
            {clientData && (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm flex-shrink-0">
                  {clientData.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-300 text-sm">{clientData.name}</p>
                  <p className="text-xs text-gray-400">{clientData.phone}</p>
                </div>
                <button type="button" onClick={() => { setClientData(null); setPhoneSearch(''); }}
                  className="text-xs text-gray-500 hover:text-red-400">✕</button>
              </div>
            )}

            {/* New client form — phone only */}
            {isNewClient && !clientData && (
              <div className="space-y-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                <p className="text-sm text-yellow-400 font-semibold">New number — add as client?</p>
                <p className="text-xs text-gray-400">
                  A client record will be created with <strong className="text-white">{phoneSearch}</strong> and linked to your account.
                  They can update their name when they log in to the app.
                </p>
                <button type="button" onClick={createClient} disabled={creatingClient}
                  className="w-full bg-yellow-500 text-black font-bold py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50">
                  {creatingClient ? 'Creating…' : `Add ${phoneSearch} as client`}
                </button>
              </div>
            )}

            {/* Client browser */}
            {showClientList && (
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-white/5">
                  <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                    className="w-full bg-[#0A0A0E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="Search by name or phone..." autoFocus />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredClients.length === 0
                    ? <p className="text-center text-gray-500 text-sm py-4">No clients found</p>
                    : filteredClients.map(c => (
                      <button key={c.id} type="button" onClick={() => selectClient(c)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 text-xs font-bold flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.phone}</p>
                        </div>
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* Gallery details */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Gallery Details</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Gallery Name *</label>
              <input value={galleryName} onChange={e => setGalleryName(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                placeholder="Johnson Wedding 2026" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Access Code</label>
                <input value={accessCode} onChange={e => setAccessCode(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-500/50"
                  placeholder="JOH-1234" />
                <p className="text-xs text-gray-600 mt-1">Auto-generated from title</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shoot Type</label>
                <select value={shootType} onChange={e => setShootType(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
                  {SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Price (KES)</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  placeholder="15000" min="0" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setIsPaid(!isPaid)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${isPaid ? 'bg-yellow-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPaid ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-gray-300">Mark as Paid</span>
                </label>
              </div>
            </div>
          </div>

          {/* Delivery options */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Delivery & Notifications</h2>
            <div>
              <p className="text-sm text-gray-400 mb-2">Delivery Methods</p>
              <div className="flex flex-wrap gap-2">
                {(['in_app', 'sms', 'whatsapp', 'email'] as DeliveryMethod[]).map(m => (
                  <button key={m} type="button" onClick={() => toggleDelivery(m)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      deliveryMethods.includes(m)
                        ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}>
                    {m === 'in_app' ? '📱 In-App' : m === 'sms' ? '💬 SMS' : m === 'whatsapp' ? '🟢 WhatsApp' : '📧 Email'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setSendNotification(!sendNotification)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${sendNotification ? 'bg-yellow-500' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sendNotification ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Send in-app notification after upload</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setAutoSms(!autoSms)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${autoSms ? 'bg-yellow-500' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoSms ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Auto-SMS on upload</span>
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Custom Message (optional)</label>
              <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={3}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500/50 resize-none"
                placeholder="Leave blank to use default message..." />
            </div>
          </div>

          {/* Drop zone */}
          <div ref={dropRef} onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-yellow-500/30 transition-colors">
            <div className="text-5xl mb-4">📸</div>
            <p className="text-lg font-semibold mb-2">Drop photos here or click to browse</p>
            <p className="text-gray-500 text-sm">JPEG, PNG, WEBP · {CONCURRENCY} concurrent uploads</p>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => addFiles(Array.from(e.target.files || []))} />
          </div>

          {files.length > 0 && (
            <div className="bg-[#111118] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold">{files.length} photo{files.length !== 1 ? 's' : ''} selected</p>
                <button type="button" onClick={() => setFiles([])} className="text-xs text-red-400 hover:underline">Clear all</button>
              </div>
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                {files.map(f => (
                  <div key={f.id} className="relative aspect-square group">
                    <img src={URL.createObjectURL(f.file)} className="w-full h-full object-cover rounded-lg" alt="" />
                    <button type="button" onClick={() => setFiles(prev => prev.filter(p => p.id !== f.id))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={creating || files.length === 0 || !clientData}
            className="w-full bg-yellow-500 text-black font-bold py-4 rounded-2xl text-lg hover:opacity-90 disabled:opacity-50">
            {creating ? 'Creating gallery...' : `⬆️ Upload ${files.length} Photo${files.length !== 1 ? 's' : ''}`}
          </button>
        </form>
      )}

      {/* UPLOADING STEP */}
      {step === 'uploading' && (
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-bold">Uploading {CONCURRENCY} at a time...</h2>
          <div className="w-full bg-white/5 rounded-full h-3">
            <div className="bg-yellow-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.round((totalUploaded / files.length) * 100)}%` }} />
          </div>
          <p className="text-gray-400 text-sm">{totalUploaded} of {files.length} photos uploaded</p>
          <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {files.map(f => (
              <div key={f.id} className="relative aspect-square">
                <img src={URL.createObjectURL(f.file)} className="w-full h-full object-cover rounded-lg" alt="" />
                <div className={`absolute inset-0 rounded-lg flex items-center justify-center text-lg ${
                  f.status === 'done' ? 'bg-green-500/40' : f.status === 'error' ? 'bg-red-500/40' :
                  f.status === 'compressing' ? 'bg-blue-500/30' :
                  f.status === 'uploading' ? 'bg-yellow-500/20' : 'bg-black/40'
                }`}>
                  {f.status === 'done' ? '✅' : f.status === 'error' ? '❌' : 
                   f.status === 'compressing' ? '🔄' : f.status === 'uploading' ? '⏳' : ''}
                </div>
                {f.originalSize && f.compressedSize && f.status === 'done' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-center py-0.5 rounded-b-lg text-green-400">
                    {formatFileSize(f.originalSize)} → {formatFileSize(f.compressedSize)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DONE STEP */}
      {step === 'done' && (
        <div className="bg-[#111118] border border-green-500/20 rounded-2xl p-8 space-y-6 text-center">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-black text-green-400">Gallery Created!</h2>
          <p className="text-gray-400">{files.filter(f => f.status === 'done').length} of {files.length} photos uploaded.</p>
          <div className="bg-[#0A0A0E] border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-2">Client Access Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-black text-yellow-400 tracking-widest">{finalAccessCode}</span>
              <button onClick={copyCode}
                className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20">Copy</button>
            </div>
          </div>
          {/* Send buttons */}
          <div className="flex gap-3 justify-center flex-wrap">
            {deliveryMethods.includes('sms') && (
              <button onClick={sendSMS}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/20">
                💬 Send SMS
              </button>
            )}
            {deliveryMethods.includes('whatsapp') && (
              <button onClick={sendWhatsApp}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-sm font-semibold hover:bg-green-500/20">
                🟢 Send WhatsApp
              </button>
            )}
          </div>
          <button onClick={resetForm}
            className="bg-yellow-500 text-black font-bold px-8 py-3 rounded-xl hover:opacity-90">
            Upload Another Gallery
          </button>
        </div>
      )}
    </div>
  );
}
