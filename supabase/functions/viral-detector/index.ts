import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const systemPrompt = `Você é um especialista em análise de vídeos virais nas redes sociais (TikTok, YouTube Shorts, Instagram Reels).

Gere um relatório COMPLETO em português brasileiro com emojis e markdown:
## 🎯 Hook Utilizado
## 🏗️ Estrutura do Vídeo
## 📦 Tipo de Conteúdo
## 🎯 Objetivo do Vídeo
## 💡 Gatilhos Emocionais
## 📢 CTA Utilizado
## 🎬 Estilo de Narrativa
## 📊 Potencial Viral (Nota 1-10)
## 💎 Dicas para Replicar

Seja detalhado, prático e acionável.`;

function transformGeminiSSE(response: Response): ReadableStream {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) { console.error("Stream error:", err); controller.close(); }
    },
  });
}

async function streamFromOpenAICompat(url: string, apiKey: string, userMsg: string): Promise<Response | null> {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: url.includes("groq") ? "llama-3.3-70b-versatile" : "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
        stream: true,
      }),
    });
    if (resp.ok) return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    console.error(`Stream failed from ${url}, status:`, resp.status);
  } catch (err) { console.error(`Stream error from ${url}:`, err); }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, platform } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL do vídeo é obrigatória" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const userMsg = `Analise este vídeo da plataforma ${platform || "desconhecida"}: ${url}\n\nFaça uma análise completa do potencial viral deste vídeo.`;

    // 1. Gemini
    if (GOOGLE_API_KEY) {
      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}&alt=sse`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userMsg}` }] }] }),
        });
        if (response.ok) return new Response(transformGeminiSSE(response), { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        console.error("Gemini failed:", response.status);
      } catch (err) { console.error("Gemini error:", err); }
    }

    // 2. Groq
    if (GROQ_API_KEY) {
      const res = await streamFromOpenAICompat(GROQ_API_URL, GROQ_API_KEY, userMsg);
      if (res) return res;
    }

    // 3. Lovable AI
    if (LOVABLE_API_KEY) {
      const res = await streamFromOpenAICompat(LOVABLE_AI_URL, LOVABLE_API_KEY, userMsg);
      if (res) return res;
    }

    return new Response(JSON.stringify({ error: "Nenhum provedor de IA disponível." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("viral-detector error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
