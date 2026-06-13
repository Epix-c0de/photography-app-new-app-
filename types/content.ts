// Task 6.3: TypeScript type definitions for content visibility
// Requirements: 13.1, 13.2

/**
 * Content visibility level
 */
export type VisibilityLevel = 'global' | 'assigned_only' | 'private';

/**
 * BTS Post with visibility field
 */
export interface BTSPost {
  id: string;
  admin_id: string;
  title: string;
  content: string;
  image_url: string | null;
  visibility: VisibilityLevel;
  created_at: string;
  updated_at: string;
  admin_name?: string;
}

/**
 * Announcement with visibility field
 */
export interface Announcement {
  id: string;
  admin_id: string;
  title: string;
  content: string;
  image_url: string | null;
  visibility: VisibilityLevel;
  created_at: string;
  updated_at: string;
  admin_name?: string;
}

/**
 * Content visibility selector options for UI
 */
export interface VisibilityOption {
  value: VisibilityLevel;
  label: string;
  description: string;
}

/**
 * Visibility filter for content queries
 */
export interface ContentVisibilityFilter {
  includeGlobal: boolean;
  includeAssignedOnly: boolean;
  includePrivate: boolean;
  photographerId?: string;
}

/**
 * Content preview for roadblock screen
 */
export interface ContentPreview {
  id: string;
  type: 'bts' | 'announcement';
  title: string;
  excerpt: string;
  image_url: string | null;
  visibility: VisibilityLevel;
  admin_name: string;
  created_at: string;
}

/**
 * Content filter result from RPC
 */
export interface VisibleContent {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  admin_id: string;
  visibility: VisibilityLevel;
  created_at: string;
  updated_at: string;
  admin_name: string | null;
}
