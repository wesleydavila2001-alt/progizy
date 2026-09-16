const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type ProviderFailure = {
  provider: "gemini" | "lovable";
  status: number;
  message: string;
};

type ProviderResult = {
  content: string | null;
  failure?: ProviderFailure;
};

function trimErrorMessage(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, 300);
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<ProviderResult> {
  const key = Deno.env.get("GOOGLE_API_KEY");
  if (!key) {
    return {
      content: null,
      failure: {
        provider: "gemini",
        status: 503,
        message: "GOOGLE_API_KEY não configurada",
      },
    };
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        }),
      }
    );

    if (!r.ok) {
      const errorText = trimErrorMessage(await r.text().catch(() => ""));
      console.error("Gemini failed", r.status, errorText);
      return {
        content: null,
        failure: {
          provider: "gemini",
          status: r.status,
          message: errorText || "Gemini request failed",
        },
      };
    }

    const d = await r.json();
    const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof t !== "string" || !t.trim()) {
      return {
        content: null,
        failure: {
          provider: "gemini",
          status: 502,
          message: "Resposta vazia do Gemini",
        },
      };
    }

    return { content: t.trim() };
  } catch (e) {
    console.error("Gemini error", e);
    return {
      content: null,
      failure: {
        provider: "gemini",
        status: 503,
        message: e instanceof Error ? e.message : "Gemini unexpected error",
      },
    };
  }
}

async function callLovable(systemPrompt: string, userPrompt: string): Promise<ProviderResult> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return {
      content: null,
      failure: {
        provider: "lovable",
        status: 503,
        message: "LOVABLE_API_KEY não configurada",
      },
    };
  }

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const errorText = trimErrorMessage(await r.text().catch(() => ""));
      console.error("Lovable failed", r.status, errorText);
      return {
        content: null,
        failure: {
          provider: "lovable",
          status: r.status,
          message: errorText || "Lovable AI request failed",
        },
      };
    }

    const d = await r.json();
    const t = d?.choices?.[0]?.message?.content;
    if (typeof t !== "string" || !t.trim()) {
      return {
        content: null,
        failure: {
          provider: "lovable",
          status: 502,
          message: "Resposta vazia do Lovable AI",
        },
      };
    }

    return { content: t.trim() };
  } catch (e) {
    console.error("Lovable error", e);
    return {
      content: null,
      failure: {
        provider: "lovable",
        status: 503,
        message: e instanceof Error ? e.message : "Lovable unexpected error",
      },
    };
  }
}

function buildFailureResponse(failures: ProviderFailure[]) {
  const hasStatus = (status: number) => failures.some((failure) => failure.status === status);
  const safeFailures = failures.map(({ provider, status }) => ({ provider, status }));

  if (hasStatus(402)) {
    return json(
      {
        error: "PAYMENT_REQUIRED",
        message: "Os créditos de IA acabaram. Adicione saldo para continuar.",
        fallback: false,
        provider_errors: safeFailures,
      },
      402
    );
  }

  if (hasStatus(429)) {
    return json(
      {
        error: "RATE_LIMITED",
        message: "Muitas requisições de IA no momento. Tente novamente em instantes.",
        fallback: false,
        provider_errors: safeFailures,
      },
      429
    );
  }

  const authFailure = failures.find((failure) => failure.status === 401 || failure.status === 403);
  if (authFailure) {
    return json(
      {
        error: "AUTH_ERROR",
        message: "Falha de autenticação com o provedor de IA.",
        fallback: false,
        provider_errors: safeFailures,
      },
      authFailure.status
    );
  }

  return json({
    error: "SERVICE_UNAVAILABLE",
    message: "Os provedores de IA estão indisponíveis no momento.",
    fallback: true,
    provider_errors: safeFailures,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const hook = typeof body?.hook === "string" ? body.hook.trim() : "";
    const mode = body?.mode === "translate_en" ? "translate_en" : "variations";
    const niche = typeof body?.niche === "string" ? body.niche.trim() : "";
    if (!hook) return json({ error: "hook is required" }, 400);

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "translate_en") {
      systemPrompt = "You translate viral short-form video hooks from Portuguese to English. Preserve placeholders like [___] exactly. Keep the punchy tone. Return ONLY the English hook, no quotes, no explanation.";
      userPrompt = hook;
    } else {
      systemPrompt = `Você é um copywriter expert em hooks virais para TikTok/Reels/Shorts. Gere 5 variações criativas do hook abaixo, mantendo a estrutura psicológica.
- Preserve placeholders [___] quando existirem.
${niche ? `- Adapte para o nicho: ${niche}` : "- Mantenha genérico/adaptável"}
- Cada variação deve ser distinta.
- Retorne APENAS um JSON array de 5 strings. Sem markdown, sem texto extra.
Exemplo: ["v1","v2","v3","v4","v5"]`;
      userPrompt = `Hook original: ${hook}`;
    }

    const failures: ProviderFailure[] = [];
    const providers = [callGemini, callLovable];
    let content: string | null = null;

    for (const provider of providers) {
      const result = await provider(systemPrompt, userPrompt);
      if (result.content) {
        content = result.content;
        break;
      }
      if (result.failure) failures.push(result.failure);
    }

    if (!content) {
      return buildFailureResponse(failures);
    }

    if (mode === "translate_en") {
      return json({ translation: content.replace(/^["']|["']$/g, "").trim(), fallback: false });
    }

    let variations: string[] = [];
    try {
      const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) variations = parsed.filter((x) => typeof x === "string");
    } catch {
      variations = content
        .split("\n")
        .map((l) => l.replace(/^[\d.\-)\s"]+|["]+$/g, "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    if (variations.length === 0) {
      return json({
        error: "INVALID_AI_RESPONSE",
        message: "A IA respondeu em um formato inválido.",
        fallback: true,
      });
    }

    return json({ variations, fallback: false });
  } catch (e) {
    console.error("Unexpected error:", e);
    return json({
      error: "SERVICE_FAILED",
      message: e instanceof Error ? e.message : "Erro inesperado",
      fallback: true,
    });
  }
});
