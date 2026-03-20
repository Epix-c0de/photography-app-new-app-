import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { galleries as mockGalleries } from '../mocks/data';

const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK_DATA === '1') || (process.env.EXPO_OFFLINE === '1');

const ACCESS_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function buildAccessCode(): string {
  const length = 6 + Math.floor(Math.random() * 3);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueAccessCode(maxAttempts = 10): Promise<string> {
  if (USE_MOCK) {
    return '123456';
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = buildAccessCode();

    // Check if this code already exists
    const { data, error } = await supabase
      .from('galleries')
      .select('access_code')
      .eq('access_code', code)
      .maybeSingle();

    if (error) {
      console.warn('Error checking access code uniqueness:', error);
      continue;
    }

    if (!data) {
      return code;
    }
  }

  throw new Error('Failed to generate unique access code after multiple attempts');
}

async function ensureAdminProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const metadata = user.user_metadata as any;
  const appMetadata = user.app_metadata as any;
  const name = metadata?.name || metadata?.display_name || user.email || 'Admin';

  // Check if a profile already exists
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfile) {
    // Profile exists. Force role to 'admin' — this function is ONLY called in admin contexts.
    // If the stored role is 'client', it means the DB was never properly updated.
    // We self-heal here so manual SQL fixes are not required.
    if ((existingProfile.role as string) !== 'admin' && (existingProfile.role as string) !== 'super_admin') {
      await supabase
        .from('user_profiles')
        .update({ role: 'admin', name, email: user.email || null })
        .eq('id', user.id);
    } else {
      // Role is already admin; just update non-critical fields
      await supabase
        .from('user_profiles')
        .update({ name, email: user.email || null })
        .eq('id', user.id);
    }
  } else {
    // No profile exists yet. The JWT role from app_metadata is most trustworthy.
    const jwtRole = appMetadata?.role || metadata?.role;
    const role = (jwtRole === 'super_admin' || jwtRole === 'admin') ? jwtRole : 'admin';

    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        role,
        name,
        email: user.email || null,
        phone: user.phone || null
      });

    if (insertError) {
      const message = (insertError as any)?.message || 'Failed to create admin profile.';
      throw new Error(`${message} Ensure the user_profiles insert policy exists and rerun migrations.`);
    }
  }

  return user;
}


export type Client = Database['public']['Tables']['clients']['Row'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];
export type Package = any;
export type AdminResource = any;
export type AdminSettings = any;
export type AdminSettingsUpdate = Partial<AdminSettings>;


const adminDataCache: Record<string, any> = {
  threads: [],
  clients: [],
  galleries: [],
  dashboard: null as any,
  messages: {} as Record<string, any[]>
};

/**
 * Admin-Side API Contract
 * Implements the "Admin" portion of the Master API Contract.
 */
export const AdminService = {

  cache: {
    get: (key: 'threads' | 'clients' | 'galleries' | 'messages' | 'dashboard') => adminDataCache[key],
    getMessages: (clientId: string) => adminDataCache.messages[clientId] || [],
    clear: () => {
      adminDataCache.threads = [];
      adminDataCache.clients = [];
      adminDataCache.galleries = [];
      adminDataCache.dashboard = null;
      adminDataCache.messages = {};
    }
  },

  /**
   * 1. ADMIN AUTH & SETTINGS
   */
  profile: {
    get: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },

    update: async (updates: { name?: string; avatar_url?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);
        
      if (error) throw error;
      return true;
    },

    uploadAvatar: async (uri: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
      const storagePath = `${user.id}/${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, blob, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);

      await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      return publicUrl;
    }
  },

  settings: {
    get: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('admin_settings')
        .select('*')
        .eq('admin_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Create default settings if not exist
          const { data: newData, error: newError } = await (supabase as any)
            .from('admin_settings')
            .insert({ admin_id: user.id })
            .select()
            .single();
          if (newError) {
            console.error('AdminService.settings.get (create default):', newError);
            throw newError;
          }
          return newData;
        }
        console.error('AdminService.settings.get:', error);
        throw error;
      }
      return data;
    },


    update: async (updates: AdminSettingsUpdate) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('admin_settings')
        .update(updates)
        .eq('admin_id', user.id);

      if (error) {
        console.error('AdminService.settings.update:', error);
        throw error;
      }
      return true;
    },

    saveSimplePaymentSettings: async (settings: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('simple_payment_settings')
        .upsert({
          admin_id: user.id,
          ...settings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'admin_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    getSimplePaymentSettings: async (adminId?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const targetId = adminId || user?.id;
      if (!targetId) return null;

      const { data, error } = await supabase
        .from('simple_payment_settings')
        .select('*')
        .eq('admin_id', targetId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    updatePaymentNumber: async (paybill: string, accountRef: string) => {
      return AdminService.settings.update({
        mpesa_paybill: paybill,
        mpesa_account_reference: accountRef
      });
    }
  },

  /**
   * 2. CLIENT MANAGEMENT
   */
  clients: {
    list: async (): Promise<any[]> => {
      if (USE_MOCK) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Fetch all user profiles with role 'client'
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'client')
        .order('name', { ascending: true });
      
      if (profileError) {
        console.error('AdminService.clients.list (profiles):', profileError);
        throw profileError;
      }

      // 2. Fetch all CRM client data
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*');
      
      if (clientError) {
        console.error('AdminService.clients.list (clients):', clientError);
        throw clientError;
      }

      // 3. Merge profiles and CRM data
      const clientMap = new Map((clients || []).map((c: any) => [c.user_id, c]));

      const transformed = (profiles || []).map((p: any) => {
        const crmData = clientMap.get(p.id);
        return {
          id: crmData?.id || `temp-${p.id}`, // Use existing client ID or temp
          user_id: p.id,
          name: p.name || 'Anonymous User',
          phone: p.phone || '',
          email: p.email || '',
          avatar_url: p.avatar_url || null,
          loyalty_level: crmData?.loyalty_level || 'Bronze',
          total_spent: crmData?.total_paid || 0,
          total_galleries: 0,
        };
      });

      adminDataCache.clients = transformed;
      return transformed;
    },

    // Fetch all clients in the system specifically for modals (like Inbox and Upload)
    listAll: async (): Promise<any[]> => {
      if (USE_MOCK) return [];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Fetch all user profiles with role 'client'
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'client')
        .order('name', { ascending: true });
      
      if (profileError) throw profileError;

      // 2. Fetch all CRM client data
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*');
      
      if (clientError) throw clientError;

      const clientMap = new Map((clients || []).map((c: any) => [c.user_id, c]));

      return (profiles || []).map((p: any) => {
        const crmData = clientMap.get(p.id);
        return {
          id: crmData?.id || `temp-${p.id}`,
          user_id: p.id,
          name: p.name || 'Anonymous User',
          phone: p.phone || '',
          email: p.email || '',
          user_profiles: { avatar_url: p.avatar_url }
        };
      });
    },

    create: async (client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_admin_id'>) => {
      const user = await ensureAdminProfile();

      const timeoutMs = 15000;
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), timeoutMs);
      });

      const createPromise = (async () => {
        const { data, error } = await supabase
          .from('clients')
          .insert({ ...client, owner_admin_id: user.id })
          .select()
          .single();

        if (error) throw error;
        return data;
      })();

      return await Promise.race([createPromise, timeout]);
    },

    update: async (id: string, updates: ClientUpdate) => {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return true;
    },

    subscribe: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:clients')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  /**
   * 3. GALLERY MANAGEMENT
   */
  gallery: {
    list: async () => {
      if (USE_MOCK) {
        const now = new Date().toISOString();
        const mock = mockGalleries.map((g, idx) => ({
          id: `mock-gallery-${idx + 1}`,
          owner_admin_id: 'mock-admin',
          client_id: `mock-client-${(idx % 5) + 1}`,
          name: g.title,
          cover_photo_url: g.coverImage,
          access_code: '123456',
          is_paid: !(g.isLocked),
          is_locked: g.isLocked,
          price: g.price ?? 0,
          shoot_type: g.type,
          scheduled_release: null,
          created_at: now,
          photo_count: Math.floor(Math.random() * 100),
          derived_cover_image: g.coverImage
        }));
        return mock as any;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all galleries regardless of owner_admin_id
      const { data: galleries, error } = await supabase
        .from('galleries')
        .select(`
          *,
          gallery_photos (id, photo_url)
        `)
        // .eq('owner_admin_id', user.id) // Removed filter to show all galleries
        .order('created_at', { ascending: false });

      if (error) {
        console.error('AdminService.gallery.list:', error);
        throw error;
      }
      if (!galleries || galleries.length === 0) return [];

      const clientIds = [...new Set(galleries.map(g => g.client_id).filter(Boolean))];

      let clientMap = new Map();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds);
        if (clients) {
          clients.forEach((c: any) => clientMap.set(c.id, c.name));
        }

        const missingIds = clientIds.filter((id: any) => !clientMap.has(id));
        if (missingIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, name')
            .in('id', missingIds);
          if (profiles) profiles.forEach((p: any) => clientMap.set(p.id, p.name));
        }
      }

      const pathsToSign: string[] = [];
      galleries.forEach((g: any) => {
        if (!g.cover_photo_url && g.gallery_photos && g.gallery_photos.length > 0) {
          const firstPhoto = g.gallery_photos[0];
          if (firstPhoto.photo_url) pathsToSign.push(firstPhoto.photo_url);
        } else if (g.cover_photo_url && !g.cover_photo_url.startsWith('http')) {
          pathsToSign.push(g.cover_photo_url);
        }
      });

      let signedUrlMap = new Map<string, string>();
      if (pathsToSign.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(pathsToSign, 3600);
        if (signedUrls) {
          signedUrls.forEach((s: any) => { if (s.signedUrl && s.path) signedUrlMap.set(s.path, s.signedUrl); });
        }
      }

      const result = galleries.map((g: any) => {
        const photos = g.gallery_photos || [];
        const photoCount = photos.length;
        let coverImage = g.cover_photo_url;
        if (coverImage && !coverImage.startsWith('http')) {
          const signed = signedUrlMap.get(coverImage);
          if (signed) coverImage = signed; else {
            const { data } = supabase.storage.from('client-photos').getPublicUrl(coverImage);
            coverImage = data.publicUrl;
          }
        }
        if (!coverImage && photos.length > 0) {
          const firstPhoto = photos[0];
          coverImage = signedUrlMap.get(firstPhoto.photo_url) || null;
          if (!coverImage) {
            const { data } = supabase.storage.from('client-photos').getPublicUrl(firstPhoto.photo_url);
            coverImage = data.publicUrl;
          }
        }

        return {
          ...g,
          clients: { name: clientMap.get(g.client_id) },
          photo_count: photoCount,
          derived_cover_image: coverImage
        };
      });

      adminDataCache.galleries = result;
      return result;
    },
    create: async (data: {
      clientId: string,
      name: string,
      price: number,
      shootType: string,
      scheduledRelease?: string,
      watermarkEnabled?: boolean,
      isPaid?: boolean,
      status?: 'locked' | 'unlocked' | 'archived',
      totalFiles?: number,
      estimatedTotalSize?: number
    }) => {
      const user = await ensureAdminProfile();
      const totalFiles = data.totalFiles ?? 0;

      // Resolve clientId - might be a user_profile ID or a clients table ID.
      let finalClientId = data.clientId;
      const strippedId = data.clientId.replace('temp-', '');
      
      const { data: clientCheck } = await supabase.from('clients').select('id').eq('id', strippedId).maybeSingle();
      
      if (!clientCheck) {
        const { data: linkedClient } = await supabase.from('clients').select('id').eq('user_id', strippedId).maybeSingle();
        if (linkedClient) {
          finalClientId = linkedClient.id;
        } else {
          // It's a user_profile ID without a client record, create one!
          const { data: userProfile } = await supabase.from('user_profiles').select('*').eq('id', strippedId).maybeSingle();
          if (userProfile) {
            const { data: newClient, error: clientError } = await supabase.from('clients').insert({
              owner_admin_id: user.id,
              user_id: userProfile.id,
              name: userProfile.name || 'App User',
              phone: userProfile.phone || '',
              email: userProfile.email || '',
              total_paid: 0,
            }).select('id').single();
            if (clientError) throw clientError;
            finalClientId = newClient!.id;
          } else {
             throw new Error('Provided client ID does not exist in clients or user_profiles.');
          }
        }
      }

      const { data: initResult, error } = await supabase.functions.invoke('admin_upload_init', {
        body: {
          admin_id: user.id,
          client_id: finalClientId,
          gallery_name: data.name,
          total_files: totalFiles,
          estimated_total_size: data.estimatedTotalSize ?? null
        }
      });
      if (error) throw error;
      return {
        id: initResult.gallery_id,
        access_code: initResult.access_code,
        session_id: initResult.session_id
      };
    },

    /**
     * Simplified gallery creation — bypasses Edge Functions entirely.
     * Inserts directly into the galleries table.
     */
    createSimple: async (data: {
      clientId: string;
      name: string;
      price?: number;
      shootType?: string;
      isPaid?: boolean;
      accessCode?: string;
      isLocked?: boolean;
    }) => {
      const user = await ensureAdminProfile();
      const accessCode = data.accessCode || await generateUniqueAccessCode();

      // Resolve clientId - might be a user_profile ID or a clients table ID.
      let finalClientId = data.clientId;
      const strippedId = data.clientId.replace('temp-', '');
      
      const { data: clientCheck } = await supabase.from('clients').select('id').eq('id', strippedId).maybeSingle();
      
      if (!clientCheck) {
        const { data: linkedClient } = await supabase.from('clients').select('id').eq('user_id', strippedId).maybeSingle();
        if (linkedClient) {
          finalClientId = linkedClient.id;
        } else {
          // It's a user_profile ID without a client record, create one!
          const { data: userProfile } = await supabase.from('user_profiles').select('*').eq('id', strippedId).maybeSingle();
          if (userProfile) {
            const { data: newClient, error: clientError } = await supabase.from('clients').insert({
              owner_admin_id: user.id,
              user_id: userProfile.id,
              name: userProfile.name || 'App User',
              phone: userProfile.phone || '',
              email: userProfile.email || '',
              total_paid: 0,
            }).select('id').single();
            if (clientError) throw clientError;
            finalClientId = newClient!.id;
          } else {
             throw new Error('Provided client ID does not exist in clients or user_profiles.');
          }
        }
      }

      const { data: gallery, error } = await supabase
        .from('galleries')
        .insert({
          client_id: finalClientId,
          owner_admin_id: user.id,
          created_by_admin_id: user.id,
          name: data.name,
          access_code: accessCode,
          price: data.price ?? 0,
          shoot_type: data.shootType ?? 'portrait',
          is_paid: data.isPaid ?? false,
          is_locked: data.isLocked !== undefined ? data.isLocked : !(data.isPaid ?? false),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: gallery.id,
        access_code: gallery.access_code,
        session_id: gallery.id, // use gallery id as session for direct uploads
      };
    },

    /**
     * Direct photo upload — bypasses Edge Functions entirely.
     * Uploads to Supabase Storage and inserts into gallery_photos.
     */
    uploadPhotoDirect: async (galleryId: string, file: any, isWatermarked = false, uploadOrder = 0) => {
      if (USE_MOCK) return 'mock-path';
      await ensureAdminProfile();

      if (!file?.uri) {
        throw new Error('Selected photo is missing a file URI.');
      }

      const ext = (file.uri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
      const fileName = file.fileName || file.name || `photo-${Date.now()}.${ext}`;
      const safeFileName = fileName.replace(/[^\w.-]/g, '_');
      const baseName = safeFileName.replace(new RegExp(`\\.${ext}$`, 'i'), '');
      const fileNameWithVariant = isWatermarked ? `${baseName}_watermarked.${ext}` : safeFileName;
      const contentType = file.mimeType || file.type || `image/${ext}`;
      
      // Path format: clients/CLIENT_ID/GALLERY_ID/images/FILENAME
      const { data: gallery } = await supabase
        .from('galleries')
        .select('client_id')
        .eq('id', galleryId)
        .single();
      
      const clientId = gallery?.client_id || 'unknown';
      const storagePath = `clients/${clientId}/${galleryId}/images/${Date.now()}-${fileNameWithVariant}`;

      // Upload to Supabase Storage with Blob using supabase-js (reliable in Expo RN)
      const blob = await fetch(file.uri).then(res => res.blob());
      const { error: uploadError } = await supabase
        .storage
        .from('client-photos')
        .upload(storagePath, blob, { contentType, upsert: true });
      if (uploadError) throw uploadError;


      const fileSize = file.fileSize || file.size || (blob as any)?.size || 0;

      // Insert database record
      const { error: insertError } = await supabase
        .from('gallery_photos')
        .insert({
          gallery_id: galleryId,
          photo_url: storagePath,
          file_name: fileNameWithVariant,
          file_size: fileSize,
          mime_type: contentType,
          is_watermarked: isWatermarked,
          upload_order: uploadOrder,
          width: file.width ?? null,
          height: file.height ?? null,
        });

      if (insertError) {
        // Clean up storage if DB insert fails
        await supabase.storage.from('client-photos').remove([storagePath]);
        throw insertError;
      }

      await supabase
        .from('galleries')
        .update({ cover_photo_url: storagePath })
        .eq('id', galleryId)
        .is('cover_photo_url', null);

      return storagePath;
    },


    createDirect: async (data: {
      client_id: string;
      name: string;
      access_code: string;
      is_paid?: boolean;
      owner_admin_id?: string;
    }) => {
      const user = await ensureAdminProfile();

      const { data: gallery, error } = await supabase
        .from('galleries')
        .insert({
          client_id: data.client_id,
          name: data.name,
          access_code: data.access_code,
          is_paid: data.is_paid ?? false,
          owner_admin_id: data.owner_admin_id || user.id,
          is_locked: !data.is_paid, // Lock unpaid galleries
        })
        .select()
        .single();

      if (error) throw error;
      return gallery;
    },

    update: async (id: string, updates: any) => {
      return await supabase
        .from('galleries')
        .update(updates)
        .eq('id', id);
    },

    uploadPhoto: async (galleryId: string, clientId: string, file: any, uploadOrder = 0, sessionId?: string) => {
      if (USE_MOCK) {
        console.log('Using mock data for photo upload');
        return true;
      }

      await ensureAdminProfile();

      if (!sessionId) {
        throw new Error('Session ID is required for uploads. Initialize upload session first.');
      }

      const ext = (file.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = file.fileName || file.name || `photo-${Date.now()}.${ext}`;
      const contentType = file.mimeType || file.type || `image/${ext}`;

      if (!file?.uri) {
        throw new Error('Selected photo is missing a file URI.');
      }
      const arrayBuffer = await fetch(file.uri).then(res => res.arrayBuffer());
      const fileSize = file.fileSize || file.size || arrayBuffer.byteLength || 0;

      // Generate checksum for duplicate detection
      const checksum = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const checksumArray = new Uint8Array(checksum);
      const checksumHex = Array.from(checksumArray).map(b => b.toString(16).padStart(2, '0')).join('');

      let lastError: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          // 1. Get signed upload URL
          const { data: urlData, error: urlError } = await supabase.functions.invoke('admin_upload_file', {
            body: {
              session_id: sessionId,
              file_name: fileName,
              file_size: fileSize,
              mime_type: contentType,
              checksum: checksumHex
            }
          });
          if (urlError) throw urlError;

          const uploadUrl = urlData.upload_url;
          const storagePath = urlData.storage_path;
          const fileUuid = urlData.file_uuid;

          // 2. Upload file to storage
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'content-type': contentType },
            body: arrayBuffer
          });
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed with status ${uploadResponse.status}`);
          }

          // 3. Confirm upload and create database record
          const { data: confirmData, error: confirmError } = await supabase.functions.invoke('admin_upload_confirm', {
            body: {
              session_id: sessionId,
              storage_path: storagePath,
              file_name: fileName,
              file_size: fileSize,
              mime_type: contentType,
              checksum: checksumHex,
              file_uuid: fileUuid
            }
          });
          if (confirmError) throw confirmError;

          return storagePath;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, (2 ** attempt) * 500));
          }
        }
      }
      throw lastError;
    },

    completeUpload: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke('admin_upload_complete', {
        body: { session_id: sessionId }
      });
      if (error) throw error;
      return data;
    },

    generateUniqueAccessCode: async (maxAttempts = 10): Promise<string> => {
      return generateUniqueAccessCode(maxAttempts);
    },

    getPhotos: async (galleryIdOrIds: string | string[], page = 0, limit = 50) => {
      if (USE_MOCK) return { data: [], count: 0 };

      const from = page * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('gallery_photos')
        .select('*', { count: 'exact' });

      if (Array.isArray(galleryIdOrIds)) {
        query = query.in('gallery_id', galleryIdOrIds);
      } else {
        query = query.eq('gallery_id', galleryIdOrIds);
      }

      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('AdminService.gallery.getPhotos:', error);
        throw error;
      }
      return { data, count };
    },

    getByClient: async (clientId: string) => {
      if (USE_MOCK) return [];
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('client_id', clientId);
      if (error) throw error;
      return data;
    },

    subscribe: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:galleries')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'galleries' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    subscribeToPhotos: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:gallery_photos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_photos' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    delete: async (galleryId: string) => {
      // Skip the Edge Function (401) and perform cascade delete directly in the right order.
      try {
        // 1. Delete storage files first
        const { data: photos } = await supabase
          .from('gallery_photos')
          .select('photo_url')
          .eq('gallery_id', galleryId);
        const paths = (photos || []).map((p: any) => p.photo_url).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('client-photos').remove(paths);
        }

        // 2. Null out/delete referring data first (FK references, must come before gallery delete)
        try { await supabase.from('payments').update({ gallery_id: null }).eq('gallery_id', galleryId); } catch {}
        try { await supabase.from('mpesa_transactions').update({ gallery_id: null }).eq('gallery_id', galleryId); } catch {}
        
        // 3. Delete from all other referencing tables
        await supabase.from('notifications').delete().eq('gallery_id', galleryId);
        await supabase.from('gallery_views').delete().eq('gallery_id', galleryId);
        try { await supabase.from('gallery_delivery_status').delete().eq('gallery_id', galleryId); } catch {}
        await supabase.from('unlocked_galleries').delete().eq('gallery_id', galleryId);
        try { await supabase.from('gallery_shares').delete().eq('gallery_id', galleryId); } catch {}
        try { await supabase.from('upload_logs').delete().eq('gallery_id', galleryId); } catch {}
        try { await supabase.from('upload_sessions').delete().eq('gallery_id', galleryId); } catch {}
        try { await supabase.from('sms_logs').delete().eq('gallery_id', galleryId); } catch {}
        try { await (supabase as any).from('events').delete().eq('gallery_id', galleryId); } catch {}
        try { await (supabase as any).from('event_log').delete().eq('gallery_id', galleryId); } catch {}

        // 4. Delete photos then gallery itself
        await supabase.from('gallery_photos').delete().eq('gallery_id', galleryId);
        const { error: deleteGalleryError } = await supabase.from('galleries').delete().eq('id', galleryId);
        if (deleteGalleryError) throw deleteGalleryError;

        return true;
      } catch (err: any) {
        throw new Error(err?.message || 'Failed to delete gallery');
      }
    },

    promoteToAnnouncement: async (galleryId: string, title: string, description: string) => {
      // 1. Fetch first 5 photos from gallery
      const { data: photos } = await supabase
        .from('gallery_photos')
        .select('photo_url, width, height')
        .eq('gallery_id', galleryId)
        .order('created_at', { ascending: true })
        .limit(5);

      if (!photos || photos.length === 0) {
        throw new Error('Gallery has no photos to promote');
      }

      // 2. Create announcement
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use the first photo as the main image
      const { data: publicUrlData } = supabase.storage
        .from('client-photos')
        .getPublicUrl(photos[0].photo_url);

      const { data: announcement, error: annError } = await supabase
        .from('announcements')
        .insert({
          title: title,
          description: description,
          image_url: publicUrlData.publicUrl,
          category: 'Gallery',
          is_active: true,
          created_by: user.id,
          cta: 'View Gallery'
        } as any)
        .select()
        .single();

      if (annError) throw annError;
      
      return true;
    },

    getStats: async (galleryId: string) => {
      if (USE_MOCK) {
        return {
          downloads_total: Math.floor(Math.random() * 50),
          unique_viewers: Math.floor(Math.random() * 20),
          last_viewed: new Date().toISOString(),
          top_photo: null
        };
      }

      // In a real app, you would query gallery_download_logs and gallery_access_logs
      // For now, we'll return placeholder stats or query what we can
      const { count: photoCount } = await supabase
        .from('gallery_photos')
        .select('*', { count: 'exact', head: true })
        .eq('gallery_id', galleryId);

      return {
        downloads_total: 0, // Placeholder
        unique_viewers: 0, // Placeholder
        last_viewed: null,
        photo_count: photoCount || 0
      };
    },

    bulk: async (payload: { gallery_ids: string[], action: 'lock' | 'unlock' | 'delete' }) => {
      if (payload.action === 'delete') {
        // Use the edge function sequentially for bulk delete to handle cascades safely
        for (const id of payload.gallery_ids) {
          await AdminService.gallery.delete(id);
        }
      } else if (payload.action === 'lock' || payload.action === 'unlock') {
        const { error } = await supabase
          .from('galleries')
          .update({ is_locked: payload.action === 'lock' })
          .in('id', payload.gallery_ids);
        if (error) throw error;
      }
      return true;
    },

    checkExpiry: async () => {
      // This would ideally be a scheduled function
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('galleries')
        .update({ is_locked: true })
        .lt('expires_at', now)
        .eq('is_locked', false);
      
      if (error) throw error;
      return true;
    }
  },

  tempUploads: {
    uploadPhoto: async (payload: {
      temporaryName: string;
      temporaryIdentifier?: string | null;
      accessCode: string;
      file: any;
      uploadOrder?: number;
    }) => {
      await ensureAdminProfile();
      if (!payload.file?.uri) {
        throw new Error('Selected photo is missing a file URI.');
      }

      const normalizedCode = payload.accessCode.trim().toUpperCase();
      const ext = (payload.file.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = payload.file.fileName || payload.file.name || `photo-${Date.now()}.${ext}`;
      const safeFileName = fileName.replace(/[^\w.-]/g, '_');
      const storagePath = `temp/${normalizedCode}/${Date.now()}-${safeFileName}`;
      const contentType = payload.file.mimeType || payload.file.type || `image/${ext}`;

      const arrayBuffer = await fetch(payload.file.uri).then(res => res.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from('client-photos')
        .upload(storagePath, arrayBuffer, {
          contentType,
          upsert: false
        });

      if (uploadError) {
        const message = (uploadError as any)?.message || String(uploadError);
        if (message.includes('Bucket') && message.includes('not found')) {
          throw new Error('Storage bucket "client-photos" not found. Please create required buckets in Supabase Storage.');
        }
        throw uploadError;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id ?? null;
      const uploadOrder = payload.uploadOrder ?? 0;

      const { data: tempRow, error: insertError } = await supabase
        .from('temporary_client_uploads')
        .insert({
          admin_id: adminId,
          temporary_name: payload.temporaryName.trim(),
          temporary_identifier: payload.temporaryIdentifier ?? null,
          access_code: normalizedCode,
          photo_path: storagePath,
          file_name: safeFileName,
          file_size: payload.file.fileSize || payload.file.size || 0,
          mime_type: contentType,
          width: payload.file.width ?? null,
          height: payload.file.height ?? null,
          upload_order: uploadOrder
        })
        .select('id')
        .single();

      if (insertError) {
        const errorCode = (insertError as any)?.code;
        const errorMessage = (insertError as any)?.message || '';
        const isDuplicate = errorCode === '23505' || errorMessage.includes('duplicate key value');
        if (!isDuplicate) {
          throw insertError;
        }
      } else if (tempRow?.id) {
        await supabase
          .from('audit_logs')
          .insert({
            actor_id: adminId,
            action: 'temporary_upload_created',
            entity_type: 'temporary_client_upload',
            entity_id: tempRow.id,
            metadata: {
              access_code: normalizedCode,
              temporary_name: payload.temporaryName
            }
          });
      }

      return storagePath;
    }
  },

  /**
   * 4. BTS MEDIA
   */
  bts: {
    upload: async (file: any, caption: string, visibility: 'global' | 'restricted', allowedClients: string[] = []) => {
      const { data: { user } } = await (supabase as any).auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const path = `bts/${Date.now()}.mp4`;
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: 'bts_media',
        type: 'video/mp4'
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('bts-media')
        .upload(path, formData);

      if (uploadError) throw uploadError;

      const { error } = await (supabase as any)
        .from('bts_media')
        .insert({
          owner_admin_id: user.id,
          media_url: path,
          media_type: 'video',
          caption,
          visibility,
          allowed_clients: allowedClients
        });

      if (error) throw error;
      return true;
    }
  },

  /**
   * 5. SMS & PACKAGES
   */
  sms: {
    purchaseCredits: async (amountOfSms: number, phoneNumber: string) => {
      const { data, error } = await supabase.functions.invoke('buy_sms', {
        body: { amount: amountOfSms, phone_number: phoneNumber }
      });
      if (error) throw error;
      return data;
    },

    getLogs: async () => {
      const { data: { user } } = await (supabase as any).auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('sms_logs')
        .select(`
          *,
          clients ( name )
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    getBalance: async () => {
      const { data: { user } } = await (supabase as any).auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data } = await (supabase as any)
        .from('admin_resources')
        .select('sms_balance')
        .eq('admin_id', user.id)
        .single();
      return data?.sms_balance || 0;
    }
  },

  /**
   * 6. DASHBOARD ANALYTICS
   */
  dashboard: {
    getAnalytics: async () => {
      const { data: { user } } = await (supabase as any).auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [
        { count: clientCount },
        { count: galleryCount },
        { count: paidGalleryCount },
        { data: payments },
        { data: smsBalance },
        { data: btsStats }
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id),
        supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id),
        supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id).eq('is_paid', true),
        supabase.from('payments').select('amount, created_at').eq('owner_admin_id', user.id).eq('status', 'paid'),
        (supabase as any).from('admin_resources').select('sms_balance').eq('admin_id', user.id).single(),
        supabase.from('bts_posts').select('views_count, clicks_count, likes_count, comments_count').eq('is_active', true)
      ]);

      const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalViews = btsStats?.reduce((sum, p) => sum + (p.views_count || 0), 0) || 0;
      const totalLikes = btsStats?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
      const totalComments = btsStats?.reduce((sum, p) => sum + (p.comments_count || 0), 0) || 0;
      const totalBtsClicks = btsStats?.reduce((sum, p) => sum + (p.clicks_count || 0), 0) || 0;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const revenueToday = payments?.filter(p => p.created_at >= startOfDay).reduce((sum, p) => sum + p.amount, 0) || 0;
      const revenueThisMonth = payments?.filter(p => p.created_at >= startOfMonth).reduce((sum, p) => sum + p.amount, 0) || 0;

      const result = {
        totalClients: clientCount || 0,
        totalGalleries: galleryCount || 0,
        paidGalleries: paidGalleryCount || 0,
        totalRevenue,
        revenueToday,
        revenueThisMonth,
        revenueThisWeek: 0,
        smsBalance: smsBalance?.sms_balance || 0,
        conversionRate: galleryCount ? Math.round(((paidGalleryCount || 0) / galleryCount) * 100) : 0,
        repeatClientRate: 0,
        engagement: {
          views: totalViews,
          likes: totalLikes,
          comments: totalComments,
          clicks: totalBtsClicks
        }
      };
      adminDataCache.dashboard = result;
      return result;
    }
  },

  /**
   * 7. Notifications
   */
  notifications: {
    create: async (targetId: string, payload: { type: string; title: string; body: string; data?: any; clientId?: string; galleryId?: string }) => {
      let resolvedUserId = targetId;

      const { data: clientCheck } = await supabase.from('clients').select('user_id').eq('id', targetId).maybeSingle();
      if (clientCheck && clientCheck.user_id) {
         resolvedUserId = clientCheck.user_id;
      }

      const { data: userCheck } = await supabase.from('user_profiles').select('id').eq('id', resolvedUserId).maybeSingle();
      if (!userCheck) {
         console.warn('Cannot create notification: User profile not found for targetId/clientId:', targetId);
         return false; // Skip inserting to avoid FK error
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: resolvedUserId,
          client_id: payload.clientId || null,
          gallery_id: payload.galleryId || null,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? null
        });
      if (error) throw error;
      return true;
    },

    notifyAll: async (payload: { type: string; title: string; body: string; data?: any }) => {
      if (USE_MOCK) return true;
      
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id');
      
      if (profileError) throw profileError;
      if (!profiles || profiles.length === 0) return true;

      const notifications = profiles.map(p => ({
        user_id: p.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? null
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) throw error;
      return true;
    }
  },

  /**
   * 8. CHAT
   */
  chat: {
    listThreads: async () => {
      if (USE_MOCK) return [];
      const user = await ensureAdminProfile();
      
      // Fetch all messages regardless of admin binding, grouped by client
      const { data, error } = await supabase
        .from('messages')
        .select(`
          client_id,
          created_at,
          content,
          sender_role,
          user_profiles:client_id ( id, name, phone, avatar_url )
        `)
        // .eq('owner_admin_id', user.id) // Removed filter
        .order('created_at', { ascending: false });

      if (error) throw error;

      const threads = new Map();
      data.forEach((msg: any) => {
        if (!threads.has(msg.client_id)) {
          threads.set(msg.client_id, {
            id: msg.client_id,
            clientId: msg.client_id,
            clientName: msg.user_profiles?.name || 'Unknown',
            clientAvatar: msg.user_profiles?.avatar_url || null,
            lastMessage: msg.content,
            unread: 0,
            timestamp: msg.created_at,
            isOnline: false,
            clientPhone: msg.user_profiles?.phone
          });
        }
      });

      const result = Array.from(threads.values());
      adminDataCache.threads = result;
      return result;
    },

    getMessages: async (clientId: string) => {
      if (USE_MOCK) return [];
      const user = await ensureAdminProfile();
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        // .eq('owner_admin_id', user.id) // Removed filter
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      adminDataCache.messages[clientId] = data;
      return data;
    },

    sendMessage: async (clientId: string, content: string) => {
      const user = await ensureAdminProfile();
      const { error } = await supabase
        .from('messages')
        .insert({
          owner_admin_id: user.id,
          client_id: clientId,
          sender_role: 'admin',
          content
        });
      if (error) throw error;
      return true;
    },

    subscribeToMessages: (clientId: string, callback: (payload: any) => void) => {
      const channel = supabase
        .channel(`public:messages:${clientId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    subscribeToThreads: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:messages_threads')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  /**
   * 9. ANNOUNCEMENTS
   */
  announcements: {
    create: async (payload: {
      title: string;
      content: string;
      description?: string;
      media_urls?: string[];
      media_types?: string[];
      visibility?: 'all' | 'selected';
      is_active?: boolean;
      expires_at?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          owner_admin_id: user.id,
          title: payload.title,
          content: payload.content,
          description: payload.description || null,
          media_urls: payload.media_urls || [],
          media_types: payload.media_types || [],
          visibility: payload.visibility || 'all',
          is_active: payload.is_active !== false,
          is_pinned: false,
          expires_at: payload.expires_at || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          announcement_comments (id, user_id, content, created_at, user_profiles:user_id (id, name, avatar_url)),
          announcement_reactions (id, user_id, reaction_emoji)
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    update: async (id: string, updates: any) => {
      const { error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return true;
    },

    delete: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },

    addComment: async (announcementId: string, content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('announcement_comments')
        .insert({
          announcement_id: announcementId,
          client_id: user.id,
          comment: content
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    getComments: async (announcementId: string) => {
      const { data, error } = await supabase
        .from('announcement_comments')
        .select(`
          *,
          user_profiles:user_id (id, name, avatar_url),
          admin_replies (id, admin_id, response_text, created_at, user_profiles:admin_id (name))
        `)
        .eq('announcement_id', announcementId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    replyToComment: async (commentId: string, responseText: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('admin_replies')
        .insert({
          comment_id: commentId,
          admin_id: user.id,
          response_text: responseText
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    addReaction: async (announcementId: string, emojiReaction: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('announcement_reactions')
        .insert({
          announcement_id: announcementId,
          user_id: user.id,
          reaction_emoji: emojiReaction
        })
        .select()
        .single();

      if (error && (error as any)?.code === '23505') {
        // Unique constraint - user already reacted, remove instead
        await supabase
          .from('announcement_reactions')
          .delete()
          .eq('announcement_id', announcementId)
          .eq('user_id', user.id)
          .eq('reaction_emoji', emojiReaction);
        return null;
      }

      if (error) throw error;
      return data;
    },

    getReactionStats: async (announcementId: string) => {
      const { data, error } = await supabase
        .from('announcement_reactions')
        .select('reaction_emoji, id', { count: 'exact' })
        .eq('announcement_id', announcementId);

      if (error) throw error;

      const reactions: Record<string, number> = {};
      data?.forEach(r => {
        reactions[r.reaction_emoji] = (reactions[r.reaction_emoji] || 0) + 1;
      });

      return reactions;
    },

    subscribeToAnnouncements: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  /**
   * 10. PORTFOLIO UPLOADS (BTS + Portfolio)
   */
  portfolio: {
    create: async (payload: {
      title: string;
      description?: string;
      content_type: 'bts' | 'portfolio';
      category?: string;
      media_urls: string[];
      media_types: string[];
      is_featured?: boolean;
      is_top_rated?: boolean;
      is_public?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('portfolio_items')
        .insert({
          owner_admin_id: user.id,
          title: payload.title,
          description: payload.description || null,
          content_type: payload.content_type,
          category: payload.category || null,
          media_urls: payload.media_urls,
          media_types: payload.media_types,
          is_featured: payload.is_featured || false,
          is_public: payload.is_public !== false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    listByType: async (contentType: 'bts' | 'portfolio') => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('created_by', user.id)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    update: async (id: string, updates: any) => {
      const { error } = await supabase
        .from('portfolio_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return true;
    },

    delete: async (id: string) => {
      // Delete portfolio item and its media from storage if needed
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },

    uploadMedia: async (file: any, contentType: 'bts' | 'portfolio') => {
      await ensureAdminProfile();

      if (!file?.uri) {
        throw new Error('Selected file is missing a URI.');
      }

      const ext = (file.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = file.fileName || file.name || `portfolio-${Date.now()}.${ext}`;
      const safeFileName = fileName.replace(/[^\w.-]/g, '_');
      const mimeType = file.mimeType || file.type || `image/${ext}`;
      const bucket = contentType === 'bts' ? 'bts-media' : 'portfolio-media';
      const storagePath = `${contentType}/${Date.now()}-${safeFileName}`;

      const arrayBuffer = await fetch(file.uri).then(res => res.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, arrayBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        const message = (uploadError as any)?.message || String(uploadError);
        if (message.includes('Bucket') && message.includes('not found')) {
          throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage.`);
        }
        throw uploadError;
      }

      return storagePath;
    },

    subscribeToPortfolio: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:portfolio_items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_items' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  /**
   * 11. BOOKINGS
   */
  bookings: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          packages(name),
          user_profiles!bookings_user_id_fkey(name, phone, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    updateStatus: async (id: string, status: 'pending' | 'confirmed' | 'completed' | 'cancelled') => {
      // @ts-ignore - The Supabase generated types for status enum might be out of sync or strict. Casting as any for now.
      const { error } = await supabase
        .from('bookings')
        .update({ status: status as any })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },

    reschedule: async (id: string, date: string, time: string) => {
      // @ts-ignore
      const { error } = await supabase
        .from('bookings')
        .update({ date, time, status: 'confirmed' as any }) 
        .eq('id', id);
      
      if (error) throw error;
      return true;
    }
  }
};

export { generateUniqueAccessCode };
