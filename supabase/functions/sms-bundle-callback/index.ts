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
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const payload: MpesaCallbackBody = await req.json();
    const stkCallback = payload.Body?.stkCallback;
    if (!stkCallback) {
      return new Response("Invalid payload", { status: 400 });
    }

    const { CheckoutRequestID, ResultCode } = stkCallback;

    const { data: purchase } = await supabase
      .from("sms_bundle_purchases")
      .select("id, owner_admin_id, sms_amount")
      .eq("mpesa_checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (!purchase) {
      return new Response("Purchase not found", { status: 200 });
    }

    if (ResultCode !== 0) {
      await supabase
        .from("sms_bundle_purchases")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", purchase.id);

      return new Response("Logged failure", { status: 200 });
    }

    const items = stkCallback.CallbackMetadata?.Item ?? [];
    const receiptItem = items.find((item) => item.Name === "MpesaReceiptNumber");
    const phoneItem = items.find((item) => item.Name === "PhoneNumber");
    const receiptNumber = typeof receiptItem?.Value === "string" ? receiptItem.Value : null;
    const phoneNumber = typeof phoneItem?.Value === "number" ? String(phoneItem.Value) : typeof phoneItem?.Value === "string" ? phoneItem.Value : null;

    await supabase
      .from("sms_bundle_purchases")
      .update({
        status: "paid",
        mpesa_receipt_number: receiptNumber,
        phone_number: phoneNumber ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchase.id);

    await supabase.rpc("increment_sms_balance", {
      p_admin_id: purchase.owner_admin_id,
      p_amount: purchase.sms_amount,
    });

    return new Response("OK", { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});

