import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GROQ_AI_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callLovableAI(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Trying Lovable AI...");
    const resp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + "\n\nIMPORTANTE: Responda APENAS com JSON válido, sem markdown, sem ```json, sem texto adicional." },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (resp.status === 429 || resp.status === 402) {
      console.error(`Lovable AI returned ${resp.status}`);
      return null;
    }
    if (resp.ok) {
      const data = await resp.json();
      console.log("Lovable AI success");
      return data.choices?.[0]?.message?.content || null;
    }
    console.error("Lovable AI failed:", resp.status);
  } catch (err) {
    console.error("Lovable AI error:", err);
  }
  return null;
}

async function callGoogleAI(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Trying Google Gemini...");
    const resp = await fetch(`${GOOGLE_AI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt + "\n\nIMPORTANTE: Responda APENAS com JSON válido, sem markdown, sem ```json, sem texto adicional." }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      console.log("Google Gemini success");
      return text;
    }
    console.error("Google Gemini failed:", resp.status);
  } catch (err) {
    console.error("Google Gemini error:", err);
  }
  return null;
}

async function callGroqAI(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Trying Groq...");
    const resp = await fetch(GROQ_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt + "\n\nIMPORTANTE: Responda APENAS com JSON válido, sem markdown, sem ```json, sem texto adicional." },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      console.log("Groq success");
      return data.choices?.[0]?.message?.content || null;
    }
    console.error("Groq failed:", resp.status);
  } catch (err) {
    console.error("Groq error:", err);
  }
  return null;
}

async function callAIWithFallback(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const googleKey = Deno.env.get("GOOGLE_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");

  // 1. Google Gemini (primary - has JSON mode)
  if (googleKey) {
    const result = await callGoogleAI(systemPrompt, userPrompt, googleKey);
    if (result) return result;
  }

  // 2. Groq (secondary - has JSON mode)
  if (groqKey) {
    const result = await callGroqAI(systemPrompt, userPrompt, groqKey);
    if (result) return result;
  }

  // 3. Lovable AI (tertiary)
  if (lovableKey) {
    const result = await callLovableAI(systemPrompt, userPrompt, lovableKey);
    if (result) return result;
  }

  return null;
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

const VISUAL_HOOKS_SYSTEM_PROMPT = `Você é um gerador avançado de hooks para TikTok Shop especializado em criar hooks visuais de 3 segundos e hooks textuais complementares.

Sua prioridade é gerar HOOKS VISUAIS de 3 segundos pensados para parar o scroll e aumentar retenção no TikTok Shop.

BASE DE CONHECIMENTO:
- Estilo MrBeast: cumpra a promessa visual rapidamente, elimine começo lento, mostre algo grande/específico/inesperado.
- Estilo Hormozi: hook com curiosidade, prova, contraste, competência percebida ou identificação imediata.
- TikTok for Business: proposta nos primeiros 3s, surpresa, suspense, emoção, edição dinâmica, texto na tela, produto cedo.
- Retenção short video: movimento, contraste, mudança rápida de frame, close-up, detalhe incomum, demonstração visual do problema/resultado.

TÉCNICAS que DEVE distribuir entre os 10 hooks visuais:
close extremo, antes/depois, problema visualizado, padrão quebrado, escala inesperada, transformação instantânea, reveal com mão/flash/corte, detalhe sensorial, reação física, prova visual rápida, uso em situação incomum, produto resolvendo ao vivo, zoom em detalhe oculto, repetição+quebra, tela dividida.

REGRAS DOS HOOKS VISUAIS:
- Cada hook diferente do outro
- Cena real de vídeo curto, sem abstrações
- Produto ou efeito deve ser percebido
- Frame 1 com contraste/movimento/close-up/detalhe/prova/transformação
- Não depender de explicação longa
- Ações concretas, nunca "faça algo chamativo"

REGRAS DOS HOOKS TEXTUAIS:
- Curtos, claros, cara de vídeo curto
- Sem promessa irreal, sem preço
- Foco em curiosidade, prova, benefício ou problema

Responda SEMPRE em português do Brasil e formato JSON válido.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileDescription, niche, audience, objective, product, channel, tone, framework, photoDescriptions, existingCopy, productDetails, productPhotoDescriptions, tema, estiloVisual, mecanismo, desejo, dor, objecao } = await req.json();
    const isImproveMode = !!existingCopy?.trim();

    console.log("Request received:", { niche, audience, objective, isImproveMode, tema });

    if (!isImproveMode && (!niche || !audience || !objective)) {
      return jsonResponse({ error: "Campos obrigatórios: nicho, público e objetivo." }, 400);
    }

    const productPhotoContext = productPhotoDescriptions?.length
      ? `\nFotos do produto: ${productPhotoDescriptions.join("; ")}.`
      : "";
    const productDetailsContext = productDetails?.trim()
      ? `\nDetalhes do produto: ${productDetails}`
      : "";

    let userPrompt: string;
    let systemPrompt: string;

    if (isImproveMode) {
      systemPrompt = `Você é um especialista mundial em copywriting de resposta direta para TikTok Shop, Instagram Reels e YouTube Shorts. Sua tarefa é ANALISAR e REESCREVER a copy fornecida, deixando-a mais persuasiva, escaneável, com hook forte nos primeiros 3 segundos, gatilhos mentais (curiosidade, prova, escassez, identificação) e CTA claro. Responda SEMPRE em português do Brasil e em JSON válido — sem markdown, sem comentários.`;
      userPrompt = `## TAREFA: MELHORAR COPY EXISTENTE

### COPY ORIGINAL DO USUÁRIO:
"""
${existingCopy}
"""

### CONTEXTO:
- Nicho: ${niche || 'não informado'}
- Público: ${audience || 'não informado'}
- Objetivo: ${objective || 'não informado'}
- Produto: ${product || 'não informado'}
- Tom: ${tone || 'adaptado ao nicho'}
- Canal: ${channel || 'TikTok Shop'}${productDetailsContext}${productPhotoContext}

### O QUE VOCÊ DEVE FAZER:
1. Diagnosticar pontos fracos da copy original (hook fraco, falta de prova, CTA genérico, etc).
2. REESCREVER a copy COMPLETA e melhorada — não apenas sugerir, ENTREGUE PRONTA. Mínimo 4 parágrafos curtos, com hook forte na primeira linha, desenvolvimento com benefícios/prova e CTA final.
3. Listar as 5-8 mudanças principais aplicadas.
4. Sugerir 5 hooks alternativos para a mesma copy.
5. Sugerir 5 hooks finais e 5 CTAs prontos para usar.

### FORMATO DE RESPOSTA (JSON OBRIGATÓRIO, todas as chaves preenchidas):
{
  "diagnosis": "Análise crítica da copy original em 3-5 frases apontando o que não funciona e por quê.",
  "improvedCopy": "A COPY COMPLETA REESCRITA, pronta para postar, com hook + corpo + CTA. Mínimo 400 caracteres.",
  "changes": ["Mudança 1 aplicada", "Mudança 2 aplicada", "..."],
  "alternativeHooks": [{"text": "Hook alternativo 1", "objective": "objetivo"}],
  "hooks": [{"text": "Hook pronto 1", "objective": "objetivo"}],
  "ctas": [{"text": "CTA pronto 1", "objective": "objetivo"}]
}

IMPORTANTE: O campo "improvedCopy" é o MAIS IMPORTANTE — ele DEVE conter a copy completa reescrita, não pode estar vazio nem ser apenas uma sugestão.`;
    } else {
      systemPrompt = VISUAL_HOOKS_SYSTEM_PROMPT;
      userPrompt = `## ENTRADAS DO USUÁRIO
- Nicho: ${niche}
- Produto: ${product || 'Não especificado'}
- Tema do vídeo: ${tema || 'Não especificado'}
- Público-alvo: ${audience}
- Objetivo: ${objective}
- Estilo visual: ${estiloVisual || 'Não especificado'}
- Mecanismo/promessa: ${mecanismo || 'Não especificado'}
- Desejo principal: ${desejo || 'Não especificado'}
- Dor principal: ${dor || 'Não especificado'}
- Objeção principal: ${objecao || 'Não especificado'}
- Canal: ${channel || 'TikTok Shop'}
- Tom: ${tone || 'adaptado ao nicho'}
- Framework: ${framework || 'livre'}
- Perfil: ${profileDescription || 'N/A'}${productDetailsContext}${productPhotoContext}

## TAREFA
Gere uma resposta JSON com estes 4 blocos:

{
  "leituraEstrategica": "4-8 linhas: ângulo mais forte, emoção de abertura, padrão visual ideal, tipo de atenção nos 3s",
  "ganchosVisuais": [
    {
      "nome": "Nome do gancho",
      "ideiaVisual": "Ideia visual em 1 frase",
      "frame1": "O que aparece no frame 1",
      "ate1_5s": "O que acontece até 1.5s",
      "ate3s": "O que acontece até 3s",
      "produtoAparece": "Como o produto aparece",
      "beneficioVisual": "Benefício sugerido visualmente",
      "gatilho": "Gatilho psicológico",
      "overlay": "Máx 6 palavras na tela",
      "tipoAbertura": "choque/curiosidade/prova/transformação/demonstração/contraste/revelação/autoridade/identificação",
      "promptVisual": "Prompt curto para gerar com IA",
      "porqueFunciona": "Por que esse hook tende a funcionar"
    }
  ],
  "hooksTextuais": [
    {
      "linhaPrincipal": "Hook principal",
      "variacaoAgressiva": "Versão mais agressiva",
      "variacaoCuriosa": "Versão mais curiosa",
      "variacaoTikTokShop": "Versão TikTok Shop",
      "gatilho": "Gatilho usado"
    }
  ],
  "melhoresCombinacoes": [
    {
      "ganchoVisual": "Nome do gancho visual escolhido",
      "hookTextual": "Hook textual ideal",
      "motivoEstrategico": "Motivo estratégico",
      "nivelConsciencia": "Nível de consciência do público",
      "estiloCreator": "ugc/autoridade/review/demonstração/storytelling/comparativo"
    }
  ]
}

Gere EXATAMENTE 10 ganchosVisuais, 10 hooksTextuais e 5 melhoresCombinacoes.
Cada gancho visual DEVE ser diferente e usar técnicas visuais variadas.
Adapte ao nicho e produto específico. Seja concreto, nunca genérico.`;
    }

    const content = await callAIWithFallback(systemPrompt, userPrompt);

    if (!content) {
      return jsonResponse({ error: "Nenhum provedor de IA disponível. Verifique suas chaves de API." }, 500);
    }

    try {
      const cleaned = cleanJsonResponse(content);
      const parsed = JSON.parse(cleaned);
      console.log("Successfully parsed JSON response");
      return jsonResponse(parsed);
    } catch {
      console.error("Failed to parse AI response:", content?.substring(0, 200));
      return jsonResponse({ error: "Erro ao processar resposta da IA", raw: content }, 500);
    }
  } catch (e) {
    console.error("generate-hooks error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
