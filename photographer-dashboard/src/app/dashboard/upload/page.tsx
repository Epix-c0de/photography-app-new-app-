'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type UploadFile = {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

export default function UploadPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [galleryName, setGalleryName] = useState('');
  const [price, setPrice] = useState('');
  const [shootType, setShootType] = useState('Wedding');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [galleryId, setGalleryId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [step, setStep] = useState<'setup' | 'uploading' | 'done'>('setup');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [totalUploaded, setTotalUploaded] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('clients').select('id, name, user_id').eq('owner_admin_id', user.id).order('name');
    setClients(data || []);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    addFiles(dropped);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const mapped: UploadFile[] = newFiles.map((f) => ({
      file: f,
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...mapped]);
  };

  const handleCreateGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !galleryName.trim() || files.length === 0) {
      setError('Please select a client, enter a gallery name, and add photos.');
      return;
    }
    setError(''); setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Generate access code
      const code = Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

      const { data: gallery, error: gError } = await supabase.from('galleries').insert({
        client_id: selectedClient,
        owner_admin_id: user!.id,
        created_by_admin_id: user!.id,
        name: galleryName,
        access_code: code,
        price: parseFloat(price) || 0,
        shoot_type: shootType,
        is_paid: false,
        is_locked: true,
        is_active: true,
      }).select().single();

      if (gError) throw gError;

      setGalleryId(gallery.id);
      setAccessCode(code);
      setStep('uploading');
      await uploadAllFiles(gallery.id, selectedClient);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const uploadAllFiles = async (gId: string, clientId: string) => {
    let uploaded = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'uploading' } : p));

      try {
        const ext = f.file.name.split('.').pop() || 'jpg';
        const path = `clients/${clientId}/${gId}/images/${Date.now()}-${i}.${ext}`;

        // Upload with progress simulation
        const { error: upError } = await supabase.storage.from('client-photos').upload(path, f.file, {
          contentType: f.file.type,
          upsert: true,
        });
        if (upError) throw upError;

        // Insert DB record
        await supabase.from('gallery_photos').insert({
          gallery_id: gId,
          photo_url: path,
          file_name: f.file.name,
          file_size: f.file.size,
          mime_type: f.file.type,
          upload_order: i,
        });

        // Set cover photo for first image
        if (i === 0) {
          await supabase.from('galleries').update({ cover_photo_url: path }).eq('id', gId).is('cover_photo_url', null);
        }

        uploaded++;
        setTotalUploaded(uploaded);
        setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'done', progress: 100 } : p));
      } catch (err: any) {
        setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'error', error: err.message } : p));
      }
    }

    setStep('done');
  };

  const copyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  const shootTypes = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion', 'Other'];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black">Upload Gallery</h1>
        <p className="text-gray-400 mt-1">Bulk upload photos for a client</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

      {/* Setup step */}
      {step === 'setup' && (
        <form onSubmit={handleCreateGallery} className="space-y-6">
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold">Gallery Details</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Client *</label>
              <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none" required>
                <option value="">Select a client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Gallery Name *</label>
              <input value={galleryName} onChange={(e) => setGalleryName(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                placeholder="Johnson Wedding 2026" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Price (KES)</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  placeholder="15000" min="0" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shoot Type</label>
                <select value={shootType} onChange={(e) => setShootType(e.target.value)}
                  className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
                  {shootTypes.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-yellow-500/30 transition-colors"
          >
            <div className="text-5xl mb-4">📸</div>
            <p className="text-lg font-semibold mb-2">Drop photos here or click to browse</p>
            <p className="text-gray-500 text-sm">Supports JPEG, PNG, WEBP · No limit on file count</p>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={(e) => addFiles(Array.from(e.target.files || []))} />
          </div>

          {files.length > 0 && (
            <div className="bg-[#111118] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold">{files.length} photo{files.length !== 1 ? 's' : ''} selected</p>
                <button type="button" onClick={() => setFiles([])} className="text-xs text-red-400 hover:underline">Clear all</button>
              </div>
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                {files.map((f) => (
                  <div key={f.id} className="relative aspect-square">
                    <img src={URL.createObjectURL(f.file)} className="w-full h-full object-cover rounded-lg" alt="" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={creating || files.length === 0}
            className="w-full bg-yellow-500 text-black font-bold py-4 rounded-2xl text-lg hover:opacity-90 disabled:opacity-50">
            {creating ? 'Creating gallery...' : `⬆️ Upload ${files.length} Photo${files.length !== 1 ? 's' : ''}`}
          </button>
        </form>
      )}

      {/* Uploading step */}
      {step === 'uploading' && (
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-bold">Uploading...</h2>
          <div className="w-full bg-white/5 rounded-full h-3">
            <div className="bg-yellow-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.round((totalUploaded / files.length) * 100)}%` }} />
          </div>
          <p className="text-gray-400 text-sm">{totalUploaded} of {files.length} photos uploaded</p>
          <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {files.map((f) => (
              <div key={f.id} className="relative aspect-square">
                <img src={URL.createObjectURL(f.file)} className="w-full h-full object-cover rounded-lg" alt="" />
                <div className={`absolute inset-0 rounded-lg flex items-center justify-center text-lg ${
                  f.status === 'done' ? 'bg-green-500/40' :
                  f.status === 'error' ? 'bg-red-500/40' :
                  f.status === 'uploading' ? 'bg-yellow-500/20' : 'bg-black/40'
                }`}>
                  {f.status === 'done' ? '✅' : f.status === 'error' ? '❌' : f.status === 'uploading' ? '⏳' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && (
        <div className="bg-[#111118] border border-green-500/20 rounded-2xl p-8 space-y-6 text-center">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-black text-green-400">Gallery Created!</h2>
          <p className="text-gray-400">
            {files.filter((f) => f.status === 'done').length} of {files.length} photos uploaded successfully.
          </p>

          <div className="bg-[#0A0A0E] border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-2">Client Access Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-black text-yellow-400 tracking-widest">{accessCode}</span>
              <button onClick={copyAccessCode}
                className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20">
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Share this code with your client to unlock their gallery</p>
          </div>

          <button onClick={() => { setStep('setup'); setFiles([]); setGalleryId(''); setAccessCode(''); setTotalUploaded(0); setGalleryName(''); setPrice(''); }}
            className="bg-yellow-500 text-black font-bold px-8 py-3 rounded-xl hover:opacity-90">
            Upload Another Gallery
          </button>
        </div>
      )}
    </div>
  );
}
