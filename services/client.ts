import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Gallery = Database['public']['Tables']['galleries']['Row'] & {
  cover_photo?: string; // Signed URL
  photo_count?: number;
};

export type Photo = Database['public']['Tables']['gallery_photos']['Row'] & {
  url: string; // Signed URL for full image
  thumbnailUrl?: string; // Signed URL for thumbnail
  variant: 'clean' | 'watermarked';
};

export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PaymentStatus = Database['public']['Tables']['payments']['Row']['status'];
export type PortfolioItem = {
  id: string;
  title: string | null;
  media_url: string;
  image_url: string | null;
  media_type: 'image' | 'video';
  category: string | null;
  content_type: 'bts' | 'portfolio';
  is_public: boolean;
  is_top_rated: boolean;
  likes_count: number;
  shares_count: number;
  created_at: string;
  expires_at: string | null;
  created_by: string | null;
};

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

  clients: {
    ensureLinkedRecordsForCurrentUser: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, phone, email')
        .eq('id', user.id)
        .maybeSingle();
      const { data: unlocked, error } = await supabase
        .from('galleries')
        .select('owner_admin_id, unlocked_galleries!inner(user_id)')
        .eq('unlocked_galleries.user_id', user.id);
      if (error || !unlocked) return 0;
      const adminIds = Array.from(new Set(unlocked.map((g: any) => g.owner_admin_id).filter(Boolean)));
      
      // If no unlocked galleries, add a default admin (first admin alphabetically)
      if (adminIds.length === 0) {
        const { data: allAdmins, error: adminError } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('role', ['admin', 'super_admin'])
          .order('email', { ascending: true });
        if (!adminError && allAdmins && allAdmins.length > 0) {
          adminIds.push(allAdmins[0].id);
        }
      }
      
      let created = 0;
      for (const adminId of adminIds) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('owner_admin_id', adminId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!existing?.id) {
          const { data: inserted } = await supabase
            .from('clients')
            .insert({
              owner_admin_id: adminId,
              user_id: user.id,
              name: profile?.name ?? 'Client',
              phone: profile?.phone ?? null,
              email: profile?.email ?? null
            })
            .select('id')
            .single();
          if (inserted?.id) created += 1;
        }
      }
      return created;
    }
  },

  /**
   * 2. GALLERY & PHOTO APIs
   */
  gallery: {
    list: async (): Promise<Gallery[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client?.id) return [];

      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('client_id', client.id)
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
      const variant: 'clean' | 'watermarked' = canViewClean ? 'clean' : 'watermarked';

      const { data: photos, error: pError } = await supabase
        .from('gallery_photos')
        .select('*')
        .eq('gallery_id', galleryId)
        .order('upload_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (pError) throw pError;

      // 4. Generate Signed URLs for both full images and thumbnails
      const photosWithUrls = await Promise.all(photos.map(async (p) => {
        // Sign full image URL
        const { data: fullData, error: fullError } = await supabase.storage
          .from('client-photos')
          .createSignedUrl(p.photo_url, 3600);

        if (fullError) {
          console.warn(`Failed to sign URL for ${p.photo_url}`, fullError);
          return { ...p, url: '', thumbnailUrl: '', variant };
        }

        // Try to sign thumbnail URL
        // Thumbnail naming convention: remove extension and add _thumb.png
        const photoNameParts = p.photo_url.split('.');
        const photoNameNoExt = photoNameParts.slice(0, -1).join('.');
        const thumbnailPath = `${photoNameNoExt}_thumb.png`;
        
        let thumbnailUrl = '';
        try {
          const { data: thumbData, error: thumbError } = await supabase.storage
            .from('thumbnails')
            .createSignedUrl(thumbnailPath, 3600);

          if (!thumbError && thumbData?.signedUrl) {
            thumbnailUrl = thumbData.signedUrl;
            console.log(`[Gallery] ✓ Loaded thumbnail for ${p.file_name}`);
          } else {
            console.warn(`[Gallery] Thumbnail not found for ${p.file_name}, using full image as fallback`);
            // Use full image as fallback if thumbnail doesn't exist
            thumbnailUrl = fullData?.signedUrl || '';
          }
        } catch (err) {
          console.warn(`[Gallery] Error fetching thumbnail for ${p.file_name}:`, err);
          // Fallback to full image URL
          thumbnailUrl = fullData?.signedUrl || '';
        }

        return { 
          ...p, 
          url: fullData?.signedUrl || '', 
          thumbnailUrl: thumbnailUrl || fullData?.signedUrl || '',
          variant 
        };
      }));

      return photosWithUrls as Photo[];
    }
  },

  tempUploads: {
    syncForCurrentUser: async () => {
      const { data, error } = await supabase.rpc('sync_temp_uploads_for_user', { p_access_code: null });
      if (error) throw error;
      return data;
    },
    syncByAccessCode: async (accessCode: string) => {
      const normalizedCode = accessCode.trim().toUpperCase();
      const { data, error } = await supabase.rpc('sync_temp_uploads_for_user', { p_access_code: normalizedCode });
      if (error) throw error;
      return data;
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
    list: async (): Promise<Database['public']['Tables']['bts_posts']['Row'][]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('bts_posts')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    }
  },

  /**
   * 6. MESSAGING SYSTEM
   */
  messaging: {
    list: async (clientId: string) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return data;
    },

    send: async (clientId: string, ownerAdminId: string, content: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          client_id: clientId,
          owner_admin_id: ownerAdminId,
          sender_role: 'client',
          content: content,
          is_read: false
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },

    getClientForAdmin: async (adminId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('clients')
        .select('id, owner_admin_id')
        .eq('user_id', user.id)
        .eq('owner_admin_id', adminId)
        .maybeSingle();

      if (error) return null;
      return data;
    }
  },

  /**
   * 7. ANNOUNCEMENTS
   */
  announcements: {
    list: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          announcement_comments (id, user_id, content, created_at, user_profiles:user_id (id, name, avatar_url)),
          announcement_reactions (id, user_id, reaction_emoji),
          user_profiles:owner_admin_id (id, name, avatar_url)
        `)
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    listByAdmin: async (adminId: string) => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          announcement_comments (id, user_id, content, created_at, user_profiles:user_id (id, name, avatar_url)),
          announcement_reactions (id, user_id, reaction_emoji)
        `)
        .eq('owner_admin_id', adminId)
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    get: async (id: string) => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          announcement_comments (id, user_id, content, created_at, user_profiles:user_id (id, name, avatar_url)),
          announcement_reactions (id, user_id, reaction_emoji),
          user_profiles:owner_admin_id (id, name, avatar_url)
        `)
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    },

    addComment: async (announcementId: string, content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get client record for this user to get client_id
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client?.id) throw new Error('Client record not found');

      const { data, error } = await supabase
        .from('announcement_comments')
        .insert({
          announcement_id: announcementId,
          client_id: client.id,
          comment: content
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    addReaction: async (announcementId: string, reactionEmoji: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Try to insert, if it already exists, delete it (toggle behavior)
      const { data: existing } = await supabase
        .from('announcement_reactions')
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('user_id', user.id)
        .eq('reaction_emoji', reactionEmoji)
        .maybeSingle();

      if (existing) {
        // Already reacted with this emoji, remove it
        await supabase
          .from('announcement_reactions')
          .delete()
          .eq('id', existing.id);
        return null;
      }

      // Add new reaction
      const { data, error } = await supabase
        .from('announcement_reactions')
        .insert({
          announcement_id: announcementId,
          user_id: user.id,
          reaction_emoji: reactionEmoji
        })
        .select()
        .single();

      if (error && (error as any)?.code !== '23505') throw error;
      return data;
    },

    deleteComment: async (commentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('announcement_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    },

    subscribeToAnnouncements: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    subscribeToComments: (announcementId: string, callback: (payload: any) => void) => {
      const channel = supabase
        .channel(`public:comments:${announcementId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${announcementId}` }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    subscribeToReactions: (announcementId: string, callback: (payload: any) => void) => {
      const channel = supabase
        .channel(`public:reactions:${announcementId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reactions', filter: `announcement_id=eq.${announcementId}` }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  /**
  /**
   * 8. PORTFOLIO
   */
  portfolio: {
    list: async (): Promise<PortfolioItem[]> => {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []) as PortfolioItem[];
    },

    listByType: async (contentType: 'bts' | 'portfolio'): Promise<PortfolioItem[]> => {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('is_active', true)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []) as PortfolioItem[];
    },

    listTopRated: async (): Promise<PortfolioItem[]> => {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('is_active', true)
        .eq('is_top_rated', true)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []) as PortfolioItem[];
    },

    subscribeToPortfolio: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:portfolio_items')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portfolio_items', filter: 'is_active=eq.true' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    toggleLike: async (itemId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('portfolio_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('portfolio_item_id', itemId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('portfolio_likes')
          .delete()
          .eq('id', existing.id);
        return false; // Unliked
      } else {
        await supabase
          .from('portfolio_likes')
          .insert({
            user_id: user.id,
            portfolio_item_id: itemId
          });
        return true; // Liked
      }
    },

    incrementShare: async (itemId: string) => {
      // Atomic increment for shares
      const { error } = await supabase.rpc('increment_portfolio_shares', { item_id: itemId });
      if (error) {
        // Fallback if RPC doesn't exist
        const { data } = await supabase.from('portfolio_items').select('shares_count').eq('id', itemId).single();
        await supabase.from('portfolio_items').update({ shares_count: (data?.shares_count || 0) + 1 }).eq('id', itemId);
      }
    }
  }
};
