import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      receipt_id, 
      photographer_id, 
      client_id, 
      gallery_id, 
      amount, 
      phone_number, 
      transaction_id,
      items // Optional: array of { description, quantity, unit_price, total }
    } = await req.json();

    if (!photographer_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing photographer_id or amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get photographer info
    const { data: photographer } = await supabase
      .from("user_profiles")
      .select("name, email, phone")
      .eq("id", photographer_id)
      .single();

    // Get receipt settings (customization)
    const { data: receiptSettings } = await supabase
      .from("receipt_settings")
      .select("*")
      .eq("photographer_id", photographer_id)
      .single();

    // Get brand settings as fallback
    const { data: brandSettings } = await supabase
      .from("brand_settings")
      .select("brand_name, brand_slug, logo_url")
      .eq("admin_id", photographer_id)
      .single();

    // Get client info
    let clientName = "Client";
    let clientEmail = "";
    let clientPhone = "";
    if (client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("name, email, phone")
        .eq("id", client_id)
        .single();
      clientName = client?.name || "Client";
      clientEmail = client?.email || "";
      clientPhone = client?.phone || "";
    }

    // Get gallery info
    let galleryName = "Gallery";
    if (gallery_id) {
      const { data: gallery } = await supabase
        .from("galleries")
        .select("name, price")
        .eq("id", gallery_id)
        .single();
      galleryName = gallery?.name || "Gallery";
    }

    // Generate receipt number
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
    const receiptNumber = `EV-${dateStr}-${rand}`;

    // Use custom settings or defaults
    const businessName = receiptSettings?.business_name || 
                         brandSettings?.brand_name || 
                         "Epix Visuals";
    const tagline = receiptSettings?.business_tagline || "Professional Photography";
    const primaryColor = receiptSettings?.primary_color || "#d4af37";
    const secondaryColor = receiptSettings?.secondary_color || "#1a1a1a";
    const footerText = receiptSettings?.footer_text || "Thank you for your payment!";
    const showTax = receiptSettings?.show_tax || false;
    const taxPercent = receiptSettings?.tax_percent || 0;
    const template = receiptSettings?.template || "standard";

    // Calculate tax if enabled
    const subtotal = Number(amount);
    const taxAmount = showTax ? subtotal * (taxPercent / 100) : 0;
    const total = subtotal + taxAmount;

    // Generate receipt text (for SMS/WhatsApp)
    const receiptText = [
      "========================================",
      `       ${businessName}`,
      `       ${tagline}`,
      "           PAYMENT RECEIPT",
      "========================================",
      "",
      `Receipt No:   ${receiptNumber}`,
      `Date:         ${now.toLocaleDateString("en-KE")}`,
      `Time:         ${now.toLocaleTimeString("en-KE")}`,
      "",
      "----------------------------------------",
      `Client:       ${clientName}`,
      `Gallery:      ${galleryName}`,
      "----------------------------------------",
      "",
      `Amount:       KES ${subtotal.toLocaleString("en-KE")}`,
      ...(showTax ? [`Tax (${taxPercent}%): KES ${taxAmount.toLocaleString("en-KE")}`] : []),
      `Total:        KES ${total.toLocaleString("en-KE")}`,
      "",
      `Method:       M-Pesa`,
      `Phone:        ${phone_number || clientPhone || "N/A"}`,
      `Transaction:  ${transaction_id || "Pending"}`,
      `Status:       Completed`,
      "",
      "========================================",
      footerText,
      `${photographer?.name || businessName}`,
      ...(receiptSettings?.phone ? [receiptSettings.phone] : []),
      ...(receiptSettings?.email ? [receiptSettings.email] : []),
      "========================================",
    ].join("\n");

    // Generate HTML receipt
    const receiptHtml = generateReceiptHtml({
      businessName,
      tagline,
      logoUrl: receiptSettings?.show_logo ? (receiptSettings?.logo_url || brandSettings?.logo_url) : null,
      receiptNumber,
      date: now.toLocaleDateString("en-KE"),
      time: now.toLocaleTimeString("en-KE"),
      clientName,
      clientEmail,
      clientPhone,
      galleryName,
      subtotal,
      taxAmount,
      taxPercent,
      total,
      showTax,
      phone: phone_number || clientPhone,
      transactionId: transactionId || "Pending",
      primaryColor,
      secondaryColor,
      footerText,
      termsAndConditions: receiptSettings?.terms_and_conditions,
      showQrCode: receiptSettings?.show_qr_code ?? true,
      template,
      items,
      photographerName: photographer?.name,
      photographerPhone: receiptSettings?.phone || photographer?.phone,
      photographerEmail: receiptSettings?.email || photographer?.email,
      address: receiptSettings?.address,
      website: receiptSettings?.website,
      tillNumber: receiptSettings?.till_number,
      paybillNumber: receiptSettings?.paybill_number,
    });

    // Store receipt
    const { data: receipt, error: insertError } = await supabase
      .from("payment_receipts")
      .upsert({
        ...(receipt_id ? { id: receipt_id } : {}),
        photographer_id,
        client_id,
        gallery_id,
        amount: total,
        currency: "KES",
        transaction_id: transaction_id || null,
        phone_number: phone_number || null,
        receipt_number: receiptNumber,
        payment_method: "mpesa",
        status: "completed",
        receipt_text: receiptText,
        receipt_html: receiptHtml,
      }, { onConflict: receipt_id ? "id" : undefined })
      .select("id, receipt_number")
      .single();

    if (insertError) {
      console.error("Failed to store receipt:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        receipt_number: receiptNumber,
        receipt_text: receiptText,
        receipt_html: receiptHtml,
        receipt_id: receipt?.id,
        amount: total,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Receipt generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Receipt generation failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

interface ReceiptHtmlParams {
  businessName: string;
  tagline: string;
  logoUrl: string | null;
  receiptNumber: string;
  date: string;
  time: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  galleryName: string;
  subtotal: number;
  taxAmount: number;
  taxPercent: number;
  total: number;
  showTax: boolean;
  phone: string;
  transactionId: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  termsAndConditions?: string;
  showQrCode: boolean;
  template: string;
  items?: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  photographerName?: string;
  photographerPhone?: string;
  photographerEmail?: string;
  address?: string;
  website?: string;
  tillNumber?: string;
  paybillNumber?: string;
}

function generateReceiptHtml(params: ReceiptHtmlParams): string {
  const {
    businessName, tagline, logoUrl, receiptNumber, date, time,
    clientName, clientEmail, clientPhone, galleryName,
    subtotal, taxAmount, taxPercent, total, showTax,
    phone, transactionId, primaryColor, secondaryColor,
    footerText, termsAndConditions, showQrCode, template,
    items, photographerName, photographerPhone, photographerEmail,
    address, website, tillNumber, paybillNumber
  } = params;

  const logoHtml = logoUrl 
    ? `<div style="text-align:center;margin-bottom:20px;"><img src="${logoUrl}" alt="Logo" style="max-height:80px;object-fit:contain;"></div>`
    : '';

  const contactHtml = `
    <div style="text-align:center;margin-top:20px;font-size:12px;color:#666;">
      ${photographerPhone ? `<div>📞 ${photographerPhone}</div>` : ''}
      ${photographerEmail ? `<div>✉️ ${photographerEmail}</div>` : ''}
      ${address ? `<div>📍 ${address}</div>` : ''}
      ${website ? `<div>🌐 ${website}</div>` : ''}
      ${tillNumber ? `<div>Till: ${tillNumber}</div>` : ''}
      ${paybillNumber ? `<div>Paybill: ${paybillNumber}</div>` : ''}
    </div>
  `;

  const itemsHtml = items && items.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin:15px 0;">
        <thead>
          <tr style="border-bottom:2px solid ${primaryColor};">
            <th style="text-align:left;padding:8px 0;">Item</th>
            <th style="text-align:center;padding:8px 0;">Qty</th>
            <th style="text-align:right;padding:8px 0;">Price</th>
            <th style="text-align:right;padding:8px 0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:8px 0;">${item.description}</td>
              <td style="text-align:center;padding:8px 0;">${item.quantity}</td>
              <td style="text-align:right;padding:8px 0;">KES ${item.unit_price.toLocaleString()}</td>
              <td style="text-align:right;padding:8px 0;">KES ${item.total.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '';

  const qrCodeHtml = showQrCode
    ? `<div style="text-align:center;margin:20px 0;">
        <div style="display:inline-block;padding:10px;background:#f5f5f5;border-radius:8px;">
          <div style="width:100px;height:100px;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;">
            QR Code
          </div>
        </div>
        <div style="font-size:10px;color:#666;margin-top:5px;">Scan to verify receipt</div>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${receiptNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .receipt { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 20px; }
    .business-name { font-size: 24px; font-weight: bold; color: ${secondaryColor}; margin: 0; }
    .tagline { font-size: 12px; color: #666; margin: 5px 0 0 0; }
    .receipt-title { font-size: 14px; color: ${primaryColor}; margin-top: 15px; text-transform: uppercase; letter-spacing: 2px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-label { color: #666; font-size: 14px; }
    .info-value { font-weight: 600; color: ${secondaryColor}; font-size: 14px; }
    .total-section { background: ${primaryColor}10; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .total-label { font-size: 14px; color: #666; }
    .total-value { font-size: 14px; color: ${secondaryColor}; }
    .grand-total { font-size: 18px; font-weight: bold; color: ${secondaryColor}; border-top: 2px solid ${primaryColor}; padding-top: 10px; margin-top: 10px; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
    .footer-text { font-style: italic; color: #666; font-size: 14px; }
    .terms { font-size: 10px; color: #999; margin-top: 15px; line-height: 1.4; }
    .badge { display: inline-block; background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoHtml}
    <div class="header">
      <h1 class="business-name">${businessName}</h1>
      <p class="tagline">${tagline}</p>
      <p class="receipt-title">Payment Receipt</p>
    </div>
    
    <div class="info-row">
      <span class="info-label">Receipt No</span>
      <span class="info-value">${receiptNumber}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date</span>
      <span class="info-value">${date}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Time</span>
      <span class="info-value">${time}</span>
    </div>
    
    <div style="margin:20px 0;">
      <div class="info-row">
        <span class="info-label">Client</span>
        <span class="info-value">${clientName}</span>
      </div>
      ${clientPhone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${clientPhone}</span></div>` : ''}
      <div class="info-row">
        <span class="info-label">Gallery</span>
        <span class="info-value">${galleryName}</span>
      </div>
    </div>
    
    ${itemsHtml}
    
    <div class="total-section">
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">KES ${subtotal.toLocaleString()}</span>
      </div>
      ${showTax ? `
      <div class="total-row">
        <span class="total-label">Tax (${taxPercent}%)</span>
        <span class="total-value">KES ${taxAmount.toLocaleString()}</span>
      </div>
      ` : ''}
      <div class="total-row grand-total">
        <span class="total-label">Total Paid</span>
        <span class="total-value">KES ${total.toLocaleString()}</span>
      </div>
    </div>
    
    <div class="info-row">
      <span class="info-label">Payment Method</span>
      <span class="info-value">M-Pesa</span>
    </div>
    <div class="info-row">
      <span class="info-label">Phone</span>
      <span class="info-value">${phone}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Transaction ID</span>
      <span class="info-value">${transactionId}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Status</span>
      <span class="info-value"><span class="badge">Completed</span></span>
    </div>
    
    ${qrCodeHtml}
    
    <div class="footer">
      <p class="footer-text">${footerText}</p>
      <p style="margin:5px 0 0 0;font-weight:600;color:${secondaryColor};">${photographerName || businessName}</p>
    </div>
    
    ${contactHtml}
    
    ${termsAndConditions ? `<div class="terms">${termsAndConditions}</div>` : ''}
  </div>
</body>
</html>
  `;
}