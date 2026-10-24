import { test } from "node:test";
import assert from "node:assert/strict";
import { RemoteAudioReader, audioEndpoint } from "../remote-audio.mjs";

const request = { library: "sleeping-gods-fr", passage: "9.2", voice: "patrick" };
class Audio {
  constructor() { this.paused = true; }
  async play() { this.paused = false; }
  pause() { this.paused = true; }
  removeAttribute() {}
  load() {}
}
const audioResponse = () => new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } });
const urls = { createObjectURL: () => "blob:test", revokeObjectURL: () => {} };

test("le fetch natif conserve le contexte Window attendu par le navigateur", async t => {
  t.mock.method(globalThis, "fetch", async function () {
    assert.equal(this, globalThis, "fetch ne doit pas recevoir RemoteAudioReader comme contexte");
    return audioResponse();
  });
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio, urls });
  await reader.start(request);
  assert.equal(reader.state, "playing");
});

test("audio existant sans demande de code, pause et reprise sans requête", async () => {
  let calls = 0;
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio, urls,
    fetch: async () => { calls++; return audioResponse(); }, getToken: () => { throw new Error("Pas de code nécessaire"); } });
  await reader.start(request, 1.3);
  assert.equal(reader.state, "playing");
  assert.equal(reader.audio.playbackRate, 1.3);
  reader.pause(); assert.equal(reader.state, "paused");
  await reader.resume(); assert.equal(reader.state, "playing");
  assert.equal(calls, 1);
  reader.stop(); assert.equal(reader.audio, null);
});

test("cache absent : seul le POST autorisé déclenche la génération", async () => {
  const calls = [];
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio, urls,
    getToken: async () => "test-code",
    fetch: async (url, options) => {
      calls.push(options);
      return options.method === "POST" ? audioResponse() : Response.json({ code: "not_generated" }, { status: 404 });
    } });
  await reader.start(request);
  assert.equal(reader.state, "playing");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.Authorization, "Bearer test-code");
});

test("annuler le code ne génère rien et une erreur de code est explicite", async () => {
  let calls = 0;
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio, urls,
    getToken: async () => null, fetch: async () => { calls++; return Response.json({ code: "not_generated" }, { status: 404 }); } });
  await reader.start(request);
  assert.equal(reader.state, "idle");
  assert.equal(calls, 1);
  reader.getToken = async () => "invalid";
  reader.fetch = async (url, options) => options.method === "POST" ? Response.json({ message: "Code incorrect" }, { status: 401 }) : Response.json({ code: "not_generated" }, { status: 404 });
  await reader.start(request);
  assert.equal(reader.state, "error");
  assert.equal(reader.accessDenied, true);
});

test("stop pendant le téléchargement empêche la lecture tardive", async () => {
  let release;
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio, urls,
    fetch: () => new Promise(resolve => { release = resolve; }) });
  const work = reader.start(request);
  reader.stop();
  release(audioResponse());
  await work;
  assert.equal(reader.state, "idle");
  assert.equal(reader.audio, null);
});

test("blocage de lecture automatique : reprendre au clic sans regénérer", async () => {
  let blocked = true, calls = 0;
  class RestrictedAudio extends Audio {
    async play() { if (blocked) { blocked = false; const error = new Error(); error.name = "NotAllowedError"; throw error; } }
  }
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio: RestrictedAudio, urls,
    fetch: async () => { calls++; return audioResponse(); } });
  await reader.start(request);
  assert.equal(reader.state, "ready");
  await reader.resume();
  assert.equal(reader.state, "playing");
  assert.equal(calls, 1);
});

test("configuration publique sans secret ni URL non sécurisée", () => {
  assert.equal(audioEndpoint(""), "");
  assert.equal(audioEndpoint("https://secret:token@example.com"), "");
  assert.equal(audioEndpoint("https://example.com?key=secret"), "");
  assert.equal(audioEndpoint("http://example.com"), "");
  assert.equal(audioEndpoint("https://audio.example/"), "https://audio.example");
});

test("l'empreinte du récit est transmise sans envoyer son texte libre", async () => {
  let target;
  const reader = new RemoteAudioReader({ endpoint: "https://audio.example", Audio, urls,
    fetch: async url => { target = url; return audioResponse(); } });
  await reader.start(request, 1, "Texte de test 🧠");
  assert.match(target.searchParams.get("text_hash"), /^[a-f0-9]{64}$/);
  assert.equal(target.searchParams.has("text"), false);
  assert.equal(reader.state, "playing");
});
