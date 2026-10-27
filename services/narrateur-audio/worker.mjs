import french from "../../labo/narrateur/libraries/sleeping-gods-fr.json" with { type: "json" };
import english from "../../labo/narrateur/libraries/sleeping-gods-en.json" with { type: "json" };
import cozy from "../../labo/narrateur/libraries/cozy-sticker-ville-fr.json" with { type: "json" };
import novyland from "../../labo/narrateur/libraries/novyland-quete1-fr.json" with { type: "json" };
import { prepareLibrary, findPassage, reflowText } from "../../labo/narrateur/library.mjs";

const libraries = new Map([
  ["novyland-quete1-fr", prepareLibrary(novyland)],
  ["sleeping-gods-fr", prepareLibrary(french)],
  ["sleeping-gods-en", prepareLibrary(english)],
  ["cozy-sticker-ville-fr", prepareLibrary(cozy)],
]);
export const VOICES = { patrick: "XTyroWkQl32ZSd3rRVZ1", anna: "PSVUmed8NvS8aUA3d5oO" };
const MODEL = "eleven_v4";
const json = (status, code, message) => Response.json({ code, message }, { status });

export async function resolveAudio(url, env) {
  const book = libraries.get(url.searchParams.get("library"));
  const voice = url.searchParams.get("voice");
  if (!book || !Object.hasOwn(VOICES, voice)) return null;
  const found = findPassage(book, url.searchParams.get("passage") || "");
  if (found.status !== "found") return null;
  // Chaque résultat est une entrée autonome, comme tout autre passage.
  const text = reflowText(found.passage.text);
  const characters = Array.from(text).length;
  if (characters > 10000) return null;
  const fingerprint = JSON.stringify([env.AUDIO_REVISION || "1", MODEL, VOICES[voice], book.language, text]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const textDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const textHash = [...new Uint8Array(textDigest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const expected = url.searchParams.get("text_hash");
  return { key: `${hash}.mp3`, voiceId: VOICES[voice], text, characters, language: book.language,
    matches: !expected || expected === textHash };
}

function audioResponse(object) {
  return new Response(object.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}

function authorized(request, env) {
  const token = env.GENERATION_TOKEN;
  if (typeof token !== "string" || token.length < 24) return false;
  const given = request.headers.get("Authorization") || "";
  const expected = `Bearer ${token}`;
  if (given.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < given.length; i++) different |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return different === 0;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    // L'origine limite l'accès depuis un navigateur ; le code privé protège les appels payants.
    if (origin && !allowed.includes(origin)) return json(403, "origin", "Origine non autorisée.");
    let response;
    try {
      const url = new URL(request.url);
      if (!["/audio", "/authorize"].includes(url.pathname)) response = json(404, "route", "Adresse inconnue.");
      else if (request.method === "OPTIONS") response = new Response(null, { status: 204 });
      else if (url.pathname === "/authorize") {
        if (request.method !== "POST") response = json(405, "method", "Méthode non autorisée.");
        else response = authorized(request, env)
          ? json(200, "authorized", "Autorisation confirmée.")
          : json(401, "access", "Le code d’autorisation est incorrect ou absent.");
      }
      else if (!["GET", "POST"].includes(request.method)) response = json(405, "method", "Méthode non autorisée.");
      else {
        const audio = await resolveAudio(url, env);
        if (!audio) response = json(404, "passage", "Ce passage ou cette voix n’est pas disponible.");
        else if (!audio.matches) response = json(409, "text_mismatch", "Le livret et le service audio n’ont pas la même version. Le propriétaire doit mettre à jour le service audio.");
        else {
          const cached = await env.AUDIO.get(audio.key);
          if (cached) response = audioResponse(cached);
          else if (request.method === "GET") response = json(404, "not_generated", "Ce passage n’a pas encore d’enregistrement avec cette voix.");
          else if (!authorized(request, env)) response = json(401, "access", "Le code de génération est incorrect ou absent.");
          else {
            const coordinator = env.COORDINATOR.get(env.COORDINATOR.idFromName("generation"));
            response = await coordinator.fetch(new Request(url.href, { method: "POST" }));
          }
        }
      }
    } catch { response = json(503, "service", "Le service audio est temporairement indisponible."); }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Vary", "Origin");
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization");
    return new Response(response.body, { status: response.status, headers });
  },
};

// Une seule file pour toutes les générations : deux demandes simultanées du même
// passage ne sont pas facturées deux fois, et le budget est réservé sans concurrence.
export class AudioCoordinator {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.queue = Promise.resolve(); }

  fetch(request) {
    const work = this.queue.then(() => this.generate(request));
    this.queue = work.catch(() => {});
    return work.catch(() => json(503, "generation", "La génération n’a pas pu être terminée. Réessayez plus tard."));
  }

  async generate(request) {
    const env = this.env;
    const audio = await resolveAudio(new URL(request.url), env);
    if (!audio || !audio.matches) return json(404, "passage", "Passage introuvable ou version différente.");
    const cached = await env.AUDIO.get(audio.key);
    if (cached) return audioResponse(cached);
    if (!env.ELEVENLABS_API_KEY) return json(503, "configuration", "Le service ElevenLabs n’est pas encore configuré.");
    const limit = Number(env.MAX_DAILY_CHARACTERS);
    if (!Number.isSafeInteger(limit) || limit <= 0) return json(503, "budget_configuration", "La limite de génération doit être configurée.");
    const day = new Date().toISOString().slice(0, 10);
    const previous = await this.ctx.storage.get("budget");
    const used = previous?.day === day ? previous.used : 0;
    if (!Number.isSafeInteger(used) || used < 0) return json(503, "budget_storage", "Le compteur de génération est indisponible.");
    if (used + audio.characters > limit) return json(429, "budget", "La limite quotidienne de génération est atteinte. Les audios existants restent accessibles.");
    // Réserver avant l'appel. En cas d'échec, ne pas rembourser automatiquement :
    // une requête interrompue peut tout de même avoir été facturée par ElevenLabs.
    await this.ctx.storage.put("budget", { day, used: used + audio.characters });
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${audio.voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: audio.text, model_id: MODEL, language_code: audio.language }),
      signal: AbortSignal.timeout(60000),
    });
    if (!upstream.ok) return json(502, "elevenlabs", "ElevenLabs n’a pas pu générer ce passage. Vérifiez le compte, la voix et les crédits disponibles.");
    if (!upstream.headers.get("Content-Type")?.startsWith("audio/")) return json(502, "format", "Le service vocal n’a pas renvoyé un enregistrement audio.");
    const bytes = await upstream.arrayBuffer();
    if (!bytes.byteLength) return json(502, "empty", "L’enregistrement reçu est vide.");
    await env.AUDIO.put(audio.key, bytes, { httpMetadata: { contentType: "audio/mpeg" } });
    return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  }
}
