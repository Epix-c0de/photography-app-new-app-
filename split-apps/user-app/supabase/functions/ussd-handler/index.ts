import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  text: string;
}

interface USSDProvider {
  name: string;
  handleRequest(session: USSDSession, supabase: any): Promise<string>;
}

async function getBaseLink(supabase: any, ownerAdminId: string): Promise<string> {
  const { data: brand } = await supabase
    .from("brand_settings")
    .select("share_app_link")
    .eq("admin_id", ownerAdminId)
    .maybeSingle();

  if (brand?.share_app_link) return brand.share_app_link;

  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "platform_base_url")
    .maybeSingle();

  return setting?.value || "https://epixvisuals.co.ke";
}

// HostPinnacle USSD Provider
class HostPinnacleProvider implements USSDProvider {
  name = "hostpinnacle";

  async handleRequest(session: USSDSession, supabase: any): Promise<string> {
    const { text } = session;
    const parts = text.split("*");
    const accessCode = parts[1]?.trim().toUpperCase();
    const option = parts[2] || "";

    if (!accessCode) {
      return "CON Welcome to Epix Visuals\n1. View Gallery\n2. Get Help\n3. Exit";
    }

    if (option === "1") {
      return await this.getGalleryLink(accessCode, supabase);
    } else if (option === "2") {
      return "END For support, contact us at +254712345678";
    } else if (option === "3") {
      return "END Thank you for using Epix Visuals!";
    }

    return await this.showGalleryMenu(accessCode, supabase);
  }

  private async showGalleryMenu(accessCode: string, supabase: any): Promise<string> {
    const { data: gallery, error } = await supabase
      .from("galleries")
      .select("id, name, is_paid, price, access_code")
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .single();

    if (error || !gallery) {
      return "END Invalid code. Please check and try again.";
    }

    const priceInfo = gallery.is_paid
      ? ""
      : `\nPrice: KES ${gallery.price || 0}`;

    return `CON Gallery: ${gallery.name}${priceInfo}\n\n1. Get Gallery Link\n2. Get Help\n3. Exit`;
  }

  private async getGalleryLink(accessCode: string, supabase: any): Promise<string> {
    const { data: gallery, error } = await supabase
      .from("galleries")
      .select("id, name, owner_admin_id, access_code")
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .single();

    if (error || !gallery) {
      return "END Gallery not found.";
    }

    const appLink = await getBaseLink(supabase, gallery.owner_admin_id);
    const deepLink = `${appLink}?gallery=${gallery.id}&code=${accessCode}`;

    return `END View your ${gallery.name} photos:\n\n${deepLink}\n\nOpen the link in your browser to view & download.`;
  }
}

// Africa's Talking USSD Provider
class AfricastalkingProvider implements USSDProvider {
  name = "africastalking";

  async handleRequest(session: USSDSession, supabase: any): Promise<string> {
    const { text } = session;
    const parts = text.split("*");
    const accessCode = parts[0]?.trim().toUpperCase();
    const option = parts[1] || "";

    if (!accessCode) {
      return "CON Welcome to Epix Visuals\n1. View Gallery\n2. Get Help\n3. Exit";
    }

    if (option === "1") {
      return await this.getGalleryLink(accessCode, supabase);
    } else if (option === "2") {
      return "END For support, call +254712345678";
    } else if (option === "3") {
      return "END Thank you!";
    }

    return await this.showGalleryMenu(accessCode, supabase);
  }

  private async showGalleryMenu(accessCode: string, supabase: any): Promise<string> {
    const { data: gallery, error } = await supabase
      .from("galleries")
      .select("id, name, is_paid, price")
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .single();

    if (error || !gallery) {
      return "END Invalid code.";
    }

    return `CON ${gallery.name}\n1. Get Link\n2. Help\n3. Exit`;
  }

  private async getGalleryLink(accessCode: string, supabase: any): Promise<string> {
    const { data: gallery } = await supabase
      .from("galleries")
      .select("id, name, owner_admin_id")
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .single();

    if (!gallery) return "END Gallery not found.";

    const link = await getBaseLink(supabase, gallery.owner_admin_id);
    const deepLink = `${link}?gallery=${gallery.id}&code=${accessCode}`;

    return `END ${gallery.name}:\n${deepLink}`;
  }
}

// Custom/Manual Provider (for testing or self-hosted)
class CustomProvider implements USSDProvider {
  name = "custom";

  async handleRequest(session: USSDSession, supabase: any): Promise<string> {
    const { text } = session;
    const parts = text.split("*");
    const accessCode = parts[1]?.trim().toUpperCase();
    const option = parts[2] || "";

    if (!accessCode) {
      return "CON Welcome to Epix Visuals\n1. View Gallery\n2. Help\n3. Exit";
    }

    if (option === "1") {
      const { data: gallery } = await supabase
        .from("galleries")
        .select("id, name, owner_admin_id")
        .eq("access_code", accessCode)
        .eq("is_active", true)
        .single();

      if (!gallery) return "END Gallery not found.";

      const link = await getBaseLink(supabase, gallery.owner_admin_id);
      return `END View photos:\n${link}?gallery=${gallery.id}&code=${accessCode}`;
    }

    if (option === "2") return "END Support: +254712345678";
    if (option === "3") return "END Thank you!";

    const { data: gallery } = await supabase
      .from("galleries")
      .select("name, price")
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .single();

    if (!gallery) return "END Invalid code.";

    return `CON ${gallery.name}\n1. Get Link\n2. Help\n3. Exit`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "ussd_provider",
        "ussd_short_code",
        "hostpinnacle_api_key",
        "hostpinnacle_username",
        "africastalking_api_key",
        "africastalking_username",
      ]);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => {
      config[s.key] = s.value || "";
    });

    const providerName = config.ussd_provider || "hostpinnacle";

    let session: USSDSession;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      session = {
        sessionId: body.sessionId || body.session_id || `session_${Date.now()}`,
        phoneNumber: body.phoneNumber || body.phone_number || body.msisdn || "",
        serviceCode: body.serviceCode || body.service_code || "",
        text: body.text || "",
      };
    } else {
      const formData = await req.formData();
      session = {
        sessionId: (formData.get("sessionId") || formData.get("session_id") || `session_${Date.now()}`) as string,
        phoneNumber: (formData.get("phoneNumber") || formData.get("phone_number") || formData.get("msisdn") || "") as string,
        serviceCode: (formData.get("serviceCode") || formData.get("service_code") || "") as string,
        text: (formData.get("text") || "") as string,
      };
    }

    let provider: USSDProvider;
    switch (providerName) {
      case "africastalking":
        provider = new AfricastalkingProvider();
        break;
      case "custom":
        provider = new CustomProvider();
        break;
      case "hostpinnacle":
      default:
        provider = new HostPinnacleProvider();
        break;
    }

    const response = await provider.handleRequest(session, supabase);

    await supabase.from("ussd_requests").insert({
      session_id: session.sessionId,
      phone_number: session.phoneNumber,
      service_code: session.serviceCode,
      text: session.text,
      response: response,
      provider: providerName,
    });

    return new Response(response, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
      },
    });

  } catch (error) {
    console.error("USSD handler error:", error);
    return new Response("END An error occurred. Please try again.", {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
      },
    });
  }
});
