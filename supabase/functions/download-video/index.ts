import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COBALT_INSTANCES = [
  "https://api.cobalt.tools",
  "https://cobalt-api.kwiatekmiki.com",
  "https://cobalt.api.timelessnesses.me",
  "https://cobalt-api.ayo.tf",
];

function detectPlatform(url: string) {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/kwai\.com/i.test(url)) return "kwai";
  return "other";
}

async function tryTikTokFallback(url: string) {
  const response = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ url, hd: 1 }),
  });

  if (!response.ok) {
    throw new Error(`Fallback TikTok falhou com HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.code !== 0 || !payload?.data) {
    throw new Error(payload?.msg || "Fallback TikTok sem resposta válida");
  }

  const downloadUrl = payload.data.hdplay || payload.data.play || payload.data.wmplay;
  if (!downloadUrl) {
    throw new Error("Fallback TikTok não retornou link de vídeo");
  }

  return {
    downloadUrl,
    filename: `${String(payload.data.title || "tiktok-video").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || "tiktok-video"}.mp4`,
    title: payload.data.title || "TikTok video",
  };
}

async function tryCobalt(url: string) {
  const errors: string[] = [];

  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying instance: ${instance}`);
      const res = await fetch(`${instance}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          url,
          downloadMode: "auto",
          filenameStyle: "basic",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        errors.push(`${instance}: HTTP ${res.status} - ${text.slice(0, 140)}`);
        continue;
      }

      const data = await res.json();
      console.log(`Response from ${instance}:`, JSON.stringify(data).slice(0, 300));

      if (data.status === "error") {
        errors.push(`${instance}: ${data.error?.code || JSON.stringify(data.error) || "unknown"}`);
        continue;
      }

      if ((data.status === "redirect" || data.status === "tunnel" || data.status === "stream") && data.url) {
        return {
          downloadUrl: data.url,
          filename: data.filename || "video.mp4",
          title: data.filename || "video.mp4",
        };
      }

      if (data.status === "picker" && data.picker?.length > 0) {
        const videoItem = data.picker.find((p: any) => p.type === "video") || data.picker[0];
        return {
          downloadUrl: videoItem.url,
          filename: videoItem.filename || "video.mp4",
          title: videoItem.filename || "video.mp4",
        };
      }

      errors.push(`${instance}: unhandled status "${data.status}"`);
    } catch (err: any) {
      errors.push(`${instance}: ${err.message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platform = detectPlatform(url);

    try {
      const result = platform === "tiktok" ? await tryTikTokFallback(url) : await tryCobalt(url);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (primaryError: any) {
      if (platform !== "tiktok") {
        return new Response(JSON.stringify({
          error: "Nenhuma instância conseguiu processar o link",
          details: [primaryError.message],
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        error: "Falha ao processar link do TikTok",
        details: [primaryError.message],
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});