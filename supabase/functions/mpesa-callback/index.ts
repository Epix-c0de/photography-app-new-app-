import { createClient } from "@supabase/supabase-js";

type StkCallbackItem = {
  Name: string;
  Value?: string | number;
};

type StkCallbackPayload = {
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item?: StkCallbackItem[];
  };
};

type MpesaCallbackBody = {
  Body?: {
    stkCallback?: StkCallbackPayload;
  };
};

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: MpesaCallbackBody = await req.json();
    const stkCallback = payload.Body?.stkCallback;
    if (!stkCallback) {
      return new Response("Invalid payload", { status: 400 });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    if (ResultCode !== 0) {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("mpesa_checkout_request_id", CheckoutRequestID);

      return new Response("Logged failure", { status: 200 });
    }

    const items = stkCallback.CallbackMetadata?.Item ?? [];
    const amountItem = items.find((item) => item.Name === "Amount");
    const receiptItem = items.find((item) => item.Name === "MpesaReceiptNumber");
    const phoneItem = items.find((item) => item.Name === "PhoneNumber");

    const _amount = typeof amountItem?.Value === "number" ? amountItem.Value : null;
    const receiptNumber = typeof receiptItem?.Value === "string" ? receiptItem.Value : null;
    const phoneNumber =
      typeof phoneItem?.Value === "number" ? String(phoneItem.Value) : typeof phoneItem?.Value === "string" ? phoneItem.Value : null;

    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .update({
        status: "paid",
        mpesa_receipt_number: receiptNumber,
        phone_number: phoneNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("mpesa_checkout_request_id", CheckoutRequestID)
      .select("gallery_id, client_id")
      .single();

    if (fetchError || !payment) {
      return new Response("Payment record missing", { status: 200 });
    }

    if (payment.gallery_id) {
      await supabase
        .from("galleries")
        .update({
          is_paid: true,
          is_locked: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.gallery_id);
    }

    return new Response("Success", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
