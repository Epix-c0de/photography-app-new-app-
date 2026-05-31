/**
 * web_login_request — Step 1 of the secure web login flow
 *
 * Flow:
 * 1. Web dashboard calls this with { email }
 * 2. We send an OTP to the email via Supabase Auth
 * 3. We create a web_login_requests record with status='pending'
 * 4. We return the request token to the web client
 * 5. The admin's mobile app shows a notification to approve/reject
 * 6. Web client polls /web_login_status until approved
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    token += chars[byte % chars.length];
  }
  return token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { email, device_info, ip_address } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Find the admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role, subscription_status, subscription_expires_at, is_lifetime')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      // Return generic message to prevent email enumeration
      return new Response(
        JSON.stringify({ message: 'If this email exists, an OTP has been sent.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via Supabase Auth
    await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase().trim(),
    });

    // Create web login request record
    const token = generateToken();
    await supabase.from('web_login_requests').insert({
      admin_id: profile.id,
      token,
      device_info: device_info || null,
      ip_address: ip_address || null,
      status: 'pending',
    });

    // Send push notification to admin's mobile app via notifications table
    await supabase.from('notifications').insert({
      user_id: profile.id,
      type: 'web_login_request',
      title: '🔐 Web Login Request',
      body: `Someone is trying to log in to your web dashboard${device_info ? ` from ${device_info}` : ''}. Approve or reject in the app.`,
      data: { token, action: 'web_login_approval' },
      read: false,
    });

    return new Response(
      JSON.stringify({ token, message: 'OTP sent. Check your email and approve in the mobile app.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('web_login_request error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
