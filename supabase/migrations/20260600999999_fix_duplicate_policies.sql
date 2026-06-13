-- ============================================
-- Pre-emptive policy cleanup to allow idempotent migration replays
-- Wrapped in DO blocks so it's safe even if tables don't exist yet.
-- ============================================

DO $$ BEGIN

  -- subscription_system (20260601000001)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_subscriptions') THEN
    DROP POLICY IF EXISTS "Admins can view own subscriptions" ON admin_subscriptions;
    DROP POLICY IF EXISTS "Service role can manage subscriptions" ON admin_subscriptions;
    DROP POLICY IF EXISTS "super_admin_read_all_subscriptions" ON admin_subscriptions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_audit_log') THEN
    DROP POLICY IF EXISTS "Admins can view own audit log" ON admin_audit_log;
    DROP POLICY IF EXISTS "Service role can manage audit log" ON admin_audit_log;
    DROP POLICY IF EXISTS "Admins can insert own audit entries" ON admin_audit_log;
  END IF;

  -- bts_visibility (20260601000002)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bts_posts') THEN
    DROP POLICY IF EXISTS "Admins can manage bts_posts" ON bts_posts;
    DROP POLICY IF EXISTS "Clients can view active bts_posts" ON bts_posts;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'announcements') THEN
    DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
    DROP POLICY IF EXISTS "Clients can view active announcements" ON announcements;
  END IF;

  -- web_login_approvals (20260601000003)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'web_login_requests') THEN
    DROP POLICY IF EXISTS "Admins can view own login requests" ON web_login_requests;
    DROP POLICY IF EXISTS "Admins can update own login requests" ON web_login_requests;
    DROP POLICY IF EXISTS "Service role manages login requests" ON web_login_requests;
    DROP POLICY IF EXISTS "Admins can manage their web login approvals" ON web_login_requests;
    DROP POLICY IF EXISTS "Service role can manage web login approvals" ON web_login_requests;
  END IF;

  -- portfolio_items (20260601000004)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'portfolio_items') THEN
    DROP POLICY IF EXISTS "admin_manage_portfolio" ON portfolio_items;
    DROP POLICY IF EXISTS "public_view_portfolio" ON portfolio_items;
    DROP POLICY IF EXISTS "Admins can manage their portfolio" ON portfolio_items;
    DROP POLICY IF EXISTS "Portfolio items are publicly viewable" ON portfolio_items;
  END IF;

  -- platform_settings (20260601000005)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'platform_settings') THEN
    DROP POLICY IF EXISTS "super_admin_manage_platform_settings" ON platform_settings;
    DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON platform_settings;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'support_messages') THEN
    DROP POLICY IF EXISTS "photographer_own_support_messages" ON support_messages;
    DROP POLICY IF EXISTS "super_admin_all_support_messages" ON support_messages;
  END IF;

  -- fix_bookings_packages (20260601000006)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'packages') THEN
    DROP POLICY IF EXISTS "Admins can manage packages" ON packages;
    DROP POLICY IF EXISTS "Clients can view active packages" ON packages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bookings') THEN
    DROP POLICY IF EXISTS "Service role can manage bookings" ON bookings;
    DROP POLICY IF EXISTS "Admins can view bookings" ON bookings;
    DROP POLICY IF EXISTS "Clients can view own bookings" ON bookings;
    DROP POLICY IF EXISTS "Clients can create bookings" ON bookings;
  END IF;

  -- client_invite_links (20260601000007)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'client_invite_links') THEN
    DROP POLICY IF EXISTS "admin_manage_invites" ON client_invite_links;
    DROP POLICY IF EXISTS "public_read_invite_token" ON client_invite_links;
  END IF;

  -- privacy_and_tagging (20260602000001)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bts_tags') THEN
    DROP POLICY IF EXISTS "Admins can manage bts tags" ON bts_tags;
    DROP POLICY IF EXISTS "Authenticated can read bts tags" ON bts_tags;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'announcement_tags') THEN
    DROP POLICY IF EXISTS "Admins can manage announcement tags" ON announcement_tags;
    DROP POLICY IF EXISTS "Authenticated can read announcement tags" ON announcement_tags;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'manual_payment_verifications') THEN
    DROP POLICY IF EXISTS "admin_manage_manual_payments" ON manual_payment_verifications;
    DROP POLICY IF EXISTS "client_view_own_payments" ON manual_payment_verifications;
    DROP POLICY IF EXISTS "client_create_payments" ON manual_payment_verifications;
  END IF;

  -- super_admin_features (20260602000002)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fraud_flags') THEN
    DROP POLICY IF EXISTS "super_admin_manage_fraud_flags" ON fraud_flags;
    DROP POLICY IF EXISTS "super_admin_manage_flags" ON fraud_flags;
    DROP POLICY IF EXISTS "admins_view_own_fraud_flags" ON fraud_flags;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'platform_payment_settings') THEN
    DROP POLICY IF EXISTS "super_admin_manage_platform_settings" ON platform_payment_settings;
    DROP POLICY IF EXISTS "super_admin_manage_payment_settings" ON platform_payment_settings;
  END IF;

  -- photographer_codes_and_assignment (20260602000003)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'client_assignment_log') THEN
    DROP POLICY IF EXISTS "admins_view_own_assignments" ON client_assignment_log;
  END IF;

  -- user_security_columns (20260602000005)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_profiles') THEN
    DROP POLICY IF EXISTS "super_admin_view_all_profiles" ON user_profiles;
    DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
    DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy cleanup warning: %', SQLERRM;
END $$;
