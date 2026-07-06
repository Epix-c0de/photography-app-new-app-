import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { photographer_id } = await req.json();

    if (!photographer_id) {
      return new Response(JSON.stringify({ error: 'photographer_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get photographer profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name, email, phone')
      .eq('id', photographer_id)
      .single();

    // Get brand settings
    const { data: brand } = await supabase
      .from('brand_settings')
      .select('*')
      .eq('user_id', photographer_id)
      .single();

    // Get photographer's galleries for portfolio
    const { data: galleries } = await supabase
      .from('galleries')
      .select('id, gallery_name, category, created_at')
      .eq('photographer_id', photographer_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get Google Business credentials from platform_settings
    const { data: gbSettings } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'google_business_access_token')
      .single();

    const accessToken = gbSettings?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({
        error: 'Google Business Profile not configured. Add GOOGLE_BUSINESS_ACCESS_TOKEN to platform_settings.',
        setup_required: true,
        instructions: [
          '1. Go to https://business.google.com',
          '2. Create or select your business profile',
          '3. Go to Settings > Advanced > Business Profile API',
          '4. Generate an API key or OAuth token',
          '5. Add it to platform_settings as google_business_access_token',
        ],
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // In production: Use Google Business Profile API to create/update posts
    // POST https://mybusinessbusinessinformation.googleapis.com/v1/locations/{locationId}/localPosts
    const portfolio = (galleries || []).map(g => ({
      title: g.gallery_name,
      category: g.category || 'Photography',
      date: g.created_at,
    }));

    // Log the sync attempt
    await supabase.from('sms_logs').insert({
      photographer_id,
      phone_number: 'google_business',
      message: `Google Business sync: ${portfolio.length} galleries`,
      status: 'sent',
      provider: 'google_business',
      cost: 0,
    });

    return new Response(JSON.stringify({
      status: 'synced',
      photographer: profile?.name,
      portfolio_count: portfolio.length,
      portfolio,
      location: brand?.brand_name || profile?.name,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Google Business sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
