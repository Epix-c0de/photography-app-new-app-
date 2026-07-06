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

    const body = await req.json();

    // WhatsApp Business API webhook verification
    if (body['hub.mode'] === 'subscribe' && body['hub.verify_token'] === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(body['hub.challenge'], { status: 200 });
    }

    // Handle incoming WhatsApp messages
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const text = message.text?.body || '';

      // Parse incoming message for access code
      const codeMatch = text.toUpperCase().match(/([A-Z0-9]{6,8})/);
      if (codeMatch) {
        const accessCode = codeMatch[1];

        // Look up gallery by access code
        const { data: gallery } = await supabase
          .from('galleries')
          .select('id, gallery_name, photographer_id')
          .eq('access_code', accessCode)
          .eq('is_active', true)
          .single();

        if (gallery) {
          // Get photographer's brand settings
          const { data: brand } = await supabase
            .from('brand_settings')
            .select('brand_name, brand_slug')
            .eq('user_id', gallery.photographer_id)
            .single();

          const slug = brand?.brand_slug || 'epix';
          
          // Fetch domain from platform_settings
          const { data: domainSetting } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'platform_domain')
            .single();
          const domain = domainSetting?.value || 'https://epixvisuals.co.ke';
          
          const galleryUrl = `${domain}/gallery/${slug}/${gallery.id}`;

          // Log the inbound message
          await supabase.from('sms_logs').insert({
            photographer_id: gallery.photographer_id,
            phone_number: from,
            message: text,
            status: 'delivered',
            provider: 'whatsapp_inbound',
            cost: 0,
          });

          // In production, send reply via WhatsApp Business API
          console.log(`WhatsApp reply: Gallery ${gallery.gallery_name} → ${galleryUrl}`);
        }
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
