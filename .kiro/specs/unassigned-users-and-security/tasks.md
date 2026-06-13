# Implementation Plan: Unassigned Users and Security Features

## Overview

This implementation plan covers the complete development of unassigned user access flows, photographer-client assignment system, security feature backend integration, database migration fixes, and analytics tracking. The plan is structured to enable incremental delivery with early validation of core functionality.

## Tasks

- [x] 1. Create database migrations for security and assignment features
  - [x] 1.1 Create migration for user_profiles security columns
    - Add biometric_enabled, pin_hash, password_changed_at, 2fa_enabled, 2fa_secret, 2fa_backup_codes, last_password_change_reminder columns
    - Create indexes for performance (idx_user_profiles_biometric, idx_user_profiles_pin)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 1.2 Create migration for unassigned_user_sessions table
    - Create table with session tracking fields (session_start, session_end, content_views, code_entry_attempts, assigned_at, assigned_via, time_to_assignment_seconds)
    - Create indexes for user_id and session_start
    - _Requirements: 14.6_

  - [x] 1.3 Create migration for content visibility columns
    - Add visibility column to bts_posts table with CHECK constraint ('global', 'assigned_only', 'private')
    - Add visibility column to announcements table with CHECK constraint
    - Create indexes on visibility columns
    - _Requirements: 13.1, 13.2, 13.7, 13.8_

  - [x] 1.4 Create migration fixing payment status enum
    - Add 'refunded' value to payment_status enum
    - Update handle_payment_refund() function to handle both 'refunded' and 'cancelled'
    - Update trigger_payment_refund trigger
    - _Requirements: 5.2, 5.3, 5.6, 5.7_

  - [x] 1.5 Create migration fixing admin_subscriptions and revenue_pipeline view
    - Add payment_method column to admin_subscriptions table if not exists
    - Drop and recreate revenue_pipeline view with correct column reference
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 2. Implement backend assignment functions
  - [x] 2.1 Create auto_assign_on_login RPC function
    - Implement SQL function to match mobile numbers and auto-assign clients
    - Log assignment in client_assignment_log with assigned_via='admin_invite'
    - Return JSONB with success, auto_assigned, admin_id, admin_name
    - _Requirements: 3.3, 3.4_

  - [x] 2.2 Create client_needs_assignment RPC function
    - Implement SQL function to check if user has owner_admin_id
    - Return BOOLEAN
    - _Requirements: 1.1_

  - [x] 2.3 Create close_unassigned_session_on_assignment trigger function
    - Implement trigger to close unassigned sessions when client gets assigned
    - Calculate time_to_assignment_seconds
    - _Requirements: 14.5_

  - [x] 2.4 Create trigger on clients table for session closure
    - Create AFTER UPDATE trigger calling close_unassigned_session_on_assignment
    - Fire only when owner_admin_id changes from NULL to non-NULL
    - _Requirements: 14.5_

- [x] 3. Implement backend security functions
  - [x] 3.1 Create update_biometric_setting RPC function
    - Implement SQL function to update user_profiles.biometric_enabled
    - Add security check (id = auth.uid())
    - Log change to admin_audit_log
    - _Requirements: 8.4, 8.5, 8.10_

  - [x] 3.2 Create set_pin_hash RPC function
    - Implement SQL function to update user_profiles.pin_hash
    - Add security check (id = auth.uid())
    - Log change to admin_audit_log
    - _Requirements: 9.3, 9.4_

  - [x] 3.3 Create remove_pin_lock RPC function
    - Implement SQL function to set user_profiles.pin_hash to NULL
    - Add security check (id = auth.uid())
    - Log change to admin_audit_log
    - _Requirements: 9.4_

  - [x] 3.4 Create sync_password_changed_timestamp trigger function
    - Implement trigger function on auth.users
    - Update user_profiles.password_changed_at when encrypted_password changes
    - _Requirements: 7.9, 12.8_

- [x] 4. Implement backend content filtering functions
  - [x] 4.1 Create get_visible_content_for_user RPC function
    - Implement SQL function accepting user_id and content_type ('bts' or 'announcements')
    - Get user's assigned photographer from clients table
    - Return content where visibility='global' OR (visibility='assigned_only' AND admin_id=photographer_id)
    - _Requirements: 4.3, 4.4, 13.3, 13.4, 13.5, 13.10_

  - [x] 4.2 Create log_unassigned_user_event RPC function
    - Implement SQL function to log user events (landed, code_entered, viewed_bts, viewed_announcement)
    - Get or create active session in unassigned_user_sessions
    - Update content_views JSONB or code_entry_attempts based on event_type
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 5. Checkpoint - Verify all database functions and migrations
  - Ensure all migrations run successfully
  - Ensure all RPC functions are created
  - Test each function with sample data
  - Ask the user if questions arise

- [x] 6. Create TypeScript type definitions for assignment and security
  - [x] 6.1 Create types/assignment.ts file
    - Define AssignmentStatus interface (isAssigned, photographerId, photographerName, clientId)
    - Define AssignmentResult interface (success, error, admin_id, admin_name)
    - Define CreateClientInput interface (name, mobile_number, email, notes)
    - _Requirements: 2.1, 2.7, 3.1_

  - [x] 6.2 Create types/security.ts file
    - Define SecurityProfile interface (biometric_enabled, pin_hash, password_changed_at, last_password_change_reminder, 2fa_enabled, 2fa_secret)
    - Define PasswordValidationResult interface (valid, errors)
    - Define BiometricAuthResult interface (success, error, biometricType)
    - Define PINOperationResult interface (success, error, attemptsRemaining)
    - _Requirements: 7.3, 7.4, 8.1, 9.1_

  - [x] 6.3 Create types/content.ts file
    - Define VisibilityLevel type ('global' | 'assigned_only' | 'private')
    - Define BTSPost interface with visibility field
    - Define Announcement interface with visibility field
    - _Requirements: 13.1, 13.2_

- [x] 7. Implement useAssignmentStatus hook for user app
  - [x] 7.1 Create split-apps/user-app/hooks/useAssignmentStatus.ts
    - Implement React hook fetching assignment status from clients table
    - Query: SELECT c.id, c.owner_admin_id, up.name FROM clients c LEFT JOIN user_profiles up WHERE c.user_id = $userId
    - Return AssignmentStatus with isAssigned, photographerId, photographerName, clientId, loading, refresh
    - Cache result in memory for session
    - Subscribe to real-time changes on clients table
    - _Requirements: 1.1, 4.1, 20.4_

  - [ ]* 7.2 Write unit tests for useAssignmentStatus hook
    - Test initial loading state
    - Test assigned user scenario
    - Test unassigned user scenario
    - Test refresh function
    - Test real-time subscription updates
    - _Requirements: 20.1_

- [x] 8. Implement RoadblockScreen component for user app
  - [x] 8.1 Create split-apps/user-app/app/roadblock.tsx
    - Implement screen with hero section, illustration, and call-to-action
    - Display "Enter Photographer Code" button
    - Display "Skip" button to browse global content
    - Fetch and display global BTS posts (visibility='global')
    - Fetch and display global announcements (visibility='global')
    - Use card-based layout for content previews
    - Add smooth animation transitions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.9, 19.10_

  - [ ]* 8.2 Write integration tests for RoadblockScreen
    - Test rendering with global content
    - Test "Enter Photographer Code" button navigation
    - Test "Skip" button behavior
    - Test content preview cards display
    - _Requirements: 1.1, 19.1_

- [x] 9. Implement CodeEntryModal component for user app
  - [x] 9.1 Create split-apps/user-app/components/CodeEntryModal.tsx
    - Implement modal with code input field (8 characters, alphanumeric, auto-uppercase)
    - Add validation: exactly 8 characters, alphanumeric only
    - Call assign_client_to_photographer RPC with client_id and photographer_code
    - Display success message: "Connected to [Photographer Name]!"
    - Handle errors: invalid code, already assigned, network error
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 2.10_

  - [ ]* 9.2 Write unit tests for CodeEntryModal
    - Test code validation rules
    - Test auto-uppercase conversion
    - Test API call on submit
    - Test error handling for invalid codes
    - Test error handling for already assigned users
    - _Requirements: 2.2, 2.10_

- [ ] 10. Implement QRCodeScanner component for user app
  - [x] 10.1 Create split-apps/user-app/components/QRCodeScanner.tsx
    - Implement QR scanner using expo-camera
    - Request camera permissions
    - Validate scanned QR code format
    - Extract photographer code from QR payload
    - Call assign_client_to_photographer with assigned_via='qr_scan'
    - _Requirements: 2.5_

  - [ ]* 10.2 Write integration tests for QRCodeScanner
    - Test camera permission request
    - Test QR code format validation
    - Test code extraction from QR payload
    - Test assignment API call with correct parameters
    - _Requirements: 2.5_

- [x] 11. Implement assignment status check in app launch flow
  - [x] 11.1 Update split-apps/user-app/app/_layout.tsx
    - Import useAssignmentStatus hook
    - Check assignment status on app launch
    - If unassigned, navigate to /roadblock screen
    - If assigned, proceed to home screen
    - Call auto_assign_on_login RPC on login with mobile number
    - Display success toast if auto-assigned
    - _Requirements: 1.1, 3.3, 3.4, 4.8_

  - [ ]* 11.2 Write integration tests for app launch flow
    - Test unassigned user redirected to roadblock
    - Test assigned user proceeds to home
    - Test auto-assignment on login
    - _Requirements: 1.1, 3.3_

- [x] 12. Checkpoint - Verify assignment flow works end-to-end
  - Test unassigned user sees roadblock screen
  - Test photographer code entry flow
  - Test QR code scanning flow
  - Test auto-assignment on login
  - Ensure all tests pass, ask the user if questions arise

- [x] 13. Implement CreateClientForm component for admin app
  - [x] 13.1 Create split-apps/admin-app/components/CreateClientForm.tsx
    - Implement form with fields: name, mobile_number, email (optional), notes (optional)
    - Validate name minimum 2 characters
    - Validate mobile_number E.164 format (e.g., +254712345678)
    - Validate email RFC 5322 format if provided
    - Check for duplicate mobile numbers before submission
    - Insert into clients table with owner_admin_id = current admin
    - Call send_client_invite_sms RPC after creation
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 13.2 Write unit tests for CreateClientForm
    - Test name validation
    - Test mobile number E.164 format validation
    - Test email validation
    - Test duplicate mobile number detection
    - _Requirements: 3.7, 3.8_

- [x] 14. Implement PhotographerCodeDisplay component for admin app
  - [x] 14.1 Create split-apps/admin-app/components/PhotographerCodeDisplay.tsx
    - Display photographer code prominently
    - Add "Copy Code" button with clipboard and haptic feedback
    - Add "Share Code" button opening native share sheet with message template
    - Generate and display QR code containing photographer code
    - Add "Regenerate Code" button with confirmation dialog
    - Log code regeneration in admin_audit_log
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10_

  - [ ]* 14.2 Write integration tests for PhotographerCodeDisplay
    - Test copy to clipboard functionality
    - Test share sheet with correct message
    - Test QR code generation
    - Test code regeneration with confirmation
    - _Requirements: 15.2, 15.4, 15.8_

- [x] 15. Update admin settings screen to display photographer code
  - [x] 15.1 Update split-apps/admin-app/app/(admin)/settings/index.tsx
    - Fetch photographer code from user_profiles table
    - Display PhotographerCodeDisplay component
    - Add section header "Client Assignment Code"
    - _Requirements: 15.1_

- [x] 16. Implement PasswordChangeModal component for user app
  - [x] 16.1 Create split-apps/user-app/components/PasswordChangeModal.tsx
    - Implement modal with three secure text fields: current password, new password, confirm password
    - Validate new password: minimum 8 characters, at least one uppercase letter, at least one number
    - Validate passwords match
    - Verify current password using supabase.auth.signInWithPassword
    - Update password using supabase.auth.updateUser({ password: newPassword })
    - Log password change to admin_audit_log
    - Display success message "Password updated successfully"
    - Handle errors: incorrect current password, validation failures, API errors
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ]* 16.2 Write unit tests for PasswordChangeModal
    - Test password validation rules (length, uppercase, number)
    - Test passwords match validation
    - Test error handling for incorrect current password
    - Test success flow
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 17. Implement BiometricToggle component for user app
  - [x] 17.1 Create split-apps/user-app/components/BiometricToggle.tsx
    - Import LocalAuthentication from expo-local-authentication
    - Check hardware availability using LocalAuthentication.hasHardwareAsync()
    - Prompt for biometric authentication when enabling
    - Update user_profiles.biometric_enabled via update_biometric_setting RPC
    - Handle errors: hardware not available, authentication failed
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.10_

  - [ ]* 17.2 Write integration tests for BiometricToggle
    - Test hardware availability check
    - Test biometric prompt when enabling
    - Test database update after successful authentication
    - Test error handling for unsupported devices
    - _Requirements: 8.2, 8.8_

- [x] 18. Implement PINLockModal component for user app
  - [x] 18.1 Create split-apps/user-app/components/PINLockModal.tsx
    - Implement modal with states: CREATE_PIN, CONFIRM_PIN, VERIFY_PIN, CHANGE_PIN
    - Display large numeric keypad (0-9) with clear/backspace button
    - Display masked PIN input (••••••)
    - Hash PIN using SHA-256 before storage
    - Store hash using set_pin_hash RPC
    - Verify PIN by comparing hashes
    - Implement 3-attempt limit before lockout
    - Require password or biometric to reset after lockout
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.7, 9.8, 9.9, 9.10_

  - [ ]* 18.2 Write unit tests for PINLockModal
    - Test PIN creation flow
    - Test PIN confirmation matching
    - Test PIN hashing (SHA-256)
    - Test 3-attempt lockout
    - _Requirements: 9.2, 9.7, 9.9_

- [x] 19. Implement SessionManagement component for user app
  - [x] 19.1 Create split-apps/user-app/components/SessionManagement.tsx
    - Display "Sign out of all devices" button
    - Show confirmation dialog: "Are you sure? You will need to login again on all devices."
    - Call supabase.auth.signOut({ scope: 'global' })
    - Clear local authentication state using AsyncStorage.clear()
    - Log event to admin_audit_log
    - Provide haptic feedback on action
    - Navigate to login screen after sign out
    - Handle errors: sign out failed
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ]* 19.2 Write integration tests for SessionManagement
    - Test confirmation dialog display
    - Test global sign out API call
    - Test local state clearing
    - Test navigation to login screen
    - Test error handling
    - _Requirements: 10.6, 10.9_

- [x] 20. Implement SecurityScreen component for user app
  - [x] 20.1 Create or update split-apps/user-app/app/(tabs)/profile/security.tsx
    - Fetch security profile from user_profiles table (biometric_enabled, pin_hash, password_changed_at, 2fa_enabled)
    - Display sections: Password Management, Biometric Authentication, PIN Lock, Session Management, Two-Factor Authentication
    - Integrate PasswordChangeModal component
    - Integrate BiometricToggle component
    - Integrate PINLockModal component
    - Integrate SessionManagement component
    - Display "Two-Factor Authentication" row with "Coming Soon" badge and modal
    - Style 2FA row differently (muted color) to indicate unavailable
    - _Requirements: 7.1, 8.1, 9.1, 10.1, 11.1, 11.2, 11.5, 11.6_

  - [ ]* 20.2 Write integration tests for SecurityScreen
    - Test all sections render correctly
    - Test navigation to password change modal
    - Test biometric toggle interaction
    - Test PIN lock modal interaction
    - Test session management button interaction
    - Test 2FA "Coming Soon" modal
    - _Requirements: 11.1, 11.2_

- [x] 21. Implement app launch security guard
  - [x] 21.1 Update split-apps/user-app/app/_layout.tsx with security check
    - Fetch security profile (biometric_enabled, pin_hash)
    - If biometric_enabled, require biometric authentication before showing content
    - If pin_hash exists, require PIN entry before showing content
    - Implement 3-attempt limit with fallback to password
    - Store failed attempt count in secure storage
    - Reset count on successful authentication
    - _Requirements: 8.6, 8.9, 9.6, 9.7, 9.8_

  - [ ]* 21.2 Write integration tests for app launch security guard
    - Test biometric prompt on launch when enabled
    - Test PIN prompt on launch when set
    - Test 3-attempt lockout
    - Test fallback to password after lockout
    - _Requirements: 8.9, 9.8_

- [x] 22. Checkpoint - Verify security features work end-to-end
  - Test password change flow
  - Test biometric authentication enable/disable
  - Test PIN lock creation and verification
  - Test session management and global sign out
  - Test app launch security guard
  - Ensure all tests pass, ask the user if questions arise

- [x] 23. Implement content visibility filtering for user app
  - [x] 23.1 Update BTS posts fetch logic in split-apps/user-app
    - Replace direct table query with get_visible_content_for_user RPC call
    - Pass content_type='bts'
    - Display returned content
    - _Requirements: 4.3, 13.3, 13.4_

  - [x] 23.2 Update announcements fetch logic in split-apps/user-app
    - Replace direct table query with get_visible_content_for_user RPC call
    - Pass content_type='announcements'
    - Display returned content
    - _Requirements: 4.4, 13.3, 13.4_

- [x] 24. Implement content visibility controls for admin app
  - [x] 24.1 Update BTS post creation form in split-apps/admin-app
    - Add visibility selector with options: 'global', 'assigned_only', 'private'
    - Set default to 'assigned_only'
    - Save visibility value to bts_posts.visibility column
    - _Requirements: 13.6, 13.7_

  - [x] 24.2 Update announcement creation form in split-apps/admin-app
    - Add visibility selector with options: 'global', 'assigned_only', 'private'
    - Set default to 'assigned_only'
    - Save visibility value to announcements.visibility column
    - _Requirements: 13.6, 13.8_

  - [x] 24.3 Update admin content lists to display visibility indicators
    - Add badge or icon showing which content is globally visible
    - Display visibility status on BTS posts list
    - Display visibility status on announcements list
    - _Requirements: 13.9_

- [x] 25. Implement analytics tracking for unassigned users
  - [x] 25.1 Add analytics event tracking to RoadblockScreen
    - Call log_unassigned_user_event RPC with event_type='landed' on screen mount
    - Track viewed_bts events when user taps BTS preview card
    - Track viewed_announcement events when user taps announcement preview card
    - _Requirements: 14.1, 14.3, 14.4_

  - [x] 25.2 Add analytics event tracking to CodeEntryModal
    - Call log_unassigned_user_event RPC with event_type='code_entered' on submission
    - Track success/failure outcome in metadata
    - _Requirements: 14.2, 14.10_

  - [x] 25.3 Update assignment functions to track time_to_assignment
    - Ensure close_unassigned_session_on_assignment calculates time_to_assignment_seconds
    - Verify assigned_via is logged correctly (code_entry, qr_scan, invite_link, admin_invite)
    - _Requirements: 14.5, 14.9_

- [ ] 26. Implement super admin analytics dashboard views (optional)
  - [ ] 26.1 Create analytics queries for unassigned user metrics
    - Query total unassigned users
    - Query average time_to_assignment
    - Query conversion rate per photographer
    - Query top viewed content
    - Query assignment source distribution
    - Query failed attempt counts
    - _Requirements: 14.7, 14.8, 14.9, 14.10_

  - [x] 26.2 Update super-admin-dashboard to display unassigned user metrics
    - Add dashboard cards showing key metrics
    - Display charts for time_to_assignment trends
    - Display content performance (views vs assignments)
    - _Requirements: 14.8_

- [ ] 27. Implement error handling and edge cases
  - [x] 27.1 Add error handling for network failures
    - Handle database connection failures during assignment with retry logic
    - Display error "Connection lost. Please check your internet and try again."
    - Allow retry without requiring code re-entry
    - _Requirements: 16.1, 16.7_

  - [ ] 27.2 Add handling for orphaned client records
    - Handle case where user account deleted but client record exists
    - Gracefully handle NULL user_id in clients table
    - _Requirements: 16.2, 16.6_

  - [ ] 27.3 Add handling for suspended photographer accounts
    - Notify assigned clients when photographer suspended
    - Restrict access to photographer-specific content
    - _Requirements: 16.3_

  - [ ] 27.4 Add fallback for biometric/PIN failures
    - Auto-fallback to password authentication if biometric hardware unavailable
    - Auto-fallback to password authentication if PIN verification crashes
    - Log errors for debugging
    - _Requirements: 16.8, 16.9, 16.10_

- [ ] 28. Add performance optimizations
  - [ ] 28.1 Verify and add database indexes for performance
    - Verify idx_clients_user_id exists for assignment check
    - Verify idx_clients_mobile exists for auto-assignment
    - Verify idx_user_profiles_photographer_code exists for code validation
    - Verify idx_bts_visibility and idx_announcements_visibility exist
    - _Requirements: 20.2, 20.3, 20.9_

  - [ ] 28.2 Implement caching for assignment status
    - Cache assignment status in app memory for session duration
    - Only refresh on explicit user action or real-time event
    - _Requirements: 20.4_

  - [ ] 28.3 Implement caching for security settings
    - Cache biometric_enabled and pin_hash in secure storage
    - Refresh only on setting change
    - _Requirements: 20.7_

  - [ ] 28.4 Optimize content filter queries
    - Use EXISTS clause for assigned_only visibility checks
    - Avoid N+1 queries by joining necessary tables
    - _Requirements: 20.5, 20.6_

- [ ] 29. Final integration testing and validation
  - [ ]* 29.1 Run end-to-end tests for assignment flows
    - Test complete unassigned user journey (roadblock → code entry → assignment → full access)
    - Test admin client creation and auto-assignment
    - Test QR code scanning flow
    - Test invite link flow
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ]* 29.2 Run end-to-end tests for security features
    - Test password change flow
    - Test biometric authentication setup and app launch
    - Test PIN lock setup and app launch
    - Test global sign out
    - _Requirements: 7.1, 8.1, 9.1, 10.1_

  - [ ]* 29.3 Run performance tests
    - Verify assignment check completes in under 100ms for 99% of requests
    - Test with large datasets (1000+ clients)
    - _Requirements: 20.1_

- [x] 30. Final checkpoint - Complete feature validation
  - Verify all migrations applied successfully
  - Verify all components integrated correctly
  - Test complete user flows end-to-end
  - Review analytics data collection
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Unit tests and integration tests validate specific components and edge cases
- Database migrations should be tested in a staging environment before production
- Security features should undergo penetration testing before production release
- Analytics tracking enables product team to measure feature effectiveness
- The implementation plan supports parallel development of frontend and backend components

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2", "3.3", "4.1", "4.2", "6.1", "6.2", "6.3"] },
    { "id": 2, "tasks": ["2.4", "3.4", "7.1", "7.2"] },
    { "id": 3, "tasks": ["8.1", "8.2", "9.1", "9.2", "10.1", "10.2", "13.1", "13.2", "14.1", "14.2"] },
    { "id": 4, "tasks": ["11.1", "11.2", "15.1", "16.1", "16.2", "17.1", "17.2", "18.1", "18.2", "19.1", "19.2"] },
    { "id": 5, "tasks": ["20.1", "20.2", "21.1", "21.2"] },
    { "id": 6, "tasks": ["23.1", "23.2", "24.1", "24.2", "24.3"] },
    { "id": 7, "tasks": ["25.1", "25.2", "25.3", "26.1", "26.2"] },
    { "id": 8, "tasks": ["27.1", "27.2", "27.3", "27.4", "28.1", "28.2", "28.3", "28.4"] },
    { "id": 9, "tasks": ["29.1", "29.2", "29.3"] }
  ]
}
```
