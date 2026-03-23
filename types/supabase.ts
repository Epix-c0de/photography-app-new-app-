export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: any[]
      }
      delivery_gateways: {
        Row: {
          id: string
          name: string
          type: 'http' | 'smpp' | 'whatsapp_cloud' | 'local_modem'
          config: Json
          priority: number
          active: boolean
          cost_per_msg: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'http' | 'smpp' | 'whatsapp_cloud' | 'local_modem'
          config?: Json
          priority?: number
          active?: boolean
          cost_per_msg?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'http' | 'smpp' | 'whatsapp_cloud' | 'local_modem'
          config?: Json
          priority?: number
          active?: boolean
          cost_per_msg?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_credits: {
        Row: {
          id: string
          balance: number
          warning_threshold: number
          critical_threshold: number
          auto_refill_enabled: boolean
          auto_refill_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          balance?: number
          warning_threshold?: number
          critical_threshold?: number
          auto_refill_enabled?: boolean
          auto_refill_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          balance?: number
          warning_threshold?: number
          critical_threshold?: number
          auto_refill_enabled?: boolean
          auto_refill_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_codes: {
        Row: {
          id: string
          client_id: string
          code_hash: string
          status: 'active' | 'used' | 'expired'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          code_hash: string
          status?: 'active' | 'used' | 'expired'
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          code_hash?: string
          status?: 'active' | 'used' | 'expired'
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      delivery_logs: {
        Row: {
          id: string
          recipient: string
          message_type: 'sms' | 'whatsapp'
          gateway_id: string | null
          status: 'pending' | 'sent' | 'delivered' | 'failed' | 'blocked'
          attempts: number
          cost: number
          external_id: string | null
          error_code: string | null
          error_message: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          recipient: string
          message_type: 'sms' | 'whatsapp'
          gateway_id?: string | null
          status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'blocked'
          attempts?: number
          cost?: number
          external_id?: string | null
          error_code?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          recipient?: string
          message_type?: 'sms' | 'whatsapp'
          gateway_id?: string | null
          status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'blocked'
          attempts?: number
          cost?: number
          external_id?: string | null
          error_code?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logs_gateway_id_fkey"
            columns: ["gateway_id"]
            referencedRelation: "delivery_gateways"
            referencedColumns: ["id"]
          }
        ]
      }
      sms_logs: {
        Row: {
          id: string
          owner_admin_id: string
          client_id: string | null
          phone_number: string
          message: string
          status: 'queued' | 'sent' | 'failed'
          cost: number | null
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          client_id?: string | null
          phone_number: string
          message: string
          status?: 'queued' | 'sent' | 'failed'
          cost?: number | null
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          client_id?: string | null
          phone_number?: string
          message?: string
          status?: 'queued' | 'sent' | 'failed'
          cost?: number | null
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      sms_templates: {
        Row: {
          id: string
          owner_admin_id: string
          name: string
          body: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          name: string
          body: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          name?: string
          body?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_drafts: {
        Row: {
          id: string
          owner_admin_id: string
          client_id: string | null
          phone_number: string
          message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          client_id?: string | null
          phone_number: string
          message: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          client_id?: string | null
          phone_number?: string
          message?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      messages: {
        Row: {
          id: string
          owner_admin_id: string
          client_id: string
          sender_role: 'admin' | 'client'
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          client_id: string
          sender_role: 'admin' | 'client'
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          client_id?: string
          sender_role?: 'admin' | 'client'
          content?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      brand_settings: {
        Row: {
          id: string
          admin_id: string
          brand_name: string
          tagline: string | null
          logo_url: string | null
          app_display_name: string | null
          watermark_text: string | null
          watermark_logo_url: string | null
          watermark_opacity: number
          watermark_rotation: number
          watermark_size: 'small' | 'medium' | 'large'
          watermark_position: 'center' | 'grid' | 'randomized'
          embed_client_name: boolean
          embed_gallery_code: boolean
          block_screenshots: boolean
          custom_app_icon_url: string | null
          custom_package_name: string | null
          share_app_link: string
          access_code_link: string
          bts_share_link: string | null
          announcement_share_link: string | null
          gallery_share_link: string | null
          referral_link: string | null
          whatsapp_share_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          brand_name?: string
          tagline?: string | null
          logo_url?: string | null
          app_display_name?: string | null
          watermark_text?: string | null
          watermark_logo_url?: string | null
          watermark_opacity?: number
          watermark_rotation?: number
          watermark_size?: 'small' | 'medium' | 'large'
          watermark_position?: 'center' | 'grid' | 'randomized'
          embed_client_name?: boolean
          embed_gallery_code?: boolean
          block_screenshots?: boolean
          custom_app_icon_url?: string | null
          custom_package_name?: string | null
          share_app_link?: string
          access_code_link?: string
          bts_share_link?: string | null
          announcement_share_link?: string | null
          gallery_share_link?: string | null
          referral_link?: string | null
          whatsapp_share_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          brand_name?: string
          tagline?: string | null
          logo_url?: string | null
          app_display_name?: string | null
          watermark_text?: string | null
          watermark_logo_url?: string | null
          watermark_opacity?: number
          watermark_rotation?: number
          watermark_size?: 'small' | 'medium' | 'large'
          watermark_position?: 'center' | 'grid' | 'randomized'
          embed_client_name?: boolean
          embed_gallery_code?: boolean
          block_screenshots?: boolean
          custom_app_icon_url?: string | null
          custom_package_name?: string | null
          share_app_link?: string
          access_code_link?: string
          bts_share_link?: string | null
          announcement_share_link?: string | null
          gallery_share_link?: string | null
          referral_link?: string | null
          whatsapp_share_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_settings_admin_id_fkey"
            columns: ["admin_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      admin_users: {
        Row: {
          id: string
          email: string
          role: 'super_admin' | 'admin' | 'support_admin'
          name: string
          password_hash: string
          force_password_change: boolean
          biometric_enabled: boolean
          pin_hash: string | null
          pin_enabled: boolean
          failed_attempts: number
          account_locked_until: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          last_login_at: string | null
        }
        Insert: {
          id?: string
          email: string
          role: 'super_admin' | 'admin' | 'support_admin'
          name: string
          password_hash: string
          force_password_change?: boolean
          biometric_enabled?: boolean
          pin_hash?: string | null
          pin_enabled?: boolean
          failed_attempts?: number
          account_locked_until?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: 'super_admin' | 'admin' | 'support_admin'
          name?: string
          password_hash?: string
          force_password_change?: boolean
          biometric_enabled?: boolean
          pin_hash?: string | null
          pin_enabled?: boolean
          failed_attempts?: number
          account_locked_until?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
        Relationships: never[]
      }
      admin_audit_logs: {
        Row: {
          id: string
          admin_id: string
          action: string
          ip_address: string | null
          device_info: string | null
          details: Json | null
          timestamp: string
        }
        Insert: {
          id?: string
          admin_id: string
          action: string
          ip_address?: string | null
          device_info?: string | null
          details?: Json | null
          timestamp?: string
        }
        Update: {
          id?: string
          admin_id?: string
          action?: string
          ip_address?: string | null
          device_info?: string | null
          details?: Json | null
          timestamp?: string
        }
        Relationships: never[]
      }
      user_profiles: {
        Row: {
          id: string
          role: 'admin' | 'client' | 'super_admin'
          name: string | null
          phone: string | null
          email: string | null
          avatar_url: string | null
          phone_verified: boolean
          pin_hash: string | null
          biometric_enabled: boolean | null
          client_type: string | null
          profile_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'admin' | 'client' | 'super_admin'
          name?: string | null
          phone?: string | null
          email?: string | null
          avatar_url?: string | null
          phone_verified?: boolean
          pin_hash?: string | null
          biometric_enabled?: boolean | null
          profile_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'client' | 'super_admin'
          name?: string | null
          phone?: string | null
          email?: string | null
          avatar_url?: string | null
          phone_verified?: boolean
          pin_hash?: string | null
          biometric_enabled?: boolean | null
          profile_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: never[]
      }
      clients: {
        Row: {
          id: string
          owner_admin_id: string
          user_id: string | null
          name: string
          phone: string | null
          email: string | null
          notes: string | null
          total_paid: number
          last_shoot_date: string | null
          preferred_package: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          user_id?: string | null
          name: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          total_paid?: number
          last_shoot_date?: string | null
          preferred_package?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          user_id?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          total_paid?: number
          last_shoot_date?: string | null
          preferred_package?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: never[]
      }
      galleries: {
        Row: {
          id: string
          owner_admin_id: string
          client_id: string
          name: string
          cover_photo_url: string | null
          access_code: string
          is_paid: boolean
          is_locked: boolean
          price: number
          shoot_type: string | null
          scheduled_release: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          client_id: string
          name: string
          cover_photo_url?: string | null
          access_code: string
          is_paid?: boolean
          is_locked?: boolean
          price?: number
          shoot_type?: string | null
          scheduled_release?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          client_id?: string
          name?: string
          cover_photo_url?: string | null
          access_code?: string
          is_paid?: boolean
          is_locked?: boolean
          price?: number
          shoot_type?: string | null
          scheduled_release?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "galleries_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galleries_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      gallery_photos: {
        Row: {
          id: string
          gallery_id: string
          photo_url: string
          file_name: string
          file_size: number
          mime_type: string
          width: number | null
          height: number | null
          is_watermarked: boolean
          upload_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gallery_id: string
          photo_url: string
          file_name: string
          file_size: number
          mime_type: string
          width?: number | null
          height?: number | null
          is_watermarked?: boolean
          upload_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gallery_id?: string
          photo_url?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          width?: number | null
          height?: number | null
          is_watermarked?: boolean
          upload_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_gallery_id_fkey"
            columns: ["gallery_id"]
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          }
        ]
      }
      temporary_client_uploads: {
        Row: {
          id: string
          admin_id: string | null
          temporary_name: string
          temporary_identifier: string | null
          access_code: string
          photo_path: string
          file_name: string
          file_size: number
          mime_type: string
          width: number | null
          height: number | null
          upload_order: number
          upload_timestamp: string
          sync_status: 'pending' | 'synced' | 'failed'
          synced_at: string | null
          client_id: string | null
          gallery_id: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          admin_id?: string | null
          temporary_name: string
          temporary_identifier?: string | null
          access_code: string
          photo_path: string
          file_name: string
          file_size?: number
          mime_type?: string
          width?: number | null
          height?: number | null
          upload_order?: number
          upload_timestamp?: string
          sync_status?: 'pending' | 'synced' | 'failed'
          synced_at?: string | null
          client_id?: string | null
          gallery_id?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          admin_id?: string | null
          temporary_name?: string
          temporary_identifier?: string | null
          access_code?: string
          photo_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          width?: number | null
          height?: number | null
          upload_order?: number
          upload_timestamp?: string
          sync_status?: 'pending' | 'synced' | 'failed'
          synced_at?: string | null
          client_id?: string | null
          gallery_id?: string | null
          error_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temporary_client_uploads_admin_id_fkey"
            columns: ["admin_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_client_uploads_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_client_uploads_gallery_id_fkey"
            columns: ["gallery_id"]
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          }
        ]
      }
      photos: {
        Row: {
          id: string
          gallery_id: string
          storage_path: string
          variant: 'watermarked' | 'clean'
          width: number | null
          height: number | null
          size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          gallery_id: string
          storage_path: string
          variant: 'watermarked' | 'clean'
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          gallery_id?: string
          storage_path?: string
          variant?: 'watermarked' | 'clean'
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_gallery_id_fkey"
            columns: ["gallery_id"]
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          }
        ]
      }

      packages: {
        Row: {
          id: string
          owner_admin_id: string
          name: string
          price: number
          sms_included: number
          storage_limit_gb: number
          features: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          name: string
          price?: number
          sms_included?: number
          storage_limit_gb?: number
          features?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          name?: string
          price?: number
          sms_included?: number
          storage_limit_gb?: number
          features?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          id: string
          user_id: string
          package_id: string | null
          status: 'booked' | 'confirmed' | 'completed' | 'editing' | 'ready'
          date: string
          time: string
          location: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          package_id?: string | null
          status: 'booked' | 'confirmed' | 'completed' | 'editing' | 'ready'
          date: string
          time: string
          location: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          package_id?: string | null
          status?: 'booked' | 'confirmed' | 'completed' | 'editing' | 'ready'
          date?: string
          time?: string
          location?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          id: string
          owner_admin_id: string
          client_id: string
          gallery_id: string | null
          amount: number
          currency: string
          status: 'pending' | 'paid' | 'failed' | 'cancelled'
          mpesa_receipt_number: string | null
          mpesa_checkout_request_id: string | null
          phone_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_admin_id: string
          client_id: string
          gallery_id?: string | null
          amount: number
          currency?: string
          status?: 'pending' | 'paid' | 'failed' | 'cancelled'
          mpesa_receipt_number?: string | null
          mpesa_checkout_request_id?: string | null
          phone_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_admin_id?: string
          client_id?: string
          gallery_id?: string | null
          amount?: number
          currency?: string
          status?: 'pending' | 'paid' | 'failed' | 'cancelled'
          mpesa_receipt_number?: string | null
          mpesa_checkout_request_id?: string | null
          phone_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_gallery_id_fkey"
            columns: ["gallery_id"]
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      bts_posts: {
        Row: {
          id: string
          title: string | null
          media_url: string
          image_url: string | null
          media_type: 'image' | 'video'
          category: string | null
          created_at: string
          expires_at: string | null
          scheduled_for: string | null
          has_music: boolean
          music_url: string | null
          views_count: number
          clicks_count: number
          target_audience: string[] | null
          is_active: boolean
          shoot_type: string | null
          created_by: string | null
          likes_count: number
          comments_count: number
        }
        Insert: {
          id?: string
          title?: string | null
          media_url: string
          image_url?: string | null
          media_type: 'image' | 'video'
          category?: string | null
          created_at?: string
          expires_at?: string | null
          scheduled_for?: string | null
          has_music?: boolean
          music_url?: string | null
          views_count?: number
          clicks_count?: number
          target_audience?: string[] | null
          is_active?: boolean
          shoot_type?: string | null
          created_by?: string | null
          likes_count?: number
          comments_count?: number
        }
        Update: {
          id?: string
          title?: string | null
          media_url?: string
          image_url?: string | null
          media_type?: 'image' | 'video'
          category?: string | null
          created_at?: string
          expires_at?: string | null
          scheduled_for?: string | null
          has_music?: boolean
          music_url?: string | null
          views_count?: number
          clicks_count?: number
          target_audience?: string[] | null
          is_active?: boolean
          shoot_type?: string | null
          created_by?: string | null
          likes_count?: number
          comments_count?: number
        }
        Relationships: never[]
      }
      announcements: {
        Row: {
          id: string
          title: string
          description: string | null
          content_html: string | null
          image_url: string | null
          media_url: string | null
          media_type: 'image' | 'video' | null
          tag: string | null
          category: string | null
          cta: string | null
          created_at: string
          expires_at: string | null
          scheduled_for: string | null
          views_count: number
          clicks_count: number
          target_audience: string[] | null
          is_active: boolean
          created_by: string | null
          comments_count: number
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          content_html?: string | null
          image_url?: string | null
          media_url?: string | null
          media_type?: 'image' | 'video' | null
          tag?: string | null
          category?: string | null
          cta?: string | null
          created_at?: string
          expires_at: string | null
          scheduled_for?: string | null
          views_count?: number
          clicks_count?: number
          target_audience?: string[] | null
          is_active?: boolean
          created_by?: string | null
          comments_count?: number
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          content_html?: string | null
          image_url?: string | null
          media_url?: string | null
          media_type?: 'image' | 'video' | null
          tag?: string | null
          category?: string | null
          cta?: string | null
          created_at?: string
          expires_at?: string
          is_active?: boolean
          created_by?: string | null
          comments_count?: number
        }
        Relationships: never[]
      }
      bts_comments: {
        Row: {
          id: string
          bts_id: string
          client_id: string
          comment: string
          created_at: string
        }
        Insert: {
          id?: string
          bts_id: string
          client_id: string
          comment: string
          created_at?: string
        }
        Update: {
          id?: string
          bts_id?: string
          client_id?: string
          comment?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bts_comments_bts_id_fkey"
            columns: ["bts_id"]
            referencedRelation: "bts_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bts_comments_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      announcement_comments: {
        Row: {
          id: string
          announcement_id: string
          client_id: string
          comment: string
          created_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          client_id: string
          comment: string
          created_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          client_id?: string
          comment?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      bts_likes: {
        Row: {
          user_id: string
          bts_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          bts_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          bts_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bts_likes_bts_id_fkey"
            columns: ["bts_id"]
            referencedRelation: "bts_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bts_likes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          data: Json | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      },




    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      sync_temp_uploads_for_user: {
        Args: {
          p_access_code?: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
