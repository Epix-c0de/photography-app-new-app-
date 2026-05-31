/**
 * web_login_verify — Step 2: verify OTP + check app approval status
 *
 * Called by the web dashboard to:
 * 1. Verify the email OTP
 * 2. Mark otp_verified=true on the request
 * 3. Return current approval status
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { token, otp, email } = await req.json();

    if (!token) return new Response(JSON.stringify({ error: 'Token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get the login request
    const { data: request } = await supabase
      .from('web_login_requests')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!request) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (request.status === 'expired' || new Date(request.expires_at) < new Date()) {
      await supabase.from('web_login_requests').update({ status: 'expired' }).eq('id', request.id);
      return new Response(JSON.stringify({ status: 'expired', error: 'Login request expired. Please start again.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.status === 'rejected') {
      return new Response(JSON.stringify({ status: 'rejected', error: 'Login was rejected from the mobile app.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If OTP provided and not yet verified, verify it
    if (otp && email && !request.otp_verified) {
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (otpError) {
        return new Response(JSON.stringify({ status: 'otp_failed', error: 'Invalid or expired OTP.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Mark OTP as verified
      await supabase.from('web_login_requests').update({ otp_verified: true }).eq('id', request.id);
    }

    // Return current status
    return new Response(
      JSON.stringify({
        status: request.status,
        otp_verified: request.otp_verified || (otp ? true : false),
        admin_id: request.admin_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('web_login_verify error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
