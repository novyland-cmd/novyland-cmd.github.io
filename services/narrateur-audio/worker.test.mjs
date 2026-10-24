import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { AudioCoordinator, resolveAudio, VOICES } from "./worker.mjs";

const TOKEN = "test-only-generation-code-not-a-real-secret";
const endpoint = "https://audio.example/audio?library=sleeping-gods-fr&passage=9.2&voice=patrick";
function setup() {
  const objects = new Map();
  const values = new Map();
  const env = {
    ALLOWED_ORIGINS: "https://novyland.ca", MAX_DAILY_CHARACTERS: "30000", AUDIO_REVISION: "1",
    ELEVENLABS_API_KEY: "test-only-placeholder", GENERATION_TOKEN: TOKEN,
    AUDIO: { get: async key => objects.has(key) ? { body: objects.get(key).slice(0) } : null,
      put: async (key, bytes) => objects.set(key, bytes.slice(0)) },
  };
  const coordinator = new AudioCoordinator({ storage: { get: async key => values.get(key),
    put: async (key, value) => values.set(key, value) } }, env);
  env.COORDINATOR = { idFromName: name => name, get: () => coordinator };
  return { env, values, objects };
}
const request = (method = "GET", token, url = endpoint) => new Request(url, {
  method, headers: { Origin: "https://novyland.ca", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});

test("pas de génération sans code, pas de texte libre ou de voix arbitraire", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Aucun appel réseau attendu"); });
  const { env } = setup();
  assert.equal((await worker.fetch(request(), env)).status, 404);
  assert.equal((await worker.fetch(request("POST"), env)).status, 401);
  assert.equal((await worker.fetch(request("POST", "incorrect"), env)).status, 401);
  assert.equal((await worker.fetch(request("POST", TOKEN, endpoint.replace("patrick", "arbitrary")), env)).status, 404);
  assert.equal((await worker.fetch(request("POST", TOKEN, endpoint.replace("9.2", "70.8")), env)).status, 404);
});

test("un audio est facturé une fois, conservé, puis lu sans code", async t => {
  const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(url.includes(VOICES.patrick));
    const payload = JSON.parse(options.body);
    assert.equal(payload.model_id, "eleven_v4");
    assert.equal(payload.language_code, "fr");
    assert.ok(payload.text.startsWith("Le coup de canon"));
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  });
  const { env, objects } = setup();
  const responses = await Promise.all([worker.fetch(request("POST", TOKEN), env), worker.fetch(request("POST", TOKEN), env)]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(objects.size, 1);
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://novyland.ca");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  assert.equal(mock.mock.callCount(), 1);
});

test("budget dépassé et stockage défaillant empêchent tout appel payant", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Pas de génération"); });
  const { env } = setup();
  env.MAX_DAILY_CHARACTERS = "1";
  assert.equal((await worker.fetch(request("POST", TOKEN), env)).status, 429);
  env.AUDIO.get = async () => { throw new Error("Stockage indisponible"); };
  assert.equal((await worker.fetch(request("POST", TOKEN), env)).status, 503);
  assert.equal(mock.mock.callCount(), 0);
});

test("les erreurs ElevenLabs ne divulguent pas sa réponse ni la clé", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("provider detail with sensitive information", { status: 401 }));
  const { env, values, objects } = setup();
  const response = await worker.fetch(request("POST", TOKEN), env);
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.ok(!body.includes("sensitive"));
  assert.ok(!body.includes(env.ELEVENLABS_API_KEY));
  assert.ok(values.get("budget").used > 0);
  assert.equal(objects.size, 0);
});

test("la langue, la voix et la révision ont des caches distincts", async () => {
  const { env } = setup();
  const first = await resolveAudio(new URL(endpoint), env);
  const anna = await resolveAudio(new URL(endpoint.replace("patrick", "anna")), env);
  const english = await resolveAudio(new URL(endpoint.replace("-fr", "-en")), env);
  const revision = await resolveAudio(new URL(endpoint), { ...env, AUDIO_REVISION: "2" });
  assert.equal(new Set([first.key, anna.key, english.key, revision.key]).size, 4);
});

test("CORS et prévol", async () => {
  const { env } = setup();
  const bad = new Request(endpoint, { headers: { Origin: "https://unrelated.example" } });
  assert.equal((await worker.fetch(bad, env)).status, 403);
  const preflight = await worker.fetch(request("OPTIONS"), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Authorization");
});

test("une bibliothèque différente sur le site ne lit pas un ancien récit", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Pas d'appel attendu"); });
  const { env } = setup();
  const response = await worker.fetch(request("POST", TOKEN, endpoint + "&text_hash=outdated"), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "text_mismatch");
  assert.equal(mock.mock.callCount(), 0);
});
