// supabase/functions/send_sms/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req: Request) => {
  try {
    const { phoneNumber, message, logId } = await req.json()
    
    // 1. Validate inputs
    if (!phoneNumber || !message) {
      throw new Error("Missing phone or message")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Call SMS Provider (e.g., Africa's Talking, Twilio)
    // const response = await fetch('https://api.africastalking.com/version1/messaging', { ... })
    // Simulate API call failure randomly for testing dead letter queue
    const isSimulatedFailure = Math.random() < 0.1;
    
    if (isSimulatedFailure) {
       throw new Error("SMS Provider Timeout");
    }

    console.log(`Sending SMS to ${phoneNumber}: ${message}`)

    // Update log status if we have logId
    if (logId) {
      await supabase.from('sms_logs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', logId);
    }

    return new Response(
      JSON.stringify({ success: true, message: "SMS Sent" }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`SMS Failed: ${errorMessage}`);
    
    try {
        const { logId } = await req.json().catch(() => ({}));
        if (logId) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            
            // Check retry count and update
            const { data: logEntry } = await supabase.from('sms_logs').select('retry_count').eq('id', logId).single();
            const currentRetries = logEntry?.retry_count || 0;
            
            if (currentRetries < 3) {
               // Increment retry count, mark as queued for dead-letter retry worker
               await supabase.from('sms_logs').update({ 
                   status: 'queued', 
                   retry_count: currentRetries + 1,
                   error_message: errorMessage
               }).eq('id', logId);
            } else {
               // Move to dead letter status
               await supabase.from('sms_logs').update({ 
                   status: 'failed_dlq', 
                   error_message: errorMessage
               }).eq('id', logId);
            }
        }
    } catch(e) {
        console.error("Failed to update log status", e);
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
})
