import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Gallery = Database['public']['Tables']['galleries']['Row'] & {
  cover_photo?: string; // Signed URL
  photo_count?: number;
};

export type Photo = Database['public']['Tables']['photos']['Row'] & {
  url: string; // Signed URL
};

export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PaymentStatus = Database['public']['Tables']['payments']['Row']['status'];
export type BTSPost = Database['public']['Tables']['bts_posts']['Row'];

/**
 * Client-Side API Contract
 * Implements the "Client" portion of the Master API Contract.
 */
export const ClientService = {
  
  /**
   * 1. AUTH & USER PROFILE
   */
  profile: {
    getMe: async () => {
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

    update: async (updates: { name?: string; phone?: string; email?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);
        
      if (error) throw error;
      return true;
    }
  },

  /**
   * 2. GALLERY & PHOTO APIs
   */
  gallery: {
    list: async (): Promise<Gallery[]> => {
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    /**
     * Download/View Photos
     * Logic: Allowed ONLY if payment_status = PAID (or gallery is unlocked)
     */
    getPhotos: async (galleryId: string): Promise<Photo[]> => {
      // 0. Get Current User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Check Gallery Status & Ownership
      const { data: gallery, error: gError } = await supabase
        .from('galleries')
        .select(`
          *,
          clients (
            user_id
          )
        `)
        .eq('id', galleryId)
        .single();
        
      if (gError) throw gError;
      
      // Strict Client Check
      // @ts-ignore - Supabase join types are complex
      const clientUserId = gallery.clients?.user_id;
      if (clientUserId !== user.id) {
        throw new Error('Unauthorized access to gallery');
      }

      // 2. Determine Variant
      // If locked, show watermarked. If unlocked/paid, show clean.
      const canViewClean = gallery.is_paid && !gallery.is_locked;
      const variant = canViewClean ? 'clean' : 'watermarked';

      // 3. Fetch Photos
      const { data: photos, error: pError } = await supabase
        .from('photos')
        .select('*')
        .eq('gallery_id', galleryId)
        .eq('variant', variant);

      if (pError) throw pError;

      // 4. Generate Signed URLs
      const photosWithUrls = await Promise.all(photos.map(async (p) => {
        // Bucket name logic
        const bucket = variant === 'clean' ? 'photos-clean' : 'photos-watermarked';
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(p.storage_path, 3600); // 1 hour expiry
          
        if (error) {
          console.warn(`Failed to sign URL for ${p.storage_path}`, error);
          return { ...p, url: '' };
        }
        return { ...p, url: data?.signedUrl || '' };
      }));

      return photosWithUrls;
    }
  },

  /**
   * 3. PAYMENTS - M-PESA STK PUSH
   */
  payment: {
    initiateStkPush: async (galleryId: string, phoneNumber: string, clientId?: string) => {
      const { data, error } = await supabase.functions.invoke('stk_push', {
        body: { galleryId, clientId, phoneNumber }
      });

      if (error) throw error;
      return data; // { checkoutRequestId, status }
    }
  },

  /**
   * 4. NOTIFICATIONS SYSTEM
   */
  notifications: {
    list: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },

    markRead: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
        
      if (error) throw error;
      return true;
    }
  },

  /**
   * 5. BTS MEDIA LOGIC
   */
  bts: {
    list: async (): Promise<BTSPost[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('bts_posts')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    }
  }
};
