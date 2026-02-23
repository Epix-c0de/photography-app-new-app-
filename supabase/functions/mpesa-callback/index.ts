import { createClient } from "@supabase/supabase-js";

type StkCallbackItem = {
  Name: string;
  Value?: string | number;
};

type StkCallbackPayload = {
  CheckoutRequestID: string;
  MerchantRequestID?: string;
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

const parseMpesaTimestamp = (value?: string | number) => {
  if (!value) return null;
  const raw = String(value);
  if (raw.length !== 14) return null;
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hour = raw.slice(8, 10);
  const minute = raw.slice(10, 12);
  const second = raw.slice(12, 14);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
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

    const { CheckoutRequestID, ResultCode, MerchantRequestID } = stkCallback;

    const items = stkCallback.CallbackMetadata?.Item ?? [];
    const receiptItem = items.find((item) => item.Name === "MpesaReceiptNumber");
    const phoneItem = items.find((item) => item.Name === "PhoneNumber");
    const dateItem = items.find((item) => item.Name === "TransactionDate");
    const receiptNumber = typeof receiptItem?.Value === "string" ? receiptItem.Value : null;
    const phoneNumber =
      typeof phoneItem?.Value === "number" ? String(phoneItem.Value) : typeof phoneItem?.Value === "string" ? phoneItem.Value : null;
    const transactionDateIso = parseMpesaTimestamp(dateItem?.Value);

    const { data: result, error: callbackError } = await supabase.rpc("handle_mpesa_callback", {
      p_checkout_request_id: CheckoutRequestID,
      p_merchant_request_id: MerchantRequestID ?? null,
      p_result_code: ResultCode,
      p_receipt_number: receiptNumber,
      p_transaction_date: transactionDateIso,
      p_phone: phoneNumber,
      p_raw_payload: payload,
    });
    if (callbackError) {
      return new Response("Callback processing failed", { status: 200 });
    }
    const info = Array.isArray(result) ? result[0] : result;
    if (!info || !info.processed) {
      return new Response("Ignored", { status: 200 });
    }

    if (info.status === "success") {
      if (info.client_id) {
        await supabase.rpc("create_client_notification", {
          p_client_id: info.client_id,
          p_gallery_id: info.gallery_id,
          p_type: "payment_success",
          p_title: "Payment Received",
          p_message: "Your payment was successful. You can now download your photos.",
        });
      }
      await supabase.rpc("emit_event", {
        p_event_name: "PAYMENT_SUCCESS",
        p_payload: payload,
        p_gallery_id: info.gallery_id,
        p_client_id: info.client_id,
        p_admin_id: null,
      });
      await supabase.rpc("emit_event", {
        p_event_name: "GALLERY_UNLOCKED",
        p_payload: payload,
        p_gallery_id: info.gallery_id,
        p_client_id: info.client_id,
        p_admin_id: null,
      });
    } else if (info.status === "failed") {
      if (info.client_id) {
        await supabase.rpc("create_client_notification", {
          p_client_id: info.client_id,
          p_gallery_id: info.gallery_id,
          p_type: "payment_failed",
          p_title: "Payment Failed",
          p_message: "Your payment failed. Please try again.",
        });
      }
      await supabase.rpc("emit_event", {
        p_event_name: "PAYMENT_FAILED",
        p_payload: payload,
        p_gallery_id: info.gallery_id,
        p_client_id: info.client_id,
        p_admin_id: null,
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
