// Task 6.1: TypeScript type definitions for assignment features
// Requirements: 2.1, 2.7, 3.1

/**
 * Assignment status for a user
 */
export interface AssignmentStatus {
  isAssigned: boolean;
  photographerId: string | null;
  photographerName: string | null;
  clientId: string | null;
  /** All admin IDs this user is linked to (multi-admin support) */
  adminIds: string[];
  /** All client IDs for this user (one per linked admin) */
  clientIds: string[];
  loading?: boolean;
  refresh?: () => void;
}

/**
 * Result from assignment operations (code entry, QR scan, etc.)
 */
export interface AssignmentResult {
  success: boolean;
  error?: string;
  admin_id?: string;
  admin_name?: string;
  client_id?: string;
  auto_assigned?: boolean;
  message?: string;
}

/**
 * Input for creating a new client record
 */
export interface CreateClientInput {
  name: string;
  mobile_number: string;
  email?: string | null;
  notes?: string | null;
}

/**
 * Client assignment log entry
 */
export interface ClientAssignmentLog {
  id: string;
  client_id: string;
  admin_id: string;
  assigned_via: 'code_entry' | 'qr_scan' | 'invite_link' | 'admin_invite';
  created_at: string;
}

/**
 * Client record from database
 */
export interface Client {
  id: string;
  user_id: string | null;
  owner_admin_id: string | null;
  name: string;
  mobile_number: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Photographer code validation result
 */
export interface PhotographerCodeValidation {
  valid: boolean;
  photographer_id?: string;
  photographer_name?: string;
  error?: string;
}
