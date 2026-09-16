import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranscribeRequest {
  videoUrl: string;
  platform?: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  masterProfileId: string;
  fileStoragePath?: string | null;
  recordId?: string | null;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Extract YouTube video ID from various URL formats */
function extractYouTubeId(url: string): string | null {
  const normalized = url.trim();
  const isVideoId = (value: string) => /^[a-zA-Z0-9_-]{11}$/.test(value);

  if (isVideoId(normalized)) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const shortId = parsed.pathname.split("/").filter(Boolean)[0] || "";
      if (isVideoId(shortId)) return shortId;
    }

    if (
      host.endsWith("youtube.com") ||
      host.endsWith("youtube-nocookie.com")
    ) {
      const queryId = parsed.searchParams.get("v") || "";
      if (isVideoId(queryId)) return queryId;

      const segments = parsed.pathname.split("/").filter(Boolean);
      const idx = segments.findIndex((seg) =>
        ["embed", "shorts", "live", "v"].includes(seg.toLowerCase())
      );

      if (idx >= 0) {
        const fromKnownPath = segments[idx + 1] || "";
        if (isVideoId(fromKnownPath)) return fromKnownPath;
      }

      const maybeDirect = segments[0] || "";
      if (isVideoId(maybeDirect)) return maybeDirect;
    }
  } catch {
    // fallback to regex parsing below
  }

  const patterns = [
    /(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = normalized.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Detect platform from URL */
function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("kwai.com") || url.includes("kwatch")) return "Kwai";
  if (url.includes("facebook.com") || url.includes("fb.watch")) return "Facebook";
  if (url.includes("twitter.com") || url.includes("x.com")) return "X/Twitter";
  if (url.includes("vimeo.com")) return "Vimeo";
  return "Outro";
}

const BOT_BLOCK_TEXTS = [
  "youtube is currently block",
  "sign in to confirm you're not a bot",
  "sign in to confirm you’re not a bot",
  "consent.youtube.com",
];

const NETWORK_TIMEOUT_MS = 8000;
const YOUTUBE_PIPELINE_BUDGET_MS = 45000;
// DISABLED: Gemini cannot actually watch YouTube videos via the chat completions API.
// It hallucinates plausible-sounding transcripts that are completely fabricated.
// Real audio extraction + Gemini transcription is the correct fallback.
const ENABLE_GEMINI_YOUTUBE_URL_TRANSCRIPTION = true;

async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getTranscriptIntegrityError(transcript: string): string | null {
  const normalized = transcript.toLowerCase();

  if (BOT_BLOCK_TEXTS.some((snippet) => normalized.includes(snippet))) {
    return "conteúdo de bloqueio do YouTube";
  }

  const words = transcript.split(/\s+/).filter(Boolean);
  if (words.length < 8) {
    return "conteúdo muito curto para ser uma fala real";
  }

  return null;
}

function normalizeExtractedUrl(rawUrl: string): string {
  let decoded = decodeHtmlEntities(rawUrl).trim();

  for (let i = 0; i < 2; i++) {
    decoded = decoded
      // JSON unicode escapes with and without backslash
      .replace(/\\u([0-9a-f]{4})/gi, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/u002f/gi, "/")
      .replace(/u003a/gi, ":")
      .replace(/u0026/gi, "&")
      .replace(/u003d/gi, "=")
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\");
  }

  decoded = decoded
    .replace(/^https:\/\//i, "https://")
    .replace(/^http:\/\//i, "http://")
    .replace(/^"(.+)"$/, "$1")
    .trim();

  if (/^https?%3a/i.test(decoded)) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // keep as-is
    }
  }

  if (!decoded.startsWith("http")) {
    const embeddedMatch = decoded.match(/https?:\/\/[^"'\s<>]+/i)?.[0] || null;
    if (embeddedMatch) {
      decoded = embeddedMatch.replace(/\\\//g, "/");
    }
  }

  if (decoded.startsWith("//")) return `https:${decoded}`;
  return decoded;
}

function resolveYouTubeStreamUrl(format: any): {
  url: string | null;
  requiresDecipher: boolean;
} {
  if (typeof format?.url === "string" && format.url.length > 0) {
    return { url: format.url, requiresDecipher: false };
  }

  const cipher =
    typeof format?.signatureCipher === "string"
      ? format.signatureCipher
      : typeof format?.cipher === "string"
        ? format.cipher
        : null;

  if (!cipher) {
    return { url: null, requiresDecipher: false };
  }

  try {
    const params = new URLSearchParams(cipher);
    const baseUrl = params.get("url");
    if (!baseUrl) return { url: null, requiresDecipher: false };

    const parsed = new URL(normalizeExtractedUrl(baseUrl));
    const sp = params.get("sp") || "signature";
    const sig = params.get("sig") || params.get("signature");
    const encryptedSig = params.get("s");

    if (sig) {
      parsed.searchParams.set(sp, sig);
      return { url: parsed.toString(), requiresDecipher: false };
    }

    if (encryptedSig) {
      // Keep undeciphered URL as a last-resort candidate (some streams still work).
      parsed.searchParams.set("s", encryptedSig);
      return { url: parsed.toString(), requiresDecipher: true };
    }

    return { url: parsed.toString(), requiresDecipher: false };
  } catch {
    return { url: null, requiresDecipher: false };
  }
}

function extractYouTubeUrlFromCipherValue(cipherValue: string): string | null {
  try {
    const preparedCipher = decodeHtmlEntities(cipherValue)
      .replace(/\\u0026/gi, "&")
      .replace(/\\u003d/gi, "=")
      .replace(/\\u003a/gi, ":")
      .replace(/\\u002f/gi, "/")
      .replace(/\\\//g, "/");

    const params = new URLSearchParams(preparedCipher);
    let rawUrl = params.get("url");

    if (!rawUrl) {
      const match = preparedCipher.match(/(?:^|&)url=([^&]+)/);
      rawUrl = match?.[1] || null;
    }

    if (!rawUrl) return null;

    const decodedRaw = (() => {
      try {
        return decodeURIComponent(rawUrl!);
      } catch {
        return rawUrl!;
      }
    })();

    const normalizedBaseUrl = normalizeExtractedUrl(decodedRaw);
    if (!normalizedBaseUrl.startsWith("http")) return null;

    const parsed = new URL(normalizedBaseUrl);
    const sp = params.get("sp") || "signature";
    const sig = params.get("sig") || params.get("signature");
    const encryptedSig = params.get("s");

    if (sig) {
      parsed.searchParams.set(sp, sig);
    }

    if (encryptedSig && !parsed.searchParams.has("s")) {
      parsed.searchParams.set("s", encryptedSig);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function extractGoogleVideoUrlsFromHtml(html: string): string[] {
  const candidates = new Set<string>();

  const directUrlRegexes = [
    /"url":"([^"]*(?:googlevideo|videoplayback)[^"]*)"/gi,
    /(https?:\\\/\\\/[^"<>]*(?:googlevideo|videoplayback)[^"<>]*)/gi,
    /(https?:\/\/[^"<>]*(?:googlevideo|videoplayback)[^"<>]*)/gi,
  ];

  for (const directUrlRegex of directUrlRegexes) {
    let directMatch: RegExpExecArray | null;
    while ((directMatch = directUrlRegex.exec(html)) !== null) {
      const normalized = normalizeExtractedUrl(directMatch[1]);
      if (normalized.startsWith("http")) {
        candidates.add(normalized);
      }
    }
  }

  const cipherRegexes = [
    /"(?:signatureCipher|cipher)":"([^"]+)"/gi,
    /(?:signatureCipher|cipher)\\":\\\"([^\"]+)\\\"/gi,
  ];

  for (const cipherRegex of cipherRegexes) {
    let cipherMatch: RegExpExecArray | null;
    while ((cipherMatch = cipherRegex.exec(html)) !== null) {
      const decodedCipher = decodeHtmlEntities(cipherMatch[1]);
      const fromCipher = extractYouTubeUrlFromCipherValue(decodedCipher);
      if (fromCipher && fromCipher.includes("googlevideo")) {
        candidates.add(fromCipher);
      }
    }
  }

  return [...candidates];
}

function findNestedCaptionArray(node: any, depth = 0): any[] | null {
  if (!node || depth > 8) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNestedCaptionArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key.toLowerCase() === "subtitleinfos" && Array.isArray(value)) {
        return value;
      }
    }

    for (const value of Object.values(node)) {
      const found = findNestedCaptionArray(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function extractInstagramCode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function pickTrackByPreferredLanguage<T extends { languageCode?: string | null }>(
  tracks: T[],
  preferredLang?: string | null
): T | null {
  if (tracks.length === 0) return null;
  const preferredPrefix = preferredLang?.toLowerCase().slice(0, 2);

  if (preferredPrefix) {
    const exact = tracks.find((track) =>
      track.languageCode?.toLowerCase().startsWith(preferredPrefix)
    );
    if (exact) return exact;
  }

  return tracks[0] ?? null;
}

const YOUTUBE_REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
  Cookie: "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+987",
};

type TimedtextTrack = {
  langCode: string;
  languageCode: string;
  languageName: string;
  kind: string | null;
  isAsr: boolean;
};

function parseXmlAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([\w:-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(input)) !== null) {
    attrs[match[1]] = decodeHtmlEntities(match[2]);
  }

  return attrs;
}

function parseTimedtextTrackList(xml: string): TimedtextTrack[] {
  const tracks: TimedtextTrack[] = [];
  const trackRegex = /<track\b([^>]*)\/?>(?:<\/track>)?/gi;
  let match: RegExpExecArray | null;

  while ((match = trackRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    const langCode = attrs.lang_code || "";
    if (!langCode) continue;

    const kind = attrs.kind || null;
    const rawName = attrs.name || attrs.lang_original || attrs.lang_translated || langCode;
    const isAsr =
      kind === "asr" ||
      /auto[-\s]?generated|gerad[ao] automaticamente/i.test(rawName);

    tracks.push({
      langCode,
      languageCode: langCode,
      languageName: rawName,
      kind,
      isAsr,
    });
  }

  return tracks;
}

async function fetchYouTubeCaptionsViaTimedtext(
  videoId: string,
  preferredLang?: string | null
): Promise<{ transcript: string; language: string } | null> {
  const fnDeadline = Date.now() + 12000;
  const trackListEndpoints = [
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}&hl=en`,
    `https://m.youtube.com/api/timedtext?type=list&v=${videoId}`,
  ];

  let tracks: TimedtextTrack[] = [];

  for (const endpoint of trackListEndpoints) {
    if (Date.now() > fnDeadline) break;
    try {
      const listResp = await fetchWithTimeout(
        endpoint,
        { headers: YOUTUBE_REQUEST_HEADERS },
        3500
      );

      if (!listResp.ok) {
        console.log(`[timedtext] track list failed status=${listResp.status}`);
        continue;
      }

      const xml = await listResp.text();
      const parsedTracks = parseTimedtextTrackList(xml);
      if (parsedTracks.length > 0) {
        tracks = parsedTracks;
        console.log(`[timedtext] found ${tracks.length} tracks`);
        break;
      }
    } catch (err) {
      console.log(`[timedtext] track list error: ${err}`);
    }
  }

  if (tracks.length === 0) {
    console.log("[timedtext] no tracks found");
    return null;
  }

  const manualTracks = tracks.filter((track) => !track.isAsr);
  const pool = manualTracks.length > 0 ? manualTracks : tracks;
  const selectedTrack = pickTrackByPreferredLanguage(pool, preferredLang);
  if (!selectedTrack) return null;

  const baseParams = new URLSearchParams({
    v: videoId,
    lang: selectedTrack.langCode,
  });
  if (selectedTrack.kind) baseParams.set("kind", selectedTrack.kind);

  const captionEndpoints = [
    `https://www.youtube.com/api/timedtext?${baseParams.toString()}&fmt=json3`,
    `https://www.youtube.com/api/timedtext?${baseParams.toString()}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?${baseParams.toString()}`,
  ];

  for (const endpoint of captionEndpoints) {
    if (Date.now() > fnDeadline) break;
    try {
      const captionResp = await fetchWithTimeout(
        endpoint,
        { headers: YOUTUBE_REQUEST_HEADERS },
        3500
      );
      if (!captionResp.ok) {
        console.log(`[timedtext] caption fetch failed status=${captionResp.status}`);
        continue;
      }

      const payload = await captionResp.text();
      const textSegments = extractTextSegmentsFromCaptionPayload(payload);
      if (textSegments.length === 0) continue;

      const transcript = normalizeTranscript(textSegments.join(" "));
      const integrityError = getTranscriptIntegrityError(transcript);
      if (integrityError) {
        console.log(`[timedtext] rejected transcript: ${integrityError}`);
        continue;
      }

      return {
        transcript,
        language: selectedTrack.languageName || selectedTrack.langCode,
      };
    } catch (err) {
      console.log(`[timedtext] caption error: ${err}`);
    }
  }

  return null;
}

function extractCaptionUrlCandidatesFromHtml(html: string): string[] {
  const candidates = new Set<string>();

  const regexes = [
    /"video_subtitles_uri":"([^"]+)"/g,
    /video_subtitles_uri\\":\\"([^\"]+)\\"/g,
    /<track[^>]+src="([^"]+)"/gi,
    /(https?:\\\/\\\/[^"'\s<>]+(?:\.vtt|\.srt)[^"'\s<>]*)/gi,
    /(https?:\/\/[^"'\s<>]+(?:\.vtt|\.srt)[^"'\s<>]*)/gi,
    /(https?:\\\/\\\/[^"'\s<>]*(?:subtitle|captions)[^"'\s<>]*)/gi,
    /(https?:\/\/[^"'\s<>]*(?:subtitle|captions)[^"'\s<>]*)/gi,
  ];

  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1] || match[0];
      const normalized = normalizeExtractedUrl(raw);
      if (!normalized) continue;

      if (normalized.startsWith("/")) {
        candidates.add(`https://www.instagram.com${normalized}`);
      } else {
        candidates.add(normalized);
      }
    }
  }

  return [...candidates];
}

function extractTextFromUnknownJson(value: any, output: string[]) {
  if (!value) return;

  if (typeof value === "string") {
    const cleaned = normalizeTranscript(decodeHtmlEntities(value));
    if (cleaned.length > 0) output.push(cleaned);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) extractTextFromUnknownJson(item, output);
    return;
  }

  if (typeof value === "object") {
    const maybeText =
      value.text ||
      value.utterance ||
      value.content ||
      value.caption ||
      value.sentence ||
      value.transcript;

    if (typeof maybeText === "string") {
      const cleaned = normalizeTranscript(decodeHtmlEntities(maybeText));
      if (cleaned.length > 0) output.push(cleaned);
    }

    for (const nested of Object.values(value)) {
      extractTextFromUnknownJson(nested, output);
    }
  }
}

function extractTextSegmentsFromJsonCaptionPayload(captionPayload: string): string[] {
  try {
    const parsed = JSON.parse(captionPayload);
    
    // YouTube json3 format: { events: [{ segs: [{ utf8: "text" }] }] }
    if (parsed.events && Array.isArray(parsed.events)) {
      const segments: string[] = [];
      for (const event of parsed.events) {
        if (!event.segs) continue;
        const eventText = event.segs
          .map((seg: any) => seg.utf8 || "")
          .join("")
          .trim();
        if (eventText && eventText !== "\n") {
          segments.push(normalizeTranscript(decodeHtmlEntities(eventText)));
        }
      }
      if (segments.length > 0) return segments.filter(s => s.length > 0);
    }
    
    // Generic fallback for other JSON formats
    const output: string[] = [];
    extractTextFromUnknownJson(parsed, output);
    return output;
  } catch {
    return [];
  }
}

function extractBalancedJsonFromIndex(
  html: string,
  startIdx: number,
  maxScanChars = 2500000
): string | null {
  if (startIdx < 0 || startIdx >= html.length || html[startIdx] !== "{") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(html.length, startIdx + maxScanChars);

  for (let i = startIdx; i < limit; i++) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return html.substring(startIdx, i + 1);
      }
    }
  }

  return null;
}

function getPlayerResponseScore(playerResponse: any): number {
  const captionTracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
    [];
  const adaptiveFormats = playerResponse?.streamingData?.adaptiveFormats || [];
  const formats = playerResponse?.streamingData?.formats || [];
  const hasPlayableStatus =
    playerResponse?.playabilityStatus?.status === "OK" ? 1 : 0;

  let score = 0;
  if (captionTracks.length > 0) score += 100;
  if (adaptiveFormats.length + formats.length > 0) score += 50;
  score += Math.min(captionTracks.length, 10) * 2;
  score += Math.min(adaptiveFormats.length + formats.length, 30);
  score += hasPlayableStatus;

  return score;
}

function parsePlayerResponseFromHtml(html: string): any | null {
  const candidates: any[] = [];
  const markerPatterns = [
    "var ytInitialPlayerResponse =",
    "ytInitialPlayerResponse =",
    'window["ytInitialPlayerResponse"] =',
    "window['ytInitialPlayerResponse'] =",
  ];

  for (const marker of markerPatterns) {
    let fromIndex = 0;
    while (fromIndex < html.length) {
      const markerIdx = html.indexOf(marker, fromIndex);
      if (markerIdx === -1) break;

      const jsonStart = html.indexOf("{", markerIdx + marker.length);
      if (jsonStart !== -1) {
        const rawJson = extractBalancedJsonFromIndex(html, jsonStart);
        if (rawJson) {
          try {
            const parsed = JSON.parse(rawJson);
            candidates.push(parsed);
          } catch {
            // ignore invalid candidate
          }
        }
      }

      fromIndex = markerIdx + marker.length;
    }
  }

  const embeddedStringMatch = html.match(/"playerResponse":"(\{.+?\})"/s);
  if (embeddedStringMatch) {
    try {
      const wrapped = JSON.parse(
        `{"playerResponse":"${embeddedStringMatch[1]}"}`
      );
      const parsedEmbedded = JSON.parse(wrapped.playerResponse);
      candidates.push(parsedEmbedded);
    } catch {
      // ignore embedded fallback parsing errors
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (a, b) => getPlayerResponseScore(b) - getPlayerResponseScore(a)
  )[0];
}

function pickBestCaptionTrack(captionTracks: any[], preferredLang?: string | null) {
  const tracks = captionTracks.filter((track) => Boolean(track?.baseUrl));
  if (tracks.length === 0) return null;

  const nonTranslatedTracks = tracks.filter(
    (track) => !/([?&])tlang=/.test(track.baseUrl || "")
  );
  const pool = nonTranslatedTracks.length > 0 ? nonTranslatedTracks : tracks;

  const preferredPrefix = preferredLang?.toLowerCase().slice(0, 2);
  if (preferredPrefix) {
    const preferredManual = pool.find(
      (track) =>
        track.kind !== "asr" &&
        track.languageCode?.toLowerCase().startsWith(preferredPrefix)
    );
    if (preferredManual) return preferredManual;

    const preferredAny = pool.find((track) =>
      track.languageCode?.toLowerCase().startsWith(preferredPrefix)
    );
    if (preferredAny) return preferredAny;
  }

  const manualAny = pool.find((track) => track.kind !== "asr");
  if (manualAny) return manualAny;

  return pool[0] ?? null;
}

function extractTextSegmentsFromCaptionPayload(captionPayload: string): string[] {
  const segments: string[] = [];

  const jsonSegments = extractTextSegmentsFromJsonCaptionPayload(captionPayload);
  if (jsonSegments.length > 0) return jsonSegments;

  const xmlTextRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let xmlMatch: RegExpExecArray | null;
  while ((xmlMatch = xmlTextRegex.exec(captionPayload)) !== null) {
    const cleaned = normalizeTranscript(decodeHtmlEntities(xmlMatch[1]));
    if (cleaned) segments.push(cleaned);
  }

  if (segments.length > 0) return segments;

  const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let pTagMatch: RegExpExecArray | null;
  while ((pTagMatch = pTagRegex.exec(captionPayload)) !== null) {
    const stripped = pTagMatch[1].replace(/<[^>]+>/g, " ");
    const cleaned = normalizeTranscript(decodeHtmlEntities(stripped));
    if (cleaned) segments.push(cleaned);
  }

  if (segments.length > 0) return segments;

  if (captionPayload.includes("-->")) {
    const lines = captionPayload
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !line.includes("-->") &&
          !/^\d+$/.test(line) &&
          line !== "WEBVTT"
      );

    return lines.map((line) => normalizeTranscript(decodeHtmlEntities(line)));
  }

  return segments;
}

/** Extract TikTok video ID from URL */
function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

/** Try fetching TikTok page with multiple user agents */
async function fetchTikTokPage(videoUrl: string): Promise<string | null> {
  const userAgents = [
    // Mobile user agent (less likely to be blocked)
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    // Desktop Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Googlebot (sometimes works)
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ];

  for (const ua of userAgents) {
    try {
      console.log(`[tiktok-fetch] trying UA: ${ua.slice(0, 30)}...`);
      const resp = await fetch(videoUrl, {
        headers: {
          "User-Agent": ua,
          "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });
      if (!resp.ok) {
        console.log(`[tiktok-fetch] status=${resp.status}`);
        continue;
      }
      const html = await resp.text();
      
      // Check if we got useful data
      if (html.includes("__UNIVERSAL_DATA_FOR_REHYDRATION__") || html.includes("SIGI_STATE")) {
        console.log("[tiktok-fetch] got page with data");
        return html;
      }
      
      // Try to extract video data from any JSON blob
      if (html.includes('"video"') && html.includes('"playAddr"')) {
        console.log("[tiktok-fetch] got page with video data (alternative format)");
        return html;
      }
      
      console.log(`[tiktok-fetch] page has no video data (length=${html.length})`);
    } catch (err) {
      console.log(`[tiktok-fetch] error: ${err}`);
    }
  }
  return null;
}

/** Parse TikTok video data from HTML */
function parseTikTokVideoData(html: string): any | null {
  // Method 1: __UNIVERSAL_DATA_FOR_REHYDRATION__
  const universalMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (universalMatch?.[1]) {
    try {
      return JSON.parse(universalMatch[1]);
    } catch {}
  }

  // Method 2: SIGI_STATE
  const sigiMatch = html.match(
    /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (sigiMatch?.[1]) {
    try {
      return JSON.parse(sigiMatch[1]);
    } catch {}
  }

  // Method 3: window.__data or similar
  const dataMatch = html.match(/window\['SIGI_STATE'\]\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
  if (dataMatch?.[1]) {
    try {
      return JSON.parse(dataMatch[1]);
    } catch {}
  }

  return null;
}

async function fetchTikTokCaptions(
  videoUrl: string,
  preferredLang?: string | null
): Promise<{ transcript: string; language: string } | null> {
  try {
    console.log(`[captions][tiktok] trying URL ${videoUrl}`);
    const html = await fetchTikTokPage(videoUrl);
    if (!html) {
      console.log("[captions][tiktok] could not fetch page");
      return null;
    }

    const parsed = parseTikTokVideoData(html);
    if (!parsed) {
      console.log("[captions][tiktok] no video data found in page");
      return null;
    }

    const nestedSubtitleInfos = findNestedCaptionArray(parsed) || [];
    if (nestedSubtitleInfos.length === 0) {
      console.log("[captions][tiktok] no subtitleInfos found");
      return null;
    }

    const tracks = nestedSubtitleInfos
      .map((track: any) => {
        const rawUrl =
          track?.Url ||
          track?.url ||
          track?.baseUrl ||
          track?.subtitleUrl ||
          track?.captionUrl ||
          null;
        return {
          url: rawUrl ? normalizeExtractedUrl(String(rawUrl)) : null,
          languageCode:
            track?.LanguageID ||
            track?.languageCode ||
            track?.Locale ||
            track?.lang ||
            null,
          languageName:
            track?.LanguageCodeName ||
            track?.languageName ||
            track?.Name ||
            null,
        };
      })
      .filter((track: any) => Boolean(track.url));

    if (tracks.length === 0) {
      console.log("[captions][tiktok] subtitleInfos has no valid URLs");
      return null;
    }

    const selectedTrack = pickTrackByPreferredLanguage(tracks, preferredLang);
    if (!selectedTrack?.url) {
      console.log("[captions][tiktok] no track selected");
      return null;
    }

    const captionResp = await fetch(selectedTrack.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
        Referer: "https://www.tiktok.com/",
      },
    });

    if (!captionResp.ok) {
      console.log(`[captions][tiktok] caption fetch failed status=${captionResp.status}`);
      return null;
    }

    const captionPayload = await captionResp.text();
    const textSegments = extractTextSegmentsFromCaptionPayload(captionPayload);
    if (textSegments.length === 0) {
      console.log("[captions][tiktok] payload has no readable segments");
      return null;
    }

    const transcript = normalizeTranscript(textSegments.join(" "));
    const integrityError = getTranscriptIntegrityError(transcript);
    if (integrityError) {
      console.log(`[captions][tiktok] rejected transcript: ${integrityError}`);
      return null;
    }

    const language =
      selectedTrack.languageName || selectedTrack.languageCode || "Auto";

    console.log(
      `[captions][tiktok] extracted segments=${textSegments.length} language=${language}`
    );

    return { transcript, language };
  } catch (err) {
    console.error("Error fetching TikTok captions:", err);
    return null;
  }
}

/** Try downloading TikTok video via tikwm.com API (reliable third-party) */
async function downloadTikTokViaTikwm(videoUrl: string): Promise<{ base64: string; format: string } | null> {
  try {
    console.log("[tikwm] trying tikwm.com API");
    const resp = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(videoUrl)}&hd=1`,
    });

    if (!resp.ok) {
      console.log(`[tikwm] API failed status=${resp.status}`);
      return null;
    }

    const data = await resp.json();
    if (data?.code !== 0 || !data?.data) {
      console.log(`[tikwm] API returned error code=${data?.code} msg=${data?.msg}`);
      return null;
    }

    // Prefer no-watermark play URL, fallback to hdplay, then play
    const downloadUrl = data.data.play || data.data.hdplay || data.data.wmplay;
    if (!downloadUrl) {
      console.log("[tikwm] no download URL in response");
      return null;
    }

    console.log(`[tikwm] got download URL, downloading video...`);
    const videoResp = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.tikwm.com/",
      },
    });

    if (!videoResp.ok) {
      console.log(`[tikwm] video download failed status=${videoResp.status}`);
      return null;
    }

    const buffer = await videoResp.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) {
      console.log(`[tikwm] file too large: ${buffer.byteLength} bytes`);
      return null;
    }

    const uint8 = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 32768;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    console.log(`[tikwm] download success size=${buffer.byteLength}`);
    return { base64, format: "mp4" };
  } catch (err) {
    console.error("[tikwm] error:", err);
    return null;
  }
}

/** Extract direct video URL from TikTok for audio download */
async function extractTikTokVideoUrl(videoUrl: string): Promise<string | null> {
  try {
    // Method 1: Try fetching page with multiple UAs
    const html = await fetchTikTokPage(videoUrl);
    if (html) {
      const parsed = parseTikTokVideoData(html);
      if (parsed) {
        // Try various paths where video URL might be
        const paths = [
          parsed?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.video,
          parsed?.ItemModule && Object.values(parsed.ItemModule)?.[0]?.video,
        ];
        
        for (const video of paths) {
          if (!video) continue;
          if (video.playAddr) return video.playAddr;
          if (video.downloadAddr) return video.downloadAddr;
          const bitrateInfo = video.bitrateInfo || [];
          for (const bi of bitrateInfo) {
            const urls = bi?.PlayAddr?.UrlList || [];
            if (urls.length > 0) return urls[0];
          }
        }
      }

      // Try regex fallback for video URL in HTML
      const videoUrlMatch = html.match(/"playAddr":"([^"]+)"/);
      if (videoUrlMatch?.[1]) {
        return normalizeExtractedUrl(videoUrlMatch[1]);
      }
      const downloadMatch = html.match(/"downloadAddr":"([^"]+)"/);
      if (downloadMatch?.[1]) {
        return normalizeExtractedUrl(downloadMatch[1]);
      }
    }

    // Method 2: Try TikTok oembed API to get thumbnail, then try direct video
    const videoId = extractTikTokVideoId(videoUrl);
    if (videoId) {
      console.log(`[tiktok-video] trying oembed for video ${videoId}`);
      const oembedResp = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          },
        }
      );
      if (oembedResp.ok) {
        const oembed = await oembedResp.json();
        console.log(`[tiktok-video] oembed title: ${oembed.title?.slice(0, 50)}`);
      }
    }

    console.log("[tiktok-video] no video URL found");
    return null;
  } catch {
    return null;
  }
}

/** Try to extract direct URLs from streaming data */
function findDirectUrlFromStreamingData(streaming: any): string | null {
  if (!streaming) return null;

  const allFormatsRaw = [
    ...(streaming.adaptiveFormats || []),
    ...(streaming.formats || []),
  ];

  const allFormats = allFormatsRaw.map((format: any) => {
    const resolved = resolveYouTubeStreamUrl(format);
    return {
      ...format,
      resolvedUrl: resolved.url,
      requiresDecipher: resolved.requiresDecipher,
    };
  });

  const decipherCount = allFormats.filter((f: any) => f.requiresDecipher).length;
  if (decipherCount > 0) {
    console.log(`[yt-audio] ${decipherCount} streams require signature decipher`);
  }

  // Prefer audio-only with direct URL that does not require decipher
  const audioWithUrl = allFormats.find(
    (f: any) =>
      f.resolvedUrl &&
      !f.requiresDecipher &&
      typeof f.mimeType === "string" &&
      f.mimeType.startsWith("audio/")
  );
  if (audioWithUrl?.resolvedUrl) {
    console.log("[yt-audio] found direct audio URL");
    return audioWithUrl.resolvedUrl;
  }

  // Fallback to combined video+audio with direct URL (smallest), no decipher
  const combinedWithUrl = allFormats
    .filter(
      (f: any) =>
        f.resolvedUrl &&
        !f.requiresDecipher &&
        typeof f.mimeType === "string" &&
        f.mimeType.includes("mp4")
    )
    .sort(
      (a: any, b: any) =>
        (parseInt(a.contentLength || "999999999", 10)) -
        (parseInt(b.contentLength || "999999999", 10))
    );

  if (combinedWithUrl.length > 0 && combinedWithUrl[0].resolvedUrl) {
    console.log("[yt-audio] found direct combined URL");
    return combinedWithUrl[0].resolvedUrl;
  }

  const anyMediaWithUrl = allFormats.find(
    (f: any) => Boolean(f.resolvedUrl) && !f.requiresDecipher
  );
  if (anyMediaWithUrl?.resolvedUrl) {
    console.log("[yt-audio] found fallback media URL");
    return anyMediaWithUrl.resolvedUrl;
  }

  const undecipheredCandidate = allFormats.find(
    (f: any) =>
      Boolean(f.resolvedUrl) &&
      f.requiresDecipher &&
      /[?&]itag=(140|249|250|251|18)\b/.test(f.resolvedUrl)
  );
  if (undecipheredCandidate?.resolvedUrl) {
    console.log("[yt-audio] using undeciphered stream URL as last resort");
    return undecipheredCandidate.resolvedUrl;
  }

  return null;
}

/** Fetch YouTube captions via Invidious-like public instances (fallback when YouTube blocks edge IPs) */
async function fetchYouTubeCaptionsViaInstances(
  videoId: string,
  preferredLang?: string | null
): Promise<{ transcript: string; language: string } | null> {
  const fnDeadline = Date.now() + 12000;
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.protokolla.fi",
  ];

  for (const base of instances) {
    if (Date.now() > fnDeadline) break;
    try {
      console.log(`[yt-instance] trying ${base}`);
      const listResp = await fetchWithTimeout(`${base}/api/v1/captions/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      }, 3500);
      if (!listResp.ok) {
        console.log(`[yt-instance] ${base} list status=${listResp.status}`);
        continue;
      }

      const listData = await listResp.json();
      const captions = listData?.captions || [];
      if (!Array.isArray(captions) || captions.length === 0) {
        console.log(`[yt-instance] ${base} no captions`);
        continue;
      }

      const normalized = captions
        .map((c: any) => ({
          url: c?.url ? `${base}${c.url}` : null,
          languageCode: c?.languageCode || null,
          languageName: c?.label || c?.name || null,
        }))
        .filter((c: any) => Boolean(c.url));

      const selectedTrack = pickTrackByPreferredLanguage(normalized, preferredLang);
      if (!selectedTrack?.url) continue;

      const captionResp = await fetchWithTimeout(selectedTrack.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      }, 3500);
      if (!captionResp.ok) {
        console.log(`[yt-instance] ${base} caption status=${captionResp.status}`);
        continue;
      }

      const captionPayload = await captionResp.text();
      const textSegments = extractTextSegmentsFromCaptionPayload(captionPayload);
      if (textSegments.length === 0) continue;

      const transcript = normalizeTranscript(textSegments.join(" "));
      const integrityError = getTranscriptIntegrityError(transcript);
      if (integrityError) continue;

      const language =
        selectedTrack.languageName || selectedTrack.languageCode || "Auto";
      console.log(`[yt-instance] ${base} SUCCESS segments=${textSegments.length}`);
      return { transcript, language };
    } catch (err) {
      console.log(`[yt-instance] ${base} error: ${err}`);
    }
  }

  return null;
}

/** Try multiple innertube clients to get captions that WEB client misses */
async function fetchYouTubeCaptionsMultiClient(
  videoId: string,
  preferredLang?: string | null
): Promise<{ transcript: string; language: string } | null> {
  const fnDeadline = Date.now() + 15000;
  const clients = [
    {
      name: "TV_EMBEDDED",
      payload: {
        context: {
          client: {
            clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            clientVersion: "2.0",
            hl: "en",
            gl: "US",
          },
          thirdParty: { embedUrl: "https://www.google.com" },
        },
        videoId,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    },
    {
      name: "ANDROID",
      payload: {
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
      },
    },
    {
      name: "IOS",
      payload: {
        context: {
          client: {
            clientName: "IOS",
            clientVersion: "19.09.3",
            deviceModel: "iPhone14,3",
            hl: "en",
            gl: "US",
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
      },
    },
    {
      name: "MWEB",
      payload: {
        context: {
          client: {
            clientName: "MWEB",
            clientVersion: "2.20240101.00.00",
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      },
    },
  ];

  for (const client of clients) {
    if (Date.now() > fnDeadline) break;
    try {
      console.log(`[yt-multiclient] trying ${client.name} for captions`);
      const resp = await fetchWithTimeout(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: client.headers,
          body: JSON.stringify(client.payload),
        },
        4000
      );

      if (!resp.ok) {
        console.log(`[yt-multiclient] ${client.name} status=${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const captionTracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      
      if (captionTracks.length === 0) {
        console.log(`[yt-multiclient] ${client.name} no caption tracks`);
        continue;
      }

      const selectedTrack = pickBestCaptionTrack(captionTracks, preferredLang);
      if (!selectedTrack?.baseUrl) continue;

      const captionUrl = selectedTrack.baseUrl.includes("fmt=")
        ? selectedTrack.baseUrl
        : `${selectedTrack.baseUrl}${selectedTrack.baseUrl.includes("?") ? "&" : "?"}fmt=srv3`;

      const captionResp = await fetchWithTimeout(captionUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      }, 4000);
      if (!captionResp.ok) continue;

      const captionPayload = await captionResp.text();
      const textSegments = extractTextSegmentsFromCaptionPayload(captionPayload);
      if (textSegments.length === 0) continue;

      const transcript = normalizeTranscript(textSegments.join(" "));
      const integrityError = getTranscriptIntegrityError(transcript);
      if (integrityError) continue;

      const language =
        selectedTrack.name?.simpleText || selectedTrack.languageCode || "Auto";
      console.log(`[yt-multiclient] ${client.name} SUCCESS segments=${textSegments.length}`);
      return { transcript, language };
    } catch (err) {
      console.log(`[yt-multiclient] ${client.name} error: ${err}`);
    }
  }

  return null;
}

/** Extract direct video/audio URL from YouTube using multiple innertube clients */
async function extractYouTubeVideoUrl(videoId: string): Promise<string | null> {
  const fnDeadline = Date.now() + 12000;
  const clients = [
    {
      name: "TV_EMBEDDED",
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      payload: {
        context: {
          client: {
            clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            clientVersion: "2.0",
            hl: "en",
            gl: "US",
          },
          thirdParty: { embedUrl: "https://www.google.com" },
        },
        videoId,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    },
    {
      name: "ANDROID",
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
      payload: {
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
      },
    },
    {
      name: "IOS",
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key=AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
      payload: {
        context: {
          client: {
            clientName: "IOS",
            clientVersion: "19.09.3",
            deviceModel: "iPhone14,3",
            hl: "en",
            gl: "US",
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
      },
    },
    {
      name: "MEDIA_CONNECT",
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      payload: {
        context: {
          client: {
            clientName: "MEDIA_CONNECT_FRONTEND",
            clientVersion: "0.1",
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    },
  ];

  for (const client of clients) {
    if (Date.now() > fnDeadline) break;
    try {
      console.log(`[yt-audio] trying ${client.name} client`);
      const resp = await fetchWithTimeout(client.url, {
        method: "POST",
        headers: client.headers,
        body: JSON.stringify(client.payload),
      }, 4000);

      if (!resp.ok) {
        console.log(`[yt-audio] ${client.name} failed status=${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const url = findDirectUrlFromStreamingData(data?.streamingData);
      if (url) {
        console.log(`[yt-audio] got URL from ${client.name}`);
        return url;
      }
      console.log(`[yt-audio] ${client.name} had no direct URLs`);
    } catch (err) {
      console.log(`[yt-audio] ${client.name} error: ${err}`);
    }
  }

  // Last resort: page scrape variants
  try {
    const pagesToTry = [
      {
        label: "WEB",
        url: `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`,
      },
      { label: "MWEB", url: `https://m.youtube.com/watch?v=${videoId}` },
      { label: "EMBED", url: `https://www.youtube.com/embed/${videoId}` },
    ];

    for (const page of pagesToTry) {
      console.log(`[yt-audio] trying ${page.label} page scrape`);
      const pageResp = await fetchWithTimeout(page.url, {
        headers: YOUTUBE_REQUEST_HEADERS,
      }, 4000);
      if (!pageResp.ok) {
        console.log(`[yt-audio] ${page.label} page status=${pageResp.status}`);
        continue;
      }

      const html = await pageResp.text();
      const playerResponse = parsePlayerResponseFromHtml(html);
      if (playerResponse?.streamingData) {
        const url = findDirectUrlFromStreamingData(playerResponse.streamingData);
        if (url) {
          console.log(`[yt-audio] got URL from ${page.label} player response`);
          return url;
        }
      }

      const regexUrls = extractGoogleVideoUrlsFromHtml(html);
      const preferredRegexUrl =
        regexUrls.find((url) => /[?&](mime|clen|itag)=/i.test(url) && /[?&]itag=(140|249|250|251|18)\b/.test(url)) ||
        regexUrls.find((url) => /[?&]itag=(140|249|250|251|18)\b/.test(url)) ||
        regexUrls[0] ||
        null;

      if (preferredRegexUrl) {
        console.log(`[yt-audio] got URL from ${page.label} regex extraction`);
        return preferredRegexUrl;
      }
    }
  } catch {}

  console.log("[yt-audio] no direct URLs available from any method");
  return null;
}
/** Extract video URL from Instagram page */
async function extractInstagramVideoUrl(videoUrl: string): Promise<string | null> {
  const requestHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const code = extractInstagramCode(videoUrl);
    const urlsToTry = [videoUrl];
    if (code) {
      urlsToTry.push(
        `https://www.instagram.com/reel/${code}/`,
        `https://www.instagram.com/p/${code}/`
      );
    }

    for (const url of urlsToTry) {
      const resp = await fetch(url, { headers: requestHeaders });
      if (!resp.ok) continue;

      const html = await resp.text();

      // Try og:video meta tag
      const ogMatch = html.match(
        /<meta[^>]+property="og:video"[^>]+content="([^"]+)"/
      );
      if (ogMatch?.[1]) {
        const decoded = normalizeExtractedUrl(ogMatch[1]);
        if (decoded.startsWith("http")) {
          console.log("[ig-video] found og:video URL");
          return decoded;
        }
      }

      // Try video_url in JSON
      const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
      if (videoUrlMatch?.[1]) {
        const decoded = normalizeExtractedUrl(videoUrlMatch[1]);
        if (decoded.startsWith("http")) {
          console.log("[ig-video] found video_url in JSON");
          return decoded;
        }
      }

      // Try contentUrl
      const contentMatch = html.match(/"contentUrl":"([^"]+)"/);
      if (contentMatch?.[1]) {
        const decoded = normalizeExtractedUrl(contentMatch[1]);
        if (decoded.startsWith("http")) {
          console.log("[ig-video] found contentUrl");
          return decoded;
        }
      }
    }

    console.log("[ig-video] no video URL found");
    return null;
  } catch (err) {
    console.error("[ig-video] error:", err);
    return null;
  }
}

/** Download video/audio from URL and return as base64 */
async function downloadVideoAsBase64(
  videoDirectUrl: string,
  referer: string
): Promise<{ base64: string; format: string } | null> {
  try {
    const resp = await fetchWithTimeout(videoDirectUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
      },
    }, 10000);

    if (!resp.ok) {
      console.log(`[audio-download] failed status=${resp.status}`);
      return null;
    }

    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/json") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl")
    ) {
      console.log(`[audio-download] invalid content-type=${contentType}`);
      return null;
    }

    const contentLength = parseInt(resp.headers.get("content-length") || "0", 10);
    if (contentLength > 20 * 1024 * 1024) {
      console.log(`[audio-download] content-length too large: ${contentLength} bytes`);
      return null;
    }

    const buffer = await resp.arrayBuffer();

    // Limit to 20MB to avoid memory issues
    if (buffer.byteLength > 20 * 1024 * 1024) {
      console.log(`[audio-download] file too large: ${buffer.byteLength} bytes`);
      return null;
    }

    if (buffer.byteLength < 1000) {
      console.log(`[audio-download] file too small: ${buffer.byteLength} bytes`);
      return null;
    }

    const uint8 = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 32768;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const format = contentType.includes("mp4")
      ? "mp4"
      : contentType.includes("mp3")
        ? "mp3"
        : contentType.includes("webm")
          ? "webm"
          : "mp4";

    console.log(
      `[audio-download] success size=${buffer.byteLength} format=${format}`
    );

    return { base64, format };
  } catch (err) {
    console.error("[audio-download] error:", err);
    return null;
  }
}

/** Map file extension to proper MIME type for Google Generative AI */
function getAudioMimeType(format: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    aac: "audio/aac",
    flac: "audio/flac",
    mpeg: "audio/mpeg",
    mpga: "audio/mpeg",
  };
  return map[format.toLowerCase()] || "audio/mp4";
}

/** Transcribe audio using Google Generative AI API directly */
async function transcribeAudioWithGemini(
  audioBase64: string,
  audioFormat: string
): Promise<string | null> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  
  if (!GOOGLE_API_KEY) {
    console.log("[gemini-native] no GOOGLE_API_KEY");
    return null;
  }

  const mimeType = getAudioMimeType(audioFormat);
  console.log(`[gemini-native] transcribing audio format=${audioFormat} mime=${mimeType}`);

  try {
    const resp = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Você é um transcritor profissional. Transcreva EXATAMENTE o que é falado neste áudio, palavra por palavra, sem resumir, sem adicionar ou remover nada. Retorne SOMENTE a transcrição literal da fala. Se houver música sem fala, indique [música]. Se não houver fala audível, retorne [sem fala detectada].",
                },
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      },
      30000
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.log(`[gemini-native] API error status=${resp.status} body=${errText.slice(0, 300)}`);
      // Fallback to gateway
      return transcribeWithGeminiGateway(audioBase64, audioFormat);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    if (text && !text.includes("[sem fala detectada]") && text.length > 5) {
      console.log(`[gemini-native] audio transcription success chars=${text.length}`);
      return text;
    }

    console.log("[gemini-native] no usable transcription from audio");
    return null;
  } catch (err) {
    console.error("[gemini-native] audio error:", err);
    return transcribeWithGeminiGateway(audioBase64, audioFormat);
  }
}

/** Fallback: Transcribe audio via Lovable AI gateway (old method) */
async function transcribeWithGeminiGateway(
  audioBase64: string,
  audioFormat: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("[gemini-gateway] no LOVABLE_API_KEY");
    return null;
  }

  try {
    const resp = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você é um transcritor profissional. Transcreva EXATAMENTE o que é falado no áudio, palavra por palavra, sem resumir, sem adicionar ou remover nada. Retorne SOMENTE a transcrição literal da fala. Se houver música sem fala, indique [música]. Se não houver fala audível, retorne [sem fala detectada].",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcreva exatamente o que é dito neste áudio:" },
                { type: "input_audio", input_audio: { data: audioBase64, format: audioFormat } },
              ],
            },
          ],
        }),
      },
      20000
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.log(`[gemini-gateway] API error status=${resp.status} body=${errText.slice(0, 300)}`);
      return null;
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || null;

    if (text && !text.includes("[sem fala detectada]") && text.length > 5) {
      console.log(`[gemini-gateway] success chars=${text.length}`);
      return text;
    }

    console.log("[gemini-gateway] no usable transcription");
    return null;
  } catch (err) {
    console.error("[gemini-gateway] error:", err);
    return null;
  }
}

/** Transcribe a YouTube video by sending its URL directly to Google Generative AI (native YouTube support) */
async function transcribeYouTubeWithGeminiUrl(
  videoId: string
): Promise<string | null> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  if (!GOOGLE_API_KEY) {
    console.log("[gemini-yt-native] no GOOGLE_API_KEY");
    return null;
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[gemini-yt-native] trying native YouTube transcription for ${videoId}`);

  try {
    const resp = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  fileData: {
                    mimeType: "video/*",
                    fileUri: youtubeUrl,
                  },
                },
                {
                  text: "You are an expert audio transcriber. Your ONLY job is to listen to the audio of this video and write down EXACTLY what is spoken, word for word. " +
                    "ABSOLUTE RULES: " +
                    "1) Transcribe ONLY the exact words spoken in the audio. " +
                    "2) DO NOT summarize, paraphrase, interpret, or add any context. " +
                    "3) DO NOT use the video title, description, or thumbnail to generate text. Only the audio matters. " +
                    "4) If you CANNOT access the video or hear the audio, respond EXACTLY with: [ACCESS_DENIED] " +
                    "5) If there is no audible speech, respond EXACTLY with: [NO_SPEECH_DETECTED] " +
                    "6) Preserve the original language of the speech. Do NOT translate. " +
                    "7) Return ONLY the literal transcription. No formatting, no timestamps, no commentary.",
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      },
      120000
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.log(`[gemini-yt-native] API error status=${resp.status} body=${errText.slice(0, 300)}`);
      return null;
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    if (!text || text.length < 10) {
      console.log("[gemini-yt-native] no usable transcription");
      return null;
    }

    // Reject hallucination markers
    const rejectPatterns = [
      "[ACCESS_DENIED]",
      "[ACESSO_NEGADO]",
      "[NO_SPEECH_DETECTED]",
      "[sem fala detectada]",
    ];
    const rejectSubstrings = [
      "não consigo acessar",
      "não é possível acessar",
      "i cannot access",
      "i can't access",
      "unable to access",
      "i don't have access",
      "i do not have access",
      "cannot watch",
      "can't watch",
      "cannot view",
      "can't view",
      "i'm unable to",
      "i am unable to",
    ];

    const lowerText = text.toLowerCase();
    if (rejectPatterns.some(p => text.includes(p))) {
      console.log("[gemini-yt-native] model returned rejection marker");
      return null;
    }
    if (rejectSubstrings.some(s => lowerText.includes(s))) {
      console.log("[gemini-yt-native] model could not access video, rejecting");
      return null;
    }

    console.log(`[gemini-yt-native] success chars=${text.length}`);
    return text;
  } catch (err) {
    console.error("[gemini-yt-native] error:", err);
    return null;
  }
}

async function fetchInstagramCaptions(
  videoUrl: string,
  preferredLang?: string | null
): Promise<{ transcript: string; language: string } | null> {
  const requestHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
  };

  try {
    const code = extractInstagramCode(videoUrl);
    const urlsToTry = [videoUrl];
    if (code) {
      urlsToTry.push(
        `https://www.instagram.com/reel/${code}/`,
        `https://www.instagram.com/reel/${code}/embed/captioned/`,
        `https://www.instagram.com/reel/${code}/embed/`
      );
    }

    for (const url of urlsToTry) {
      console.log(`[captions][instagram] trying page ${url}`);
      const pageResp = await fetch(url, {
        headers: requestHeaders,
      });
      if (!pageResp.ok) continue;

      const html = await pageResp.text();
      const candidates = extractCaptionUrlCandidatesFromHtml(html);
      if (candidates.length === 0) continue;

      const normalizedCandidates = candidates
        .map((candidate) => {
          const languageCodeMatch = candidate.match(
            /(?:[?&](?:lang|locale|language)=)([a-zA-Z-]+)/i
          );
          return {
            url: candidate,
            languageCode: languageCodeMatch?.[1]?.toLowerCase() || null,
          };
        })
        .filter((candidate) => candidate.url.startsWith("http"));

      const preferredTrack = pickTrackByPreferredLanguage(
        normalizedCandidates,
        preferredLang
      );

      const orderedTracks = preferredTrack
        ? [
            preferredTrack,
            ...normalizedCandidates.filter((c) => c.url !== preferredTrack.url),
          ]
        : normalizedCandidates;

      for (const track of orderedTracks) {
        const captionResp = await fetch(track.url, {
          headers: {
            ...requestHeaders,
            Referer: "https://www.instagram.com/",
          },
        });

        if (!captionResp.ok) continue;

        const captionPayload = await captionResp.text();
        const textSegments = extractTextSegmentsFromCaptionPayload(captionPayload);
        if (textSegments.length === 0) continue;

        const transcript = normalizeTranscript(textSegments.join(" "));
        const integrityError = getTranscriptIntegrityError(transcript);
        if (integrityError) continue;

        const language = track.languageCode || "Auto";

        console.log(
          `[captions][instagram] extracted segments=${textSegments.length} language=${language}`
        );

        return { transcript, language };
      }
    }

    console.log("[captions][instagram] no public caption track found");
    return null;
  } catch (err) {
    console.error("Error fetching Instagram captions:", err);
    return null;
  }
}

/** Fetch real YouTube captions/subtitles from the video page */
async function fetchYouTubeCaptions(
  videoId: string,
  preferredLang?: string | null
): Promise<{ transcript: string; language: string } | null> {
  const fnDeadline = Date.now() + 15000;

  try {
    // Method 1: YouTube innertube API (most reliable)
    console.log(`[captions] trying innertube API for ${videoId}`);
    const innertubePayload = {
      context: {
        client: {
          hl: "en",
          gl: "US",
          clientName: "WEB",
          clientVersion: "2.20240101.00.00",
        },
      },
      videoId: videoId,
    };

    const innertubeResp = await fetchWithTimeout(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
            ...YOUTUBE_REQUEST_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(innertubePayload),
      },
      4000
    );

    let playerResponse: any = null;
    if (innertubeResp.ok) {
      playerResponse = await innertubeResp.json();
      console.log(`[captions] innertube response received`);
    } else {
      console.log(`[captions] innertube failed status=${innertubeResp.status}`);
    }

    // Method 2: Fallback to page scraping
    if (!playerResponse?.captions) {
      if (Date.now() > fnDeadline) return null;
      console.log(`[captions] innertube had no captions, trying page scrape`);
      const pageResp = await fetchWithTimeout(
        `https://www.youtube.com/watch?v=${videoId}`,
        { headers: YOUTUBE_REQUEST_HEADERS },
        4000
      );
      if (pageResp.ok) {
        const html = await pageResp.text();
        playerResponse = parsePlayerResponseFromHtml(html);
      }
    }

    if (!playerResponse) {
      console.log(`[captions] no player response from any method`);
      return null;
    }

    const captionTracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
      [];
    if (captionTracks.length === 0) {
      console.log(`[captions] no caption tracks available, trying timedtext list`);
      return await fetchYouTubeCaptionsViaTimedtext(videoId, preferredLang);
    }

    const selectedTrack = pickBestCaptionTrack(captionTracks, preferredLang);
    if (!selectedTrack?.baseUrl) {
      console.log(`[captions] selected track has no baseUrl`);
      return null;
    }

    // Try multiple caption formats: json3 (most parseable), srv3, and raw XML
    const captionFormats = ["json3", "srv3", ""];
    for (const fmt of captionFormats) {
      if (Date.now() > fnDeadline) break;
      const captionUrl = fmt
        ? `${selectedTrack.baseUrl}${selectedTrack.baseUrl.includes("?") ? "&" : "?"}fmt=${fmt}`
        : selectedTrack.baseUrl;

      try {
        const captionResp = await fetchWithTimeout(captionUrl, { headers: YOUTUBE_REQUEST_HEADERS }, 3500);
        if (!captionResp.ok) {
          console.log(`[captions] caption fetch failed fmt=${fmt || "default"} status=${captionResp.status}`);
          continue;
        }

        const captionPayload = await captionResp.text();
        console.log(`[captions] fmt=${fmt || "default"} payload length=${captionPayload.length} preview=${captionPayload.slice(0, 200)}`);

        const textSegments = extractTextSegmentsFromCaptionPayload(captionPayload);
        if (textSegments.length > 0) {
          const transcript = normalizeTranscript(textSegments.join(" "));
          const integrityError = getTranscriptIntegrityError(transcript);
          if (integrityError) {
            console.log(`[captions] rejected transcript fmt=${fmt}: ${integrityError}`);
            continue;
          }

          const language =
            selectedTrack.name?.simpleText || selectedTrack.languageCode || "Auto";
          console.log(`[captions] extracted segments=${textSegments.length} language=${language} fmt=${fmt}`);
          return { transcript, language };
        }
      } catch (err) {
        console.log(`[captions] fmt=${fmt || "default"} error: ${err}`);
      }
    }

    console.log("[captions] all caption formats failed to produce readable segments");
    return await fetchYouTubeCaptionsViaTimedtext(videoId, preferredLang);
  } catch (err) {
    console.error("Error fetching YouTube captions:", err);
    return await fetchYouTubeCaptionsViaTimedtext(videoId, preferredLang);
  }
}

/** Fetch YouTube audio via cobalt.tools API (reliable open-source downloader) */
async function fetchYouTubeAudioViaCobalt(
  videoId: string
): Promise<{ base64: string; format: string } | null> {
  const fnDeadline = Date.now() + 12000;
  const cobaltInstances = [
    "https://downloadapi.stuff.solutions/api/json",
    "https://cobalt.canine.tools",
    "https://cobalt-api.kwiatekmiki.com",
  ];

  for (const baseUrl of cobaltInstances) {
    if (Date.now() > fnDeadline) break;
    try {
      console.log(`[cobalt] trying ${baseUrl}`);
      const requestUrl = baseUrl.endsWith("/api/json")
        ? baseUrl
        : `${baseUrl.replace(/\/$/, "")}/`;

      const resp = await fetchWithTimeout(requestUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
          audioBitrate: "128",
          youtubeBetterAudio: true,
        }),
      }, 4500);

      if (!resp.ok) {
        const errText = await resp.text();
        console.log(`[cobalt] ${baseUrl} status=${resp.status} body=${errText.slice(0, 200)}`);
        continue;
      }

      const data = await resp.json();
      console.log(`[cobalt] ${baseUrl} response status=${data.status}`);

      if (data.status === "error") {
        const errorCode = data.error?.code || data.text || "unknown";
        console.log(`[cobalt] ${baseUrl} error: ${errorCode}`);
        continue;
      }

      const candidateUrls = new Set<string>();

      if (typeof data.url === "string" && data.url.length > 0) {
        candidateUrls.add(data.url);
      }

      if (Array.isArray(data.tunnel)) {
        for (const tunnelUrl of data.tunnel) {
          if (typeof tunnelUrl === "string" && tunnelUrl.length > 0) {
            candidateUrls.add(tunnelUrl);
          }
        }
      }

      if (Array.isArray(data.picker)) {
        for (const item of data.picker) {
          if (typeof item?.url === "string" && item.url.length > 0) {
            candidateUrls.add(item.url);
          }
        }
      }

      const resolvedUrls = [...candidateUrls].map((url) => {
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        if (url.startsWith("/")) {
          try {
            const origin = new URL(baseUrl).origin;
            return new URL(url, origin).toString();
          } catch {
            return url;
          }
        }
        return url;
      });

      if (resolvedUrls.length === 0) {
        console.log(`[cobalt] ${baseUrl} no download URL in response`);
        continue;
      }

      for (const downloadUrl of resolvedUrls) {
        console.log(`[cobalt] downloading audio from ${baseUrl}`);
        const audioResp = await fetchWithTimeout(downloadUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }, 6000);

        if (!audioResp.ok) {
          console.log(`[cobalt] audio download failed status=${audioResp.status}`);
          continue;
        }

        const buffer = await audioResp.arrayBuffer();
        if (buffer.byteLength > 20 * 1024 * 1024) {
          console.log(`[cobalt] file too large: ${buffer.byteLength} bytes`);
          continue;
        }
        if (buffer.byteLength < 1000) {
          console.log(`[cobalt] file too small: ${buffer.byteLength} bytes`);
          continue;
        }

        const uint8 = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 32768;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);

        const contentType = (audioResp.headers.get("content-type") || "").toLowerCase();
        const format = contentType.includes("webm")
          ? "webm"
          : contentType.includes("ogg") || contentType.includes("opus")
            ? "ogg"
            : contentType.includes("mp3") || contentType.includes("mpeg")
              ? "mp3"
              : "mp4";

        console.log(`[cobalt] success size=${buffer.byteLength} format=${format}`);
        return { base64, format };
      }
    } catch (err) {
      console.log(`[cobalt] ${baseUrl} error: ${err}`);
    }
  }

  console.log("[cobalt] all instances failed");
  return null;
}

/** Fetch YouTube audio via Piped API public instances (returns audio as base64) */
async function fetchYouTubeAudioViaPiped(
  videoId: string
): Promise<{ base64: string; format: string } | null> {
  const fnDeadline = Date.now() + 12000;
  const pipedInstances = [
    "https://pipedapi.tokhmi.xyz",
    "https://pipedapi.moomoo.me",
    "https://pipedapi.leptons.xyz",
  ];

  for (const baseUrl of pipedInstances) {
    if (Date.now() > fnDeadline) break;
    try {
      console.log(`[piped] trying ${baseUrl}`);
      const resp = await fetchWithTimeout(`${baseUrl}/streams/${videoId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }, 3500);

      if (!resp.ok) {
        console.log(`[piped] ${baseUrl} status=${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const audioStreams = data?.audioStreams || [];

      if (audioStreams.length === 0) {
        console.log(`[piped] ${baseUrl} no audio streams`);
        continue;
      }

      const sorted = audioStreams
        .filter((s: any) => s.url && s.contentLength)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

      let selectedStream = null;
      for (const stream of sorted) {
        const size = parseInt(stream.contentLength || "0", 10);
        if (size > 0 && size <= 20 * 1024 * 1024) {
          selectedStream = stream;
          break;
        }
      }

      if (!selectedStream && sorted.length > 0) {
        selectedStream = sorted[sorted.length - 1];
      }

      if (!selectedStream?.url) {
        console.log(`[piped] ${baseUrl} no suitable audio stream`);
        continue;
      }

      console.log(`[piped] downloading audio from ${baseUrl} bitrate=${selectedStream.bitrate}`);
      const audioResp = await fetchWithTimeout(selectedStream.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }, 6000);

      if (!audioResp.ok) {
        console.log(`[piped] audio download failed status=${audioResp.status}`);
        continue;
      }

      const buffer = await audioResp.arrayBuffer();
      if (buffer.byteLength > 20 * 1024 * 1024) {
        console.log(`[piped] file too large: ${buffer.byteLength} bytes`);
        continue;
      }

      if (buffer.byteLength < 1000) {
        console.log(`[piped] file too small: ${buffer.byteLength} bytes`);
        continue;
      }

      const uint8 = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 32768;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      const mimeType = selectedStream.mimeType || selectedStream.format || "";
      const format = mimeType.includes("webm") ? "webm"
        : mimeType.includes("mp4") || mimeType.includes("m4a") ? "mp4"
        : mimeType.includes("ogg") || mimeType.includes("opus") ? "ogg"
        : "mp4";

      console.log(`[piped] success size=${buffer.byteLength} format=${format}`);
      return { base64, format };
    } catch (err) {
      console.log(`[piped] ${baseUrl} error: ${err}`);
    }
  }

  console.log("[piped] all instances failed");
  return null;
}

/** Fallback: fetch YouTube audio via Invidious latest_version endpoint */
async function fetchYouTubeAudioViaInvidiousLatest(
  videoId: string
): Promise<{ base64: string; format: string } | null> {
  const fnDeadline = Date.now() + 12000;
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.protokolla.fi",
  ];

  const audioItags = [140, 251];

  for (const base of instances) {
    if (Date.now() > fnDeadline) break;
    for (const itag of audioItags) {
      if (Date.now() > fnDeadline) break;
      try {
        console.log(`[invidious-audio] trying ${base} itag=${itag}`);
        const latestUrl = `${base}/latest_version?id=${encodeURIComponent(videoId)}&itag=${itag}&local=true`;
        const audio = await downloadVideoAsBase64(latestUrl, `${base}/`);
        if (audio) {
          console.log(`[invidious-audio] success ${base} itag=${itag}`);
          return audio;
        }
      } catch (err) {
        console.log(`[invidious-audio] ${base} itag=${itag} error: ${err}`);
      }
    }
  }

  console.log("[invidious-audio] all instances failed");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let createdRecordId: string | null = null;
  let createdRecordUserId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[transcribe] auth error", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    let payload: TranscribeRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { videoUrl, platform, sourceLanguage, targetLanguage, masterProfileId, fileStoragePath, recordId } =
      payload;
    const isBackgroundRun = req.headers.get("x-transcribe-background") === "1";

    // Allow either videoUrl or fileStoragePath
    const hasUrl = videoUrl?.trim();
    const hasFile = fileStoragePath?.trim();

    if (!hasUrl && !hasFile) {
      return new Response(
        JSON.stringify({ error: "videoUrl ou fileStoragePath é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!masterProfileId?.trim()) {
      return new Response(
        JSON.stringify({ error: "masterProfileId é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isValidUuid(masterProfileId)) {
      return new Response(
        JSON.stringify({ error: "masterProfileId inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const detectedPlatform = hasFile ? "Upload" : (platform || detectPlatform(videoUrl));

    console.log("[transcribe] start", {
      platform: detectedPlatform,
      sourceLanguage: sourceLanguage || "Auto",
      targetLanguage: targetLanguage || null,
      hasVideoUrl: Boolean(hasUrl),
      hasFile: Boolean(hasFile),
      userId,
      masterProfileId,
    });

    let record: { id: string };

    if (!isBackgroundRun) {
      const { data: createdRecord, error: insertError } = await supabase
        .from("transcriptions")
        .insert({
          user_id: userId,
          master_profile_id: masterProfileId,
          video_url: hasUrl ? videoUrl : `upload://${fileStoragePath}`,
          platform: detectedPlatform,
          source_language: sourceLanguage || null,
          target_language: null,
          status: "processing",
        })
        .select("id")
        .single();

      if (insertError || !createdRecord?.id) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar transcrição" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      record = { id: createdRecord.id };
      createdRecordId = record.id;
      createdRecordUserId = userId;

      const functionUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/transcribe`;
      const runInBackground = (async () => {
        try {
          const backgroundResp = await fetch(functionUrl, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              "x-transcribe-background": "1",
            },
            body: JSON.stringify({
              videoUrl,
              platform,
              sourceLanguage,
              targetLanguage: null,
              masterProfileId,
              fileStoragePath,
              recordId: record.id,
            }),
          });

          await backgroundResp.text();

          if (!backgroundResp.ok) {
            throw new Error(`background status=${backgroundResp.status}`);
          }
        } catch (bgError) {
          console.error("[transcribe] background dispatch failed", bgError);
          const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          await serviceClient
            .from("transcriptions")
            .update({
              status: "failed",
              transcript_original: null,
              transcript_translated: null,
              source_language: sourceLanguage || "Auto",
            })
            .eq("id", record.id)
            .eq("user_id", userId);
        }
      })();

      const edgeRuntime = (globalThis as typeof globalThis & {
        EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
      }).EdgeRuntime;

      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(runInBackground);
      } else {
        runInBackground.catch(() => {
          // noop
        });
      }

      return new Response(
        JSON.stringify({
          id: record.id,
          status: "processing",
          platform: detectedPlatform,
          source_language: sourceLanguage || "Auto",
          transcript_original: null,
          transcript_translated: null,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!recordId || !isValidUuid(recordId)) {
      return new Response(JSON.stringify({ error: "recordId inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRecord, error: existingRecordError } = await supabase
      .from("transcriptions")
      .select("id")
      .eq("id", recordId)
      .eq("user_id", userId)
      .single();

    if (existingRecordError || !existingRecord?.id) {
      return new Response(JSON.stringify({ error: "Transcrição não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    record = { id: existingRecord.id };
    createdRecordId = record.id;
    createdRecordUserId = userId;

    let transcript: string | null = null;
    let detectedLang = sourceLanguage || "Auto";
    let errorMessage: string | null = null;

    // Handle file upload transcription
    if (hasFile) {
      console.log(`[transcribe] file upload mode: ${fileStoragePath}`);
      try {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: fileData, error: downloadError } = await serviceClient
          .storage
          .from("user-files")
          .download(fileStoragePath!);

        if (downloadError || !fileData) {
          console.error("[transcribe] file download error:", downloadError);
          errorMessage = "Erro ao baixar o arquivo enviado.";
        } else {
          const buffer = await fileData.arrayBuffer();
          const fileSizeMB = buffer.byteLength / (1024 * 1024);
          console.log(`[transcribe] file downloaded size=${fileSizeMB.toFixed(1)}MB`);

          if (buffer.byteLength > 20 * 1024 * 1024) {
            errorMessage = "Arquivo muito grande. Máximo 20MB.";
          } else {
            const uint8 = new Uint8Array(buffer);
            let binary = "";
            const chunkSize = 32768;
            for (let i = 0; i < uint8.length; i += chunkSize) {
              binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binary);

            // Detect format from file path
            const ext = (fileStoragePath!.split(".").pop() || "").toLowerCase();
            const formatMap: Record<string, string> = {
              mp3: "mp3", mp4: "mp4", m4a: "m4a", wav: "wav",
              ogg: "ogg", webm: "webm", aac: "aac", flac: "flac",
              mpeg: "mpeg", mpga: "mpga",
            };
            const audioFormat = formatMap[ext] || "mp4";

            console.log(`[transcribe] sending file to Gemini format=${audioFormat}`);
            const aiTranscript = await transcribeAudioWithGemini(base64, audioFormat);
            if (aiTranscript) {
              transcript = aiTranscript;
              detectedLang = "Auto (IA)";
            } else {
              errorMessage = "Não foi possível transcrever este arquivo de áudio.";
            }
          }

          // Clean up uploaded file
          await serviceClient.storage.from("user-files").remove([fileStoragePath!]);
        }
      } catch (err) {
        console.error("[transcribe] file processing error:", err);
        errorMessage = "Erro ao processar o arquivo enviado.";
      }
    } else if (detectedPlatform === "YouTube") {
      const youtubeId = extractYouTubeId(videoUrl);
      if (!youtubeId) {
        errorMessage = "Link do YouTube inválido";
      } else {
        console.log(`[transcribe] YouTube pipeline videoId=${youtubeId}`);

        // Step 1: Try YouTube captions FIRST (fastest and most reliable)
        console.log("[transcribe] trying YouTube captions first");
        
        const captions = await fetchYouTubeCaptions(youtubeId, sourceLanguage);
        if (captions?.transcript?.trim()) {
          transcript = captions.transcript.trim();
          detectedLang = captions.language || detectedLang;
          console.log("[transcribe] got transcript from WEB captions");
        }
        
        const youtubePipelineStartedAt = Date.now();
        const youtubeBudgetExceeded = () =>
          Date.now() - youtubePipelineStartedAt > YOUTUBE_PIPELINE_BUDGET_MS;

        if (!transcript && !youtubeBudgetExceeded()) {
          const multiClientCaptions = await fetchYouTubeCaptionsMultiClient(youtubeId, sourceLanguage);
          if (multiClientCaptions?.transcript?.trim()) {
            transcript = multiClientCaptions.transcript.trim();
            detectedLang = multiClientCaptions.language || detectedLang;
            console.log("[transcribe] got transcript from multi-client captions");
          }
        }
        
        if (!transcript && !youtubeBudgetExceeded()) {
          const instanceCaptions = await fetchYouTubeCaptionsViaInstances(youtubeId, sourceLanguage);
          if (instanceCaptions?.transcript?.trim()) {
            transcript = instanceCaptions.transcript.trim();
            detectedLang = instanceCaptions.language || detectedLang;
            console.log("[transcribe] got transcript from Invidious captions");
          }
        }

        // Step 2: If no captions, try Gemini Pro URL transcription first (most reliable)
        if (!transcript && !youtubeBudgetExceeded() && ENABLE_GEMINI_YOUTUBE_URL_TRANSCRIPTION) {
          console.log("[transcribe] no captions found, trying Gemini Pro URL transcription");
          const geminiUrlTranscript = await transcribeYouTubeWithGeminiUrl(youtubeId);
          if (geminiUrlTranscript) {
            transcript = geminiUrlTranscript;
            detectedLang = "Auto (IA)";
            console.log("[transcribe] got transcript from Gemini Pro URL method");
          }
        }

        // Step 3: If Gemini URL failed, try audio download + Gemini transcription
        if (!transcript && !youtubeBudgetExceeded()) {
          console.log("[transcribe] Gemini URL failed, trying audio download fallbacks");

          // Try cobalt.tools API
          const cobaltAudio = await fetchYouTubeAudioViaCobalt(youtubeId);
          if (cobaltAudio) {
            const aiTranscript = await transcribeAudioWithGemini(cobaltAudio.base64, cobaltAudio.format);
            if (aiTranscript) {
              transcript = aiTranscript;
              detectedLang = "Auto (IA)";
            }
          }

          // Try Piped API
          if (!transcript && !youtubeBudgetExceeded()) {
            const pipedAudio = await fetchYouTubeAudioViaPiped(youtubeId);
            if (pipedAudio) {
              const aiTranscript = await transcribeAudioWithGemini(pipedAudio.base64, pipedAudio.format);
              if (aiTranscript) {
                transcript = aiTranscript;
                detectedLang = "Auto (IA)";
              }
            }
          }

          // Try Invidious
          if (!transcript && !youtubeBudgetExceeded()) {
            const invidiousAudio = await fetchYouTubeAudioViaInvidiousLatest(youtubeId);
            if (invidiousAudio) {
              const aiTranscript = await transcribeAudioWithGemini(invidiousAudio.base64, invidiousAudio.format);
              if (aiTranscript) {
                transcript = aiTranscript;
                detectedLang = "Auto (IA)";
              }
            }
          }

          // Try innertube direct
          if (!transcript && !youtubeBudgetExceeded()) {
            const directUrl = await extractYouTubeVideoUrl(youtubeId);
            if (directUrl) {
              const audio = await downloadVideoAsBase64(directUrl, "https://www.youtube.com/");
              if (audio) {
                const aiTranscript = await transcribeAudioWithGemini(audio.base64, audio.format);
                if (aiTranscript) {
                  transcript = aiTranscript;
                  detectedLang = "Auto (IA)";
                }
              }
            }
          }
        }

        if (!transcript) {
          errorMessage =
            "Não foi possível extrair áudio/legendas deste vídeo do YouTube. Tente usar a opção 'Enviar Arquivo': baixe o áudio do vídeo no seu computador e envie para transcrição garantida.";
        }
      }
    } else if (detectedPlatform === "TikTok") {
      console.log("[transcribe] extracting captions tiktok");
      const captions = await fetchTikTokCaptions(videoUrl, sourceLanguage);

      if (captions?.transcript?.trim()) {
        transcript = captions.transcript.trim();
        detectedLang = captions.language || detectedLang;
      } else {
        // Fallback 1: Try tikwm.com API (most reliable for TikTok)
        console.log("[transcribe] no captions, trying tikwm.com API for TikTok");
        const tikwmAudio = await downloadTikTokViaTikwm(videoUrl);
        if (tikwmAudio) {
          const aiTranscript = await transcribeAudioWithGemini(tikwmAudio.base64, tikwmAudio.format);
          if (aiTranscript) {
            transcript = aiTranscript;
            detectedLang = "Auto (IA)";
          }
        }

        // Fallback 2: Try direct extraction if tikwm failed
        if (!transcript) {
          console.log("[transcribe] tikwm failed, trying direct video extraction for TikTok");
          const directUrl = await extractTikTokVideoUrl(videoUrl);
          if (directUrl) {
            const audio = await downloadVideoAsBase64(directUrl, "https://www.tiktok.com/");
            if (audio) {
              const aiTranscript = await transcribeAudioWithGemini(audio.base64, audio.format);
              if (aiTranscript) {
                transcript = aiTranscript;
                detectedLang = "Auto (IA)";
              }
            }
          }
        }

        if (!transcript) {
          errorMessage =
            "Não foi possível transcrever este vídeo do TikTok. O vídeo pode estar privado ou protegido.";
        }
      }
    } else if (detectedPlatform === "Instagram") {
      console.log("[transcribe] extracting captions instagram");
      const captions = await fetchInstagramCaptions(videoUrl, sourceLanguage);

      if (captions?.transcript?.trim()) {
        transcript = captions.transcript.trim();
        detectedLang = captions.language || detectedLang;
      } else {
        // Fallback: try to download video from Instagram + transcribe with Gemini
        console.log("[transcribe] no captions, trying audio download + AI transcription for Instagram");
        const directUrl = await extractInstagramVideoUrl(videoUrl);
        if (directUrl) {
          const audio = await downloadVideoAsBase64(directUrl, "https://www.instagram.com/");
          if (audio) {
            const aiTranscript = await transcribeAudioWithGemini(audio.base64, audio.format);
            if (aiTranscript) {
              transcript = aiTranscript;
              detectedLang = "Auto (IA)";
            }
          }
        }
        if (!transcript) {
          errorMessage =
            "Não foi possível transcrever este vídeo do Instagram. O vídeo pode estar privado ou protegido.";
        }
      }
    } else {
      errorMessage =
        "No momento, a transcrição automática suporta links do YouTube, TikTok e Instagram";
    }

    if (errorMessage || !transcript) {
      const serviceClientFail = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await serviceClientFail
        .from("transcriptions")
        .update({
          status: "failed",
          transcript_original: null,
          transcript_translated: null,
          source_language: detectedLang,
        })
        .eq("id", record.id);

      console.log("[transcribe] failed", {
        recordId: record.id,
        platform: detectedPlatform,
        sourceLanguage: detectedLang,
        reason: errorMessage,
      });
      return new Response(
        JSON.stringify({
          id: record.id,
          status: "failed",
          error: errorMessage,
          platform: detectedPlatform,
          source_language: detectedLang,
          transcript_original: null,
          transcript_translated: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let translated: string | null = null;

    if (targetLanguage) {
      try {
        const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
        if (GOOGLE_API_KEY) {
          const aiResponse = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: `Você é um tradutor profissional. Traduza o texto a seguir para ${targetLanguage}. Retorne SOMENTE a tradução, sem explicações, sem comentários, sem formatação extra.\n\n${transcript}` }],
                  },
                ],
              }),
            },
            8000
          );
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            translated = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
          }
        }
      } catch (err) {
        console.error("Translation error (non-fatal):", err);
      }
    }

    // Use service role client for the final update to avoid RLS issues
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: updated, error: updateError } = await serviceClient
      .from("transcriptions")
      .update({
        transcript_original: transcript,
        transcript_translated: translated,
        source_language: detectedLang,
        status: "completed",
      })
      .eq("id", record.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar transcrição" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[transcribe] completed", {
      recordId: record.id,
      platform: detectedPlatform,
      sourceLanguage: detectedLang,
      transcriptChars: transcript.length,
      hasTranslation: Boolean(translated),
    });

    return new Response(JSON.stringify(updated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("transcribe error:", e);

    try {
      if (createdRecordId) {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await serviceClient
          .from("transcriptions")
          .update({
            status: "failed",
            transcript_original: null,
            transcript_translated: null,
            source_language: "Auto",
          })
          .eq("id", createdRecordId)
          .eq("user_id", createdRecordUserId || "");
      }
    } catch (_updateErr) {
      // noop
    }

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
