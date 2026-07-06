import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse callback URL params
    const url = new URL(req.url);
    const receiptId = url.searchParams.get("receipt_id");
    const galleryId = url.searchParams.get("gallery_id");

    const callbackData = await req.json();
    const stkCallback = callbackData.Body?.stkCallback;

    if (!stkCallback) {
      console.error("Invalid callback data:", callbackData);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "OK" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;

    // Extract metadata
    const metadata = stkCallback.CallbackMetadata?.Item || [];
    const amount = metadata.find((i: any) => i.Name === "Amount")?.Value;
    const mpesaReceiptNumber = metadata.find(
      (i: any) => i.Name === "MpesaReceiptNumber"
    )?.Value;
    const phoneNumber = metadata.find(
      (i: any) => i.Name === "PhoneNumber"
    )?.Value;
    const transactionDate = metadata.find(
      (i: any) => i.Name === "TransactionDate"
    )?.Value;

    const isSuccess = resultCode === 0;

    // Update M-Pesa transaction
    const { error: updateError } = await supabase
      .from("mpesa_transactions")
      .update({
        status: isSuccess ? "completed" : "failed",
        result_code: resultCode,
        result_description: resultDesc,
        callback_received: true,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", checkoutRequestId);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
    }

    // Update payment receipt if provided
    if (receiptId) {
      const { error: receiptError } = await supabase
        .from("payment_receipts")
        .update({
          status: isSuccess ? "completed" : "failed",
          transaction_id: mpesaReceiptNumber || checkoutRequestId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receiptId);

      if (receiptError) {
        console.error("Failed to update receipt:", receiptError);
      }

      // If successful and gallery_id provided, unlock gallery
      if (isSuccess && galleryId) {
        const { error: galleryError } = await supabase
          .from("galleries")
          .update({ is_paid: true, is_locked: false })
          .eq("id", galleryId);

        if (galleryError) {
          console.error("Failed to unlock gallery:", galleryError);
        }
      }
    }

    // If successful, also update any installment payments
    if (isSuccess && mpesaReceiptNumber) {
      const { data: existingTransaction } = await supabase
        .from("mpesa_transactions")
        .select("id")
        .eq("checkout_request_id", checkoutRequestId)
        .single();

      if (existingTransaction) {
        // Check if this payment is linked to an installment plan
        const { data: receipt } = await supabase
          .from("payment_receipts")
          .select("gallery_id")
          .eq("id", receiptId)
          .single();

        if (receipt?.gallery_id) {
          // Update any pending installment for this gallery
          await supabase
            .from("installment_payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              transaction_id: mpesaReceiptNumber,
            })
            .eq("plan_id", receipt.gallery_id)
            .eq("status", "pending")
            .limit(1);
        }
      }
    }

    // M-Pesa expects this response
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Success",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Success",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
