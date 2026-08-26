# Requirements Document

## Introduction

This document defines the requirements for implementing unassigned user access, photographer-client assignment flow, and complete backend integration for security features in the photography platform. The system currently has partial client assignment infrastructure but lacks a complete unassigned user experience and has non-functional security UI elements that need full backend integration.

## Glossary

- **Unassigned_User**: A user who has logged into the client app but is not yet associated with any photographer/admin
- **Assigned_User**: A user who has been linked to a specific photographer/admin through a photographer code or invite
- **Photographer_Code**: A unique 8-character alphanumeric code assigned to each photographer for client assignment
- **Client_Assignment_System**: The backend system that manages the relationship between clients and photographers
- **Roadblock_Screen**: A UI screen that blocks unassigned users from accessing certain features while allowing limited global content access
- **Global_Content**: BTS posts and announcements that are publicly visible to all users regardless of assignment status
- **Security_Module**: The user profile security settings including biometric authentication, PIN lock, password management, and session control
- **Payment_Status_Enum**: Database enumeration for payment.status with values: 'pending', 'success', 'failed', 'cancelled'
- **Gallery_Payment_Status**: Database field for galleries.payment_status with values: 'pending', 'paid', 'refunded'
- **Admin_Subscriptions_Table**: Database table tracking photographer subscription payments and billing history
- **Revenue_Pipeline_View**: Database view aggregating revenue metrics from subscription and commission data
- **Biometric_Auth**: Device-level authentication using Face ID or fingerprint
- **PIN_Lock**: Custom 6-digit PIN for app access
- **Session_Management**: System for tracking and controlling user login sessions across devices
- **Two_Factor_Authentication**: Additional security layer using SMS or authenticator app codes

## Requirements

### Requirement 1: Unassigned User Discovery and Limited Access

**User Story:** As an unassigned user, I want to browse global photographer content so that I can discover photographers and decide to book.

#### Acceptance Criteria

1. WHEN an unassigned user opens the app, THE Client_App SHALL display a Roadblock_Screen with limited access message
2. WHILE the user is unassigned, THE Client_App SHALL allow viewing of Global_Content (BTS posts and announcements)
3. THE Client_App SHALL display all active BTS posts marked as globally visible (visibility='global' OR admin_id IS NULL)
4. THE Client_App SHALL display all active announcements marked as globally visible (visibility='global' OR admin_id IS NULL)
5. WHILE the user is unassigned, THE Client_App SHALL hide private galleries, packages, and photographer-specific features
6. WHEN an unassigned user attempts to access restricted features, THE Client_App SHALL display a prompt to enter a photographer code
7. THE Roadblock_Screen SHALL include a prominent "Enter Photographer Code" button
8. THE Roadblock_Screen SHALL display messaging: "Connect with your photographer to unlock your personalized gallery and packages"

### Requirement 2: Photographer Code Assignment Flow

**User Story:** As an unassigned user, I want to enter my photographer's code so that I can access my personalized content.

#### Acceptance Criteria

1. WHEN a user enters a photographer code, THE Client_Assignment_System SHALL validate the code against user_profiles.photographer_code
2. IF the photographer code is invalid, THEN THE Client_App SHALL display error "Invalid photographer code. Please check with your photographer."
3. WHEN a valid photographer code is entered, THE Client_Assignment_System SHALL create a record in the clients table linking user_id to owner_admin_id
4. WHEN a client assignment is created, THE Client_Assignment_System SHALL log the assignment in client_assignment_log with assigned_via='code_entry'
5. THE Client_Assignment_System SHALL support assignment via QR code scan with assigned_via='qr_scan'
6. THE Client_Assignment_System SHALL support assignment via invite link with assigned_via='invite_link'
7. WHEN assignment succeeds, THE Client_App SHALL refresh and display the success message: "Connected to [Photographer Name]! You can now access your galleries and packages."
8. WHEN assignment succeeds, THE Client_App SHALL navigate the user to the home screen with full access
9. THE Assignment_System SHALL prevent duplicate assignments (one client can only be assigned to one photographer at a time)
10. IF a user is already assigned, WHEN they try to enter a different code, THEN THE Client_App SHALL display error "You are already assigned to [Current Photographer]. Contact support to change photographers."

### Requirement 3: Admin Client Creation and Auto-Assignment

**User Story:** As an admin, I want to create a client record with their mobile number so that the client becomes automatically assigned to me.

#### Acceptance Criteria

1. WHEN an admin creates a client record with a mobile number, THE Admin_App SHALL insert the record into the clients table with owner_admin_id set to the admin's ID
2. THE Admin_App SHALL store the client's mobile_number in the clients table for future login matching
3. WHEN a user logs in with a mobile number that matches an existing client record, THE Client_Assignment_System SHALL automatically assign them to the owning admin
4. THE Client_Assignment_System SHALL log auto-assignments with assigned_via='admin_invite'
5. WHEN a client is created by admin, THE Notification_System SHALL send an SMS to the client's mobile with: "You've been added by [Photographer Name]. Download the app and login with this number to access your photos."
6. THE Client_Creation_Form SHALL include fields: name, mobile_number, email (optional), notes (optional)
7. THE Admin_App SHALL validate mobile numbers using E.164 format
8. IF a mobile number already exists in the clients table, THEN THE Admin_App SHALL display error "A client with this mobile number already exists"

### Requirement 4: Post-Assignment User Experience

**User Story:** As an assigned user, I want to access my photographer's complete content so that I can view galleries, packages, and private content.

#### Acceptance Criteria

1. WHEN a user is assigned, THE Client_App SHALL display all galleries where client_id matches the user's client record OR gallery is in unlocked_galleries for the user
2. WHEN a user is assigned, THE Client_App SHALL display all packages created by the assigned photographer
3. WHEN a user is assigned, THE Client_App SHALL display BTS posts where (admin_id = assigned_photographer_id OR visibility='global')
4. WHEN a user is assigned, THE Client_App SHALL display announcements where (admin_id = assigned_photographer_id OR visibility='global')
5. THE Client_App SHALL display the photographer's profile information in the app settings
6. THE Client_App SHALL enable direct messaging with the assigned photographer
7. WHEN a user is assigned, THE Client_App SHALL enable the booking flow for the photographer's packages
8. THE Home_Screen SHALL display "Your Photographer: [Name]" prominently after assignment

### Requirement 5: Database Migration Fixes - Payment Status Enum

**User Story:** As a system administrator, I need the photo_auto_unlock migration to execute successfully so that payment processing works correctly.

#### Acceptance Criteria

1. THE Migration_20260602000004 SHALL use only valid Payment_Status_Enum values in trigger conditions
2. THE Migration_20260602000004 SHALL change trigger condition from `NEW.status = 'refunded'` to `NEW.status = 'cancelled'`
3. THE Migration_20260602000004 SHALL add 'refunded' to the Payment_Status_Enum: ('pending', 'success', 'failed', 'cancelled', 'refunded')
4. THE Gallery_Payment_Status CHECK constraint SHALL maintain values: ('pending', 'paid', 'refunded')
5. THE Migration SHALL document that galleries.payment_status='refunded' maps to payments.status='cancelled' OR payments.status='refunded'
6. WHEN a payment status changes to 'refunded' OR 'cancelled', THE Lock_Gallery_On_Refund function SHALL lock the gallery photos
7. THE Trigger_Payment_Refund SHALL activate on BOTH status='refunded' AND status='cancelled'

### Requirement 6: Database Migration Fixes - Revenue Pipeline View

**User Story:** As a super admin, I need the revenue pipeline view to execute correctly so that I can view platform revenue metrics.

#### Acceptance Criteria

1. THE Migration_20260602000002 SHALL remove payment_method from the revenue_pipeline VIEW definition
2. THE Admin_Subscriptions_Table SHALL include a payment_method column with type TEXT
3. THE Migration SHALL add payment_method column to admin_subscriptions if it does not exist
4. THE Revenue_Pipeline_View SHALL select payment_method from admin_subscriptions table
5. THE Revenue_Pipeline_View SHALL group by (month, payment_method) correctly
6. IF payment_method does not exist on admin_subscriptions, THEN THE Migration SHALL add it with ALTER TABLE admin_subscriptions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'mpesa'
7. THE Revenue_Pipeline_View SHALL only include subscriptions where status='success'

### Requirement 7: Security Screen - Password Management Backend Integration

**User Story:** As a user, I want to change my password securely so that I can maintain account security.

#### Acceptance Criteria

1. WHEN a user enters their current password, THE Security_Module SHALL verify it using supabase.auth.signInWithPassword
2. IF the current password is incorrect, THEN THE Security_Module SHALL display error "Your current password is incorrect"
3. WHEN a user enters a new password, THE Security_Module SHALL validate minimum length of 8 characters
4. WHEN a user enters a new password, THE Security_Module SHALL validate presence of at least one uppercase letter
5. WHEN a user enters a new password, THE Security_Module SHALL validate presence of at least one number
6. IF new password validation fails, THEN THE Security_Module SHALL display specific validation error message
7. WHEN password validations pass, THE Security_Module SHALL call supabase.auth.updateUser({ password: newPassword })
8. WHEN password update succeeds, THE Security_Module SHALL display success message "Password updated successfully"
9. THE Security_Module SHALL log password change events in the admin_audit_log table
10. WHEN password update fails, THE Security_Module SHALL display error with failure reason

### Requirement 8: Security Screen - Biometric Authentication Backend Integration

**User Story:** As a user, I want to enable biometric authentication so that I can quickly and securely access the app.

#### Acceptance Criteria

1. WHEN biometric toggle is enabled, THE Security_Module SHALL verify device biometric hardware using LocalAuthentication.hasHardwareAsync()
2. IF biometric hardware is not available, THEN THE Security_Module SHALL display error "Biometrics not supported on this device"
3. WHEN biometric is enabled, THE Security_Module SHALL prompt for biometric authentication
4. WHEN biometric authentication succeeds, THE Security_Module SHALL update user_profiles.biometric_enabled = true
5. WHEN biometric is disabled, THE Security_Module SHALL update user_profiles.biometric_enabled = false
6. WHEN the app starts, IF biometric_enabled = true, THEN THE Client_App SHALL require biometric authentication before showing content
7. THE Security_Module SHALL store the biometric_enabled preference in user_profiles table
8. THE Biometric_Auth SHALL support both Face ID and fingerprint scanners
9. IF biometric authentication fails 3 times, THEN THE Security_Module SHALL fall back to password login
10. WHEN biometric setting changes, THE Security_Module SHALL sync the change to the database immediately

### Requirement 9: Security Screen - PIN Lock Backend Integration

**User Story:** As a user, I want to set up a PIN lock so that I can protect my gallery with a custom code.

#### Acceptance Criteria

1. WHEN a user creates a PIN, THE Security_Module SHALL validate the PIN is exactly 6 digits
2. WHEN a user creates a PIN, THE Security_Module SHALL hash the PIN using SHA-256 before storage
3. WHEN PIN creation succeeds, THE Security_Module SHALL store the hash in user_profiles.pin_hash
4. WHEN a user disables PIN lock, THE Security_Module SHALL set user_profiles.pin_hash = NULL
5. WHEN a user changes their PIN, THE Security_Module SHALL verify the old PIN hash before allowing change
6. WHEN the app starts, IF pin_hash IS NOT NULL, THEN THE Client_App SHALL require PIN entry before showing content
7. THE Security_Module SHALL allow 3 PIN attempts before requiring password authentication
8. WHEN PIN verification fails 3 times, THE Security_Module SHALL lock the app and require biometric or password
9. THE Security_Module SHALL hash entered PINs using the same SHA-256 algorithm for comparison
10. THE PIN_Entry_Screen SHALL display large numeric keypad with masked input (••••••)

### Requirement 10: Security Screen - Session Management Backend Integration

**User Story:** As a user, I want to manage my active sessions so that I can control which devices have access to my account.

#### Acceptance Criteria

1. THE Security_Module SHALL display a "Sign out of all devices" button in the sessions section
2. WHEN a user triggers sign out all devices, THE Security_Module SHALL call supabase.auth.signOut({ scope: 'global' })
3. WHEN global sign out succeeds, THE Client_App SHALL clear all local authentication state
4. WHEN global sign out succeeds, THE Client_App SHALL navigate to the login screen
5. THE Security_Module SHALL invalidate all refresh tokens across all devices
6. THE Security_Module SHALL display confirmation dialog before executing global sign out: "Are you sure? You will need to login again on all devices."
7. WHEN a user confirms sign out all devices, THE Security_Module SHALL provide haptic feedback
8. THE Security_Module SHALL log session termination events in admin_audit_log
9. IF global sign out fails, THEN THE Security_Module SHALL display error "Failed to sign out. Please try again."
10. THE Session_Management SHALL prevent sign out if no active session exists

### Requirement 11: Security Screen - Two Factor Authentication Preparation

**User Story:** As a user, I want to prepare for two-factor authentication so that I can add an extra layer of security in the future.

#### Acceptance Criteria

1. THE Security_Module SHALL display a "Two-Factor Authentication" row in the app security section
2. WHEN a user taps the 2FA row, THE Security_Module SHALL display modal "2FA Coming Soon - Two-factor authentication via SMS or authenticator app is coming in the next update."
3. THE User_Profiles_Table SHALL include a 2fa_enabled BOOLEAN column DEFAULT false
4. THE User_Profiles_Table SHALL include a 2fa_secret TEXT column for storing TOTP secrets
5. THE Security_Module SHALL display "Coming Soon" badge on the 2FA row
6. THE Security_Module SHALL style the 2FA row differently from active features (muted color)
7. THE User_Profiles_Table SHALL include a 2fa_backup_codes TEXT[] column for storing backup codes
8. THE Security_Module SHALL track 2FA feature interest in platform analytics
9. WHEN 2FA is implemented, THE Migration SHALL activate the 2FA UI by removing "Coming Soon" state
10. THE Security_Module SHALL not allow any 2FA configuration until the feature is fully implemented

### Requirement 12: Security Screen - Database Schema Updates

**User Story:** As a developer, I need the user_profiles table to support security features so that the backend can persist security settings.

#### Acceptance Criteria

1. THE User_Profiles_Table SHALL include column biometric_enabled BOOLEAN DEFAULT false
2. THE User_Profiles_Table SHALL include column pin_hash TEXT DEFAULT NULL
3. THE User_Profiles_Table SHALL include column password_changed_at TIMESTAMPTZ DEFAULT NOW()
4. THE User_Profiles_Table SHALL include column 2fa_enabled BOOLEAN DEFAULT false
5. THE User_Profiles_Table SHALL include column 2fa_secret TEXT DEFAULT NULL
6. THE User_Profiles_Table SHALL include column 2fa_backup_codes TEXT[] DEFAULT NULL
7. THE User_Profiles_Table SHALL include column last_password_change_reminder TIMESTAMPTZ DEFAULT NULL
8. THE User_Profiles_Table SHALL update password_changed_at automatically when auth.users password changes
9. THE Security_Module SHALL create a trigger on auth.users to sync password_changed_at
10. THE Security_Module SHALL create RLS policies allowing users to update only their own security settings

### Requirement 13: Content Visibility Rules for Unassigned Users

**User Story:** As a photographer, I want to control whether my content is visible to unassigned users so that I can choose to participate in global discovery.

#### Acceptance Criteria

1. THE BTS_Posts_Table SHALL include column visibility TEXT CHECK (visibility IN ('global', 'assigned_only', 'private'))
2. THE Announcements_Table SHALL include column visibility TEXT CHECK (visibility IN ('global', 'assigned_only', 'private'))
3. WHEN visibility='global', THE Content_Filter SHALL show the content to all users including unassigned
4. WHEN visibility='assigned_only', THE Content_Filter SHALL show the content only to clients assigned to the photographer
5. WHEN visibility='private', THE Content_Filter SHALL show the content only to the photographer
6. THE Admin_App SHALL provide a visibility selector when creating BTS posts and announcements
7. THE Default visibility for new BTS posts SHALL be 'assigned_only'
8. THE Default visibility for new announcements SHALL be 'assigned_only'
9. THE Admin_App SHALL display an indicator showing which content is globally visible
10. THE Content_Filter SHALL use SQL query: WHERE (visibility='global' OR (visibility='assigned_only' AND admin_id = user_photographer_id))

### Requirement 14: Unassigned User Analytics and Tracking

**User Story:** As a super admin, I want to track unassigned user behavior so that I can improve the assignment flow.

#### Acceptance Criteria

1. THE Analytics_System SHALL track event "unassigned_user_landed" when an unassigned user opens the app
2. THE Analytics_System SHALL track event "photographer_code_entered" with success/failure outcome
3. THE Analytics_System SHALL track event "unassigned_user_viewed_bts" with post_id
4. THE Analytics_System SHALL track event "unassigned_user_viewed_announcement" with announcement_id
5. THE Analytics_System SHALL track time_to_assignment (duration between first app open and successful assignment)
6. THE Analytics_System SHALL create a table unassigned_user_sessions to track session duration and content views
7. THE Analytics_System SHALL calculate conversion_rate (assigned / total_users) for each photographer
8. THE Super_Admin_Dashboard SHALL display unassigned user metrics: total unassigned, average time to assignment, top viewed content
9. THE Analytics_System SHALL track assignment_source (code_entry, qr_scan, invite_link, admin_invite) distribution
10. THE Analytics_System SHALL track failed assignment attempts with invalid_code_attempts counter

### Requirement 15: Photographer Code Management

**User Story:** As an admin, I want to view and share my photographer code so that clients can easily find and connect with me.

#### Acceptance Criteria

1. THE Admin_App SHALL display the photographer code prominently in the settings screen
2. THE Admin_App SHALL provide a "Copy Code" button to copy the photographer code to clipboard
3. WHEN the copy button is pressed, THE Admin_App SHALL provide haptic feedback and show toast "Code copied!"
4. THE Admin_App SHALL provide a "Share Code" button to open native share sheet
5. THE Share_Sheet SHALL pre-fill message: "Use code [PHOTOGRAPHER_CODE] to access your photos in the [App Name] app. Download: [App Store Link]"
6. THE Admin_App SHALL display a QR code containing the photographer code
7. WHEN a user scans the QR code, THE Client_App SHALL auto-fill the photographer code input
8. THE Admin_App SHALL allow regenerating the photographer code with confirmation dialog: "Warning: Your old code will stop working. All future clients must use the new code."
9. WHEN a code is regenerated, THE User_Profiles_Table SHALL update photographer_code to a new unique 8-character value
10. THE Admin_App SHALL track code regeneration events in admin_audit_log

### Requirement 16: Error Handling and Edge Cases

**User Story:** As a developer, I need robust error handling for assignment flows so that users have a smooth experience even when issues occur.

#### Acceptance Criteria

1. IF database connection fails during assignment, THEN THE Client_App SHALL display error "Connection lost. Please check your internet and try again."
2. IF a user's account is deleted while they are assigned, THEN THE Client_Assignment_System SHALL handle orphaned client records gracefully
3. IF a photographer's account is suspended, THEN THE Client_App SHALL notify assigned clients and restrict access to photographer-specific content
4. WHEN a photographer code has been used by 1000+ clients, THE Admin_App SHALL suggest generating a new code for security
5. IF two clients log in with the same mobile number, THE Client_Assignment_System SHALL assign both to the same photographer
6. IF a client record exists but the user_id is NULL, THEN THE Client_Assignment_System SHALL update user_id when the user logs in
7. WHEN network fails during photographer code entry, THE Client_App SHALL allow retry without requiring re-entry of the code
8. IF biometric authentication hardware becomes unavailable, THEN THE Security_Module SHALL automatically fall back to password authentication
9. IF PIN hash verification crashes, THEN THE Security_Module SHALL fall back to password authentication and log the error
10. WHEN global sign out fails due to network issues, THE Client_App SHALL still clear local session and navigate to login

### Requirement 17: Migration Rollback and Safety

**User Story:** As a database administrator, I need safe migration rollback procedures so that I can recover from failed migrations.

#### Acceptance Criteria

1. THE Migration_20260602000004 SHALL provide a rollback script to revert payment status changes
2. THE Migration_20260602000002 SHALL provide a rollback script to drop the revenue_pipeline view
3. THE Rollback_Script SHALL restore the original payment_status enum without 'refunded'
4. THE Rollback_Script SHALL restore the original revenue_pipeline view query
5. THE Migration SHALL wrap all DDL statements in a transaction where possible
6. THE Migration SHALL use IF EXISTS and IF NOT EXISTS clauses to prevent duplicate object creation
7. THE Migration SHALL log all changes to a migration_log table with timestamp and user
8. IF a migration fails, THEN THE Migration_System SHALL halt and provide detailed error message with line number
9. THE Migration SHALL test all created functions immediately after creation
10. THE Migration SHALL validate that all referenced columns exist before creating views or triggers

### Requirement 18: Security Testing and Validation

**User Story:** As a security engineer, I need comprehensive testing for security features so that I can ensure they work correctly.

#### Acceptance Criteria

1. THE Security_Module SHALL include unit tests for password validation rules
2. THE Security_Module SHALL include integration tests for biometric authentication flow
3. THE Security_Module SHALL include integration tests for PIN creation and verification
4. THE Security_Module SHALL include tests for session management and global sign out
5. THE Test_Suite SHALL verify that biometric_enabled syncs correctly to the database
6. THE Test_Suite SHALL verify that pin_hash is never returned in API responses
7. THE Test_Suite SHALL verify that password changes are logged in audit trail
8. THE Test_Suite SHALL verify that failed authentication attempts are rate-limited
9. THE Test_Suite SHALL verify that global sign out invalidates all tokens
10. THE Test_Suite SHALL include penetration testing for PIN brute force attacks

### Requirement 19: UI/UX for Unassigned User Roadblock

**User Story:** As a product designer, I need a well-designed roadblock screen so that unassigned users understand their next steps.

#### Acceptance Criteria

1. THE Roadblock_Screen SHALL display a large hero image or illustration showing photographer-client connection
2. THE Roadblock_Screen SHALL display primary heading "Connect with Your Photographer"
3. THE Roadblock_Screen SHALL display secondary text "Browse available content below, or enter your photographer's code to unlock your personal gallery"
4. THE Roadblock_Screen SHALL display a prominent gold button "Enter Photographer Code"
5. THE Roadblock_Screen SHALL display a scrollable section showing preview of Global_Content (BTS and announcements)
6. THE Roadblock_Screen SHALL use card-based layout for content previews
7. WHEN a user taps a content preview, THE Client_App SHALL open the full content view
8. THE Roadblock_Screen SHALL display a footer message "Don't have a code? Your photographer will provide one."
9. THE Roadblock_Screen SHALL use smooth animations when transitioning to assignment flow
10. THE Roadblock_Screen SHALL include a "Skip" button that allows browsing global content without entering code

### Requirement 20: Performance and Optimization

**User Story:** As a system architect, I need optimized queries for assignment checks so that the app remains responsive.

#### Acceptance Criteria

1. THE Client_Assignment_Check SHALL complete in under 100ms for 99% of requests
2. THE Client_Assignment_System SHALL use database index on clients.user_id for fast lookup
3. THE Client_Assignment_System SHALL use database index on clients.mobile_number for auto-assignment
4. THE Client_Assignment_System SHALL cache assignment status in app memory for session duration
5. THE Content_Filter_Query SHALL use EXISTS clause for assigned_only visibility checks
6. THE Content_Filter_Query SHALL avoid N+1 queries by joining necessary tables
7. THE Security_Module SHALL cache biometric_enabled and pin_hash in secure storage
8. THE Security_Module SHALL use batch updates when multiple security settings change
9. THE Photographer_Code_Validation SHALL use index on user_profiles.photographer_code
10. THE Client_App SHALL preload assignment status immediately after authentication
