import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log("Received callback:", JSON.stringify(body))

    let updates = [];

    // 1. Handle WhatsApp Cloud API Callback
    if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      const statuses = body.entry[0].changes[0].value.statuses;
      
      for (const status of statuses) {
        const externalId = status.id;
        const newStatus = status.status; // sent, delivered, read, failed
        
        // Map WhatsApp status to our status
        let dbStatus = 'pending';
        if (newStatus === 'sent') dbStatus = 'sent';
        if (newStatus === 'delivered') dbStatus = 'delivered';
        if (newStatus === 'read') dbStatus = 'delivered'; // Treat read as delivered
        if (newStatus === 'failed') dbStatus = 'failed';

        updates.push(
          supabaseClient
            .from('delivery_logs')
            .update({ 
              status: dbStatus,
              updated_at: new Date().toISOString(),
              // Store raw status in error_message if failed for debugging
              error_message: newStatus === 'failed' ? JSON.stringify(status.errors || 'Unknown WhatsApp Error') : null
            })
            .eq('external_id', externalId)
        );
      }
    } 
    // 2. Handle Generic HTTP Callback
    else if (body.id || body.external_id) {
      const id = body.id || body.external_id;
      const status = body.status; // sent, delivered, failed
      const error = body.error || body.error_message;

      // Check if ID is a UUID (our internal ID) or external ID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      const query = supabaseClient.from('delivery_logs').update({
        status: status,
        error_message: error,
        updated_at: new Date().toISOString()
      });

      if (isUuid) {
        updates.push(query.eq('id', id));
      } else {
        updates.push(query.eq('external_id', id));
      }
    }

    await Promise.all(updates);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error("Callback Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
