// Lovable AI - Lyrics Composer (create/improve/adapt song lyrics)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "create" | "improve" | "adapt";

interface Body {
  mode: Mode;
  theme?: string;
  genre?: string;
  mood?: string;
  language?: string;
  structure?: string;
  rhyme?: string;
  lyrics?: string;
  targetGenre?: string;
  notes?: string;
}

function buildPrompt(b: Body): { system: string; user: string } {
  const lang = b.language || "Português (BR)";
  const system = `Você é um compositor profissional especializado em letras virais para plataformas como Suno AI.
Regras:
- Sempre responda no idioma: ${lang}.
- Use estrutura clara com marcações entre colchetes: [Intro], [Verso 1], [Pré-Refrão], [Refrão], [Verso 2], [Ponte], [Refrão Final], [Outro].
- Rimas naturais, métrica cantável, gancho forte no refrão.
- NUNCA use asteriscos, markdown ou emojis. Apenas texto puro com quebras de linha.
- Evite clichês forçados. Imagens concretas e emocionais.
- Mantenha cada verso com 6-12 sílabas para fluidez musical.`;

  let user = "";
  if (b.mode === "create") {
    user = `Crie uma letra completa.
Tema: ${b.theme || "(livre)"}
Gênero: ${b.genre || "Pop"}
Humor/Vibe: ${b.mood || "Energético"}
Estrutura desejada: ${b.structure || "Verso-Refrão-Verso-Ponte-Refrão"}
Esquema de rimas: ${b.rhyme || "AABB ou ABAB"}
Observações: ${b.notes || "—"}`;
  } else if (b.mode === "improve") {
    user = `Melhore a letra abaixo mantendo a essência. Corrija métrica, fortaleça o refrão, melhore rimas e imagens.
Observações: ${b.notes || "—"}

LETRA ORIGINAL:
${b.lyrics || ""}`;
  } else {
    user = `Adapte a letra abaixo para o gênero: ${b.targetGenre || "Pop"}.
Mantenha a mensagem central, mas reescreva ritmo, vocabulário e estrutura para combinar com o novo estilo.
Observações: ${b.notes || "—"}

LETRA ORIGINAL:
${b.lyrics || ""}`;
  }
  return { system, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.mode) {
      return new Response(JSON.stringify({ error: "mode é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { system, user } = buildPrompt(body);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lyrics-composer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
