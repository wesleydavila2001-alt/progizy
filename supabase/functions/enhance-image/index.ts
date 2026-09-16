import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status: number = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Corpo da requisição inválido" }, 400);
    }

    const {
      guideImageBase64,
      imageBase64,
      settings,
      mode,
    } = body as {
      guideImageBase64?: unknown;
      imageBase64?: unknown;
      mode?: unknown;
      settings?: Record<string, boolean> | null;
    };

    if (typeof imageBase64 !== "string" || !imageBase64.length) {
      return jsonResponse({ error: "Nenhuma imagem fornecida" }, 400);
    }

    if (guideImageBase64 !== undefined && typeof guideImageBase64 !== "string") {
      return jsonResponse({ error: "Imagem-guia inválida" }, 400);
    }

    if (mode !== undefined && typeof mode !== "string") {
      return jsonResponse({ error: "Modo de processamento inválido" }, 400);
    }

    if (settings !== undefined && settings !== null && typeof settings !== "object") {
      return jsonResponse({ error: "Configurações de melhoria inválidas" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    let prompt: string;

    if (mode === "watermark-removal") {
      prompt = guideImageBase64
        ? `You are repairing a user-provided image crop.

The first image is the original crop.
The second image is the same crop with the exact region to repair painted in solid red.

Reconstruct only the red-painted region so it blends perfectly with the surrounding pixels, texture, lighting, gradients, and perspective.

Keep everything outside the red-painted region unchanged. Do not add, remove, stylize, or reinterpret any other part of the crop.

Return one edited version of the first image.`
        : `Analyze this image carefully and identify any watermark, logo, text overlay, or semi-transparent stamp present. Remove the watermark completely by reconstructing the background beneath it — use the surrounding pixels, textures, patterns, colors, and gradients as reference to fill the area naturally. The reconstruction must be seamless and coherent with the rest of the image. The result must look like the watermark was never there. No blurring, no smudging, no solid color patches, no visible artifacts, no darkened or lightened spots in the area where the watermark was. Keep the entire image content, composition, and subject exactly as they are. Do not alter, add, or remove anything else.`;
    } else {
      const enhancements: string[] = [];
      if (settings?.sharpness) enhancements.push("increase sharpness and clarity");
      if (settings?.denoise) enhancements.push("reduce noise and grain");
      if (settings?.lighting) enhancements.push("improve lighting and exposure");
      if (settings?.contrast) enhancements.push("enhance contrast");
      if (settings?.definition) enhancements.push("boost color vibrancy and definition");
      if (settings?.upscale) enhancements.push("enhance detail as if upscaling resolution");

      const enhancementText = enhancements.length > 0
        ? enhancements.join(", ")
        : "improve overall image quality";

      prompt = `Enhance this image professionally: ${enhancementText}. Keep the original content, composition, and subject exactly the same. Only improve the visual quality. Do not add, remove, or change any objects or elements in the image.`;
    }

    console.log(
      "Sending image to Lovable AI Gateway with mode:",
      mode || "enhance",
      "guide:",
      Boolean(guideImageBase64),
    );

    // Build image content parts for OpenAI-compatible API
    const imageUrl = (imageBase64 as string).startsWith("data:")
      ? (imageBase64 as string)
      : `data:image/png;base64,${imageBase64}`;

    const contentParts: Array<Record<string, unknown>> = [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: imageUrl },
      },
    ];

    if (guideImageBase64) {
      const guideUrl = (guideImageBase64 as string).startsWith("data:")
        ? (guideImageBase64 as string)
        : `data:image/png;base64,${guideImageBase64}`;
      contentParts.push({
        type: "image_url",
        image_url: { url: guideUrl },
      });
    }

    let response: Response | null = null;
    let lastErrorText = "";

    for (const model of IMAGE_MODELS) {
      console.log("Calling Lovable AI Gateway with model:", model);

      response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: contentParts,
            },
          ],
        }),
      });

      if (response.ok) {
        break;
      }

      lastErrorText = await response.text();
      console.error("Lovable AI Gateway error:", response.status, lastErrorText);

      if (response.status === 429) {
        return jsonResponse({
          code: "RATE_LIMITED",
          error: "Limite de requisições excedido. Tente novamente em alguns segundos.",
          retryable: true,
        });
      }

      if (response.status === 402) {
        return jsonResponse({
          code: "INSUFFICIENT_CREDITS",
          error: "Créditos de IA esgotados. Recarregue seu saldo em Configurações > Workspace > Uso.",
          retryable: false,
        });
      }

      // If not a retryable model error, stop
      if (response.status !== 404 && response.status !== 400) {
        return jsonResponse({
          code: "AI_GATEWAY_ERROR",
          error: "Erro ao processar imagem com IA",
          retryable: true,
        });
      }
    }

    if (!response?.ok) {
      return jsonResponse({
        code: "AI_GATEWAY_ERROR",
        error: "Erro ao processar imagem com IA",
        retryable: true,
      });
    }

    const data = await response.json();

    // Extract image from OpenAI-compatible response
    // The image models return base64 image in the message content
    const choice = data.choices?.[0];
    let enhancedImageUrl: string | null = null;

    if (choice?.message?.content) {
      const content = choice.message.content;

      // Content can be a string (base64) or array of parts
      if (typeof content === "string") {
        // Check if it's a data URL or raw base64
        if (content.startsWith("data:image")) {
          enhancedImageUrl = content;
        } else if (content.length > 1000 && !content.includes(" ")) {
          // Likely raw base64
          enhancedImageUrl = `data:image/png;base64,${content}`;
        }
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image_url" && part.image_url?.url) {
            enhancedImageUrl = part.image_url.url;
            break;
          }
          // Also check for inline_data format
          const inlineData = part.inline_data || part.inlineData;
          if (inlineData?.data) {
            const mime = inlineData.mime_type || inlineData.mimeType || "image/png";
            enhancedImageUrl = `data:${mime};base64,${inlineData.data}`;
            break;
          }
        }
      }
    }

    if (!enhancedImageUrl) {
      console.error("No image in AI response:", JSON.stringify(data).slice(0, 500));
      return jsonResponse({
        error: "A IA não retornou uma imagem processada. Tente novamente.",
      });
    }

    return jsonResponse({ enhancedImage: enhancedImageUrl });
  } catch (e) {
    console.error("enhance-image error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
