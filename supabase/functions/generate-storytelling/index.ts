import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function callGeminiJSON(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (r.ok) { const d = await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text || null; }
    console.error("Gemini failed:", r.status);
  } catch (e) { console.error("Gemini error:", e); }
  return null;
}

async function callGroqJSON(sys: string, user: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(GROQ_API_URL, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: sys }, { role: "user", content: user }], response_format: { type: "json_object" } }),
    });
    if (r.ok) { const d = await r.json(); return d.choices?.[0]?.message?.content || null; }
    console.error("Groq failed:", r.status);
  } catch (e) { console.error("Groq error:", e); }
  return null;
}

async function callLovableJSON(sys: string, user: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(LOVABLE_AI_URL, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: sys + "\n\nResponda APENAS com JSON válido." }, { role: "user", content: user }] }),
    });
    if (r.ok) { const d = await r.json(); return d.choices?.[0]?.message?.content || null; }
    console.error("Lovable AI failed:", r.status);
  } catch (e) { console.error("Lovable AI error:", e); }
  return null;
}

const systemPrompt = `Você é um especialista mundial em storytelling para vendas e marketing.

## FRAMEWORKS: Hero's Journey, StoryBrand, Epiphany Bridge, BAB, SSS, PAS Narrativo, Sparkline, Pixar Story Spine, Jornada do Cliente

## 10 TIPOS DE HISTÓRIA: Origem, Falha e Virada, Cliente, Inimigo Comum, Descoberta, Missão, Prova, Identidade, Contraste, Futuro

## ELEMENTOS OBRIGATÓRIOS: Personagem identificável, Conflito real, Emoção específica, Virada concreta, Solução natural, Transformação visível, CTA integrado

Responda SEMPRE em formato JSON válido.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, product, channel, tone, framework, storyType, audience, existingStory, mode } = await req.json();
    const isRecommendMode = mode === 'recommend';
    const isImproveMode = !!existingStory?.trim();

    if (!isRecommendMode && !isImproveMode && (!niche || !product)) return jsonResponse({ error: "Campos obrigatórios: nicho e produto." }, 400);
    if (isRecommendMode && (!niche || !product)) return jsonResponse({ error: "Campos obrigatórios: nicho e produto." }, 400);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let userPrompt: string;

    if (isRecommendMode) {
      userPrompt = `Analise o nicho "${niche}" e o produto "${product}"${audience ? ` para o público "${audience}"` : ''}.\n\nQual destes 10 tipos de história é o MAIS adequado? Responda EXATAMENTE com um destes valores no campo "recommendedType":\n- Origem\n- Falha e Virada\n- Cliente\n- Inimigo Comum\n- Descoberta\n- Missão\n- Prova\n- Identidade\n- Antes e Depois\n- Vulnerabilidade\n\nJSON: {"recommendedType":"<um dos 10 acima, exatamente>","reason":"<razão curta em 1 frase>"}`;
    } else if (isImproveMode) {
      userPrompt = `## MELHORAR STORYTELLING\n\nHistória:\n"""\n${existingStory}\n"""\n\n${niche ? `Nicho: ${niche}` : ''}\n${tone ? `Tom: ${tone}` : ''}\n\nJSON: {"diagnosis":"...","improvedStory":"...","changes":["..."],"alternativeOpenings":[{"text":"...","objective":"..."}],"integratedCTA":"..."}`;
    } else {
      const fl = framework && framework !== 'livre' ? framework : 'o mais adequado';
      userPrompt = `## GERAR STORYTELLING\n\nNicho: ${niche}\nProduto: ${product}\nPúblico: ${audience || 'geral'}\nCanal: ${channel || 'TikTok/Reels'}\nTom: ${tone || 'adaptado'}\nFramework: ${fl}\nTipo: ${storyType || 'Origem'}\n\nJSON: {"fullStory":"...","shortVersion":"...","videoScript":{"scene1":{"time":"0-3s","visual":"...","narration":"..."},"scene2":{"time":"3-10s","visual":"...","narration":"..."},"scene3":{"time":"10-20s","visual":"...","narration":"..."},"scene4":{"time":"20-25s","visual":"...","narration":"..."},"scene5":{"time":"25-30s","visual":"...","narration":"..."}},"openings":[{"text":"...","hookType":"...","objective":"..."}],"integratedCTA":"...","frameworkUsed":"${fl}","storyTypeUsed":"${storyType || 'Origem'}","emotionalArc":"..."}`;
    }

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // 1. Gemini
    if (GOOGLE_API_KEY) {
      const c = await callGeminiJSON(fullPrompt, GOOGLE_API_KEY);
      if (c) { try { return jsonResponse(JSON.parse(c)); } catch { console.error("Gemini parse error"); } }
    }
    // 2. Groq
    if (GROQ_API_KEY) {
      const c = await callGroqJSON(systemPrompt, userPrompt, GROQ_API_KEY);
      if (c) { try { return jsonResponse(JSON.parse(c)); } catch { console.error("Groq parse error"); } }
    }
    // 3. Lovable AI
    if (LOVABLE_API_KEY) {
      const c = await callLovableJSON(systemPrompt, userPrompt, LOVABLE_API_KEY);
      if (c) { try { return jsonResponse(JSON.parse(c)); } catch { console.error("Lovable parse error"); } }
    }

    return jsonResponse({ error: "Nenhum provedor de IA disponível." }, 500);
  } catch (e) {
    console.error("generate-storytelling error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
