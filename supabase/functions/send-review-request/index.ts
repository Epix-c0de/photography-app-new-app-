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

    const { gallery_id, client_id, method } = await req.json();

    if (!gallery_id || !client_id) {
      return new Response(
        JSON.stringify({ error: "Missing gallery_id or client_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get gallery and client details
    const { data: gallery, error: galleryError } = await supabase
      .from("galleries")
      .select("id, name, owner_admin_id, access_code")
      .eq("id", gallery_id)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: "Gallery not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, phone, email")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get brand settings
    const { data: brandSettings } = await supabase
      .from("brand_settings")
      .select("share_app_link, brand_name")
      .eq("admin_id", gallery.owner_admin_id)
      .maybeSingle();

    const appLink = brandSettings?.share_app_link || "https://epixvisuals.co.ke";
    const brandName = brandSettings?.brand_name || "Epix Visuals";
    const reviewLink = `${appLink}/review?gallery=${gallery_id}&client=${client_id}`;

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("gallery_id", gallery_id)
      .eq("client_id", client_id)
      .maybeSingle();

    if (existingReview) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Review already submitted" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send review request
    let sendMethod = method || "sms";
    let sendResult = { success: false, message: "" };

    if (sendMethod === "sms" && client.phone) {
      // Send via SMS
      const { data: smsSettings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["africastalking_api_key", "africastalking_username"]);

      const smsConfig: Record<string, string> = {};
      smsSettings?.forEach((s: any) => {
        smsConfig[s.key] = s.value || "";
      });

      if (smsConfig.africastalking_api_key) {
        let formattedPhone = client.phone.replace(/[^\d]/g, "");
        if (formattedPhone.startsWith("0") && formattedPhone.length === 10) {
          formattedPhone = `254${formattedPhone.slice(1)}`;
        } else if (formattedPhone.startsWith("7") && formattedPhone.length === 9) {
          formattedPhone = `254${formattedPhone}`;
        }

        const message = `Hi ${client.name}! 📸\n\nThank you for choosing ${brandName} for your ${gallery.name} photos.\n\nWe'd love to hear your feedback! Please take a moment to leave a review:\n\n${reviewLink}\n\nYour review helps us serve you better! ❤️`;

        try {
          const response = await fetch("https://api.africastalking.com/version1/messaging", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apiKey: smsConfig.africastalking_api_key,
              Accept: "application/json",
            },
            body: JSON.stringify({
              username: smsConfig.africastalking_username || "epixvisuals",
              to: [`+${formattedPhone}`],
              message,
            }),
          });

          const result = await response.json();
          sendResult = { success: true, message: "SMS sent successfully" };
        } catch (error) {
          sendResult = { success: false, message: "SMS sending failed" };
        }
      }
    } else if (sendMethod === "whatsapp" && client.phone) {
      // Send via WhatsApp
      const { data: whatsappSettings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["whatsapp_api_key", "whatsapp_phone_number_id"]);

      const whatsappConfig: Record<string, string> = {};
      whatsappSettings?.forEach((s: any) => {
        whatsappConfig[s.key] = s.value || "";
      });

      if (whatsappConfig.whatsapp_api_key) {
        let formattedPhone = client.phone.replace(/[^\d]/g, "");
        if (formattedPhone.startsWith("0") && formattedPhone.length === 10) {
          formattedPhone = `254${formattedPhone.slice(1)}`;
        } else if (formattedPhone.startsWith("7") && formattedPhone.length === 9) {
          formattedPhone = `254${formattedPhone}`;
        }

        const message = `Hi ${client.name}! 📸\n\nThank you for choosing ${brandName} for your ${gallery.name} photos.\n\nWe'd love to hear your feedback! Please take a moment to leave a review:\n\n${reviewLink}\n\nYour review helps us serve you better! ❤️`;

        try {
          const response = await fetch(
            `https://graph.facebook.com/v17.0/${whatsappConfig.whatsapp_phone_number_id}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${whatsappConfig.whatsapp_api_key}`,
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: "text",
                text: { body: message },
              }),
            }
          );

          sendResult = { success: true, message: "WhatsApp sent successfully" };
        } catch (error) {
          sendResult = { success: false, message: "WhatsApp sending failed" };
        }
      }
    }

    // Log the review request
    await supabase.from("review_requests").insert({
      gallery_id,
      client_id,
      photographer_id: gallery.owner_admin_id,
      method: sendMethod,
      status: sendResult.success ? "sent" : "failed",
      review_link: reviewLink,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: sendResult.message,
        review_link: reviewLink,
        client_name: client.name,
        gallery_name: gallery.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Review request error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send review request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
