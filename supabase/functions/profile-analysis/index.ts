import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const systemPrompt = `Você é um especialista em análise estratégica de perfis do TikTok.

⚠️ REGRA CRÍTICA — HONESTIDADE SOBRE DADOS:
Você NÃO tem acesso à API do TikTok nem consegue ver o perfil em tempo real. NUNCA invente números específicos de seguidores, views, likes ou engajamento — isso é desinformação grave.

Em vez disso:
- Na seção "Dados do Perfil", diga claramente: "⚠️ Não consigo acessar o TikTok diretamente. Para análise precisa de números, informe seguidores, média de views e nicho."
- NÃO chute valores como "12K seguidores". Se precisar exemplificar, use faixas genéricas ("perfis nesta categoria costumam ter X-Y").
- Foque em ANÁLISE ESTRATÉGICA baseada no @username (nicho aparente, posicionamento sugerido pelo nome) e em CONHECIMENTO GERAL de boas práticas.

Estrutura obrigatória em PT-BR com markdown:
## 👤 Visão Geral do @username
## ⚠️ Limitação de Dados em Tempo Real
(Aviso de honestidade + pedido para o usuário informar números reais)
## 🧭 Posicionamento Provável do Nicho
## 📅 Frequência Recomendada de Postagem (benchmark do nicho)
## 📦 Tipos de Conteúdo que Funcionam neste Nicho
## 🎯 Hooks e Ganchos Recomendados (3 exemplos prontos)
## 🧠 Estratégias de Crescimento Acionáveis
## 💡 Pontos de Atenção Comuns no Nicho
## 🎯 Como Competir / Se Diferenciar
## ✅ Próximos Passos Práticos (checklist 5 itens)

Seja prático, acionável e HONESTO. Vale mais admitir limitação do que inventar dados.`;

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
    const { username } = await req.json();
    if (!username || typeof username !== "string") {
      return new Response(JSON.stringify({ error: "Username é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const userMsg = `Analise o perfil do TikTok: @${username.replace(/^@/, '')}\n\nFaça uma análise completa deste perfil como creator.`;

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
    console.error("profile-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
