/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CallbackItem = {
  Name: string;
  Value?: string | number;
};

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Expect either real M-Pesa payload or a simplified success body
    // If real, parse accordingly; if simplified, read fields directly
    let _amount: number | null = null;
    let receipt: string | null = null;
    let _phone: string | null = null;
    let checkoutRequestId: string | null = null;
    let galleryId: string | null = null;
    let clientId: string | null = null;

    if (payload?.Body?.stkCallback) {
      const callbackData = payload.Body.stkCallback;
      if (callbackData.ResultCode !== 0) {
        return new Response("Payment not successful", { status: 200 });
      }
      const items = callbackData.CallbackMetadata.Item || [];
      _amount = (items.find((i: CallbackItem) => i.Name === 'Amount')?.Value as number) ?? null;
      receipt = (items.find((i: CallbackItem) => i.Name === 'MpesaReceiptNumber')?.Value as string) ?? null;
      _phone = (items.find((i: CallbackItem) => i.Name === 'PhoneNumber')?.Value as string) ?? null;
      checkoutRequestId = callbackData.CheckoutRequestID ?? null;
      galleryId = payload.galleryId ?? null;
      clientId = payload.clientId ?? null;
    } else {
      // Simplified callback shape
      _amount = payload.amount ?? null;
      receipt = payload.receipt ?? null;
      _phone = payload.phone ?? null;
      checkoutRequestId = payload.checkoutRequestId ?? null;
      galleryId = payload.galleryId ?? null;
      clientId = payload.clientId ?? null;
    }

    // Update payments table
    if (checkoutRequestId) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'paid', mpesa_receipt_number: receipt ?? null })
        .eq('mpesa_checkout_request_id', checkoutRequestId);
    }

    // Unlock gallery (paid + unlocked)
    if (galleryId) {
      await supabaseAdmin
        .from('galleries')
        .update({ is_paid: true, is_locked: false, status: 'unlocked' })
        .eq('id', galleryId);
    }

    // Notify client user
    if (clientId) {
      const { data: clientRow } = await supabaseAdmin
        .from('clients')
        .select('user_id, name')
        .eq('id', clientId)
        .single();
      if (clientRow?.user_id) {
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: clientRow.user_id,
            type: 'payment_success',
            title: 'Payment Received',
            body: 'Your gallery has been unlocked. Enjoy your HD photos!',
            data: { galleryId }
          });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
