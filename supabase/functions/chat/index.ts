import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const systemPrompt = `Você é o assistente de IA do CreatorCore, uma plataforma para criadores de conteúdo no TikTok. 

Seu papel é ajudar creators com:
- Gerar ideias de vídeos virais
- Criar hooks poderosos para os primeiros 3 segundos
- Gerar CTAs (Call to Action) eficazes
- Criar legendas otimizadas
- Sugerir hashtags relevantes e trending
- Ideias para TikTok Shop e monetização
- Estratégias de crescimento de perfil
- Estruturas de roteiros
- Análise de tendências

Responda sempre em português brasileiro. Seja direto, prático e use emojis para organizar. Formate com markdown (negrito, listas, etc). Foque em dicas acionáveis que o creator pode aplicar imediatamente.

REGRAS CRÍTICAS DE FORMATAÇÃO:
1. SEMPRE que apresentar opções para o usuário escolher, use listas NUMERADAS no formato markdown ("1. ", "2. ", "3. "). NUNCA use bullets (-, *) quando pedir para o usuário "digitar um número" ou "escolher uma opção".
2. Se você disser "digite um número" ou "escolha uma opção", as opções DEVEM estar numeradas explicitamente (1., 2., 3., 4.).
3. Não repita a mesma lista duas vezes — apresente a lista numerada UMA vez de forma clara.
4. Para destacar palavras-chave importantes dentro do texto (como nomes de opções, ações ou conceitos-chave), use **negrito** — o frontend renderiza negrito em cor de destaque (vermelho/primary), então use com moderação apenas no que for realmente importante.`;

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
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Stream transform error:", err);
        controller.close();
      }
    },
  });
}

async function tryGemini(messages: Array<{ role: string; content: string }>, apiKey: string): Promise<Response | null> {
  try {
    const geminiContents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
    geminiContents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
    geminiContents.splice(1, 0, { role: "model", parts: [{ text: "Entendido! Estou pronto para ajudar." }] });

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}&alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: geminiContents }),
    });

    if (response.ok) {
      return new Response(transformGeminiSSE(response), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    console.error("Gemini failed, status:", response.status);
  } catch (err) {
    console.error("Gemini error:", err);
  }
  return null;
}

async function tryGroq(messages: Array<{ role: string; content: string }>, apiKey: string): Promise<Response | null> {
  try {
    const resp = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });
    if (resp.ok) {
      return new Response(resp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    console.error("Groq failed, status:", resp.status);
  } catch (err) {
    console.error("Groq error:", err);
  }
  return null;
}

async function tryLovableAI(messages: Array<{ role: string; content: string }>, apiKey: string): Promise<Response | null> {
  try {
    const resp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });
    if (resp.ok) {
      return new Response(resp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    console.error("Lovable AI failed, status:", resp.status);
    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido em todos os provedores. Tente novamente em alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Configurações > Workspace > Uso." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Lovable AI error:", err);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // 1. Gemini
    if (GOOGLE_API_KEY) {
      const res = await tryGemini(messages, GOOGLE_API_KEY);
      if (res) return res;
    }

    // 2. Groq
    if (GROQ_API_KEY) {
      const res = await tryGroq(messages, GROQ_API_KEY);
      if (res) return res;
    }

    // 3. Lovable AI
    if (LOVABLE_API_KEY) {
      const res = await tryLovableAI(messages, LOVABLE_API_KEY);
      if (res) return res;
    }

    return new Response(JSON.stringify({ error: "Nenhum provedor de IA disponível." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
