// supabase/functions/send_sms/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  try {
    const { phoneNumber, message } = await req.json()
    
    // 1. Validate inputs
    if (!phoneNumber || !message) {
      throw new Error("Missing phone or message")
    }

    // 2. Call SMS Provider (e.g., Africa's Talking, Twilio)
    // const response = await fetch('https://api.africastalking.com/version1/messaging', { ... })

    console.log(`Sending SMS to ${phoneNumber}: ${message}`)

    return new Response(
      JSON.stringify({ success: true, message: "SMS Sent" }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
})
