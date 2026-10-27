import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authorizationEndpoint, authorizationKey, verifyAuthorization } from "../authorization.mjs";

test("la mémorisation de l’application indépendante réutilise la clé ElevenLabs", () => {
  assert.equal(authorizationKey("https://audio.example/"), "narrateur-generation-code:https://audio.example");
  assert.equal(authorizationEndpoint("http://localhost:8765"), "http://localhost:8765");
  for (const value of ["http://audio.example", "https://user:secret@audio.example", "https://audio.example?token=secret", "invalid"]) {
    assert.equal(authorizationEndpoint(value), "");
  }
});

test("l’ouverture autonome vérifie le code sans le placer dans l’URL ou appeler une route audio", async () => {
  const calls=[];
  await verifyAuthorization("https://audio.example", "test-code", async (url, options) => {
    calls.push(url);
    assert.equal(url, "https://audio.example/authorize");
    assert.equal(options.headers.Authorization, "Bearer test-code");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    return Response.json({code:"authorized"});
  });
  assert.equal(calls.length,1);
  await assert.rejects(verifyAuthorization("https://audio.example", "wrong", async()=>new Response(null,{status:401})), error=>error.accessDenied===true);
  await assert.rejects(verifyAuthorization("https://audio.example", "wrong", async()=>Response.json({code:"other"})), /Impossible/);
  await assert.rejects(verifyAuthorization("https://audio.example", "wrong", async()=>new Response(null,{status:503})), /Impossible/);
});

test("le Narrateur ne charge plus l’atelier et le Labo propose une application autonome", async () => {
  const html=await readFile(new URL("../../narrateur/index.html",import.meta.url),"utf8");
  const script=await readFile(new URL("../../narrateur/script.js",import.meta.url),"utf8");
  assert.doesNotMatch(html,/editor-mode|editor-area|edit-library|iframe/);
  assert.doesNotMatch(script,/atelier-data|readDrafts|editorFrame|postMessage/);
  const labo=await readFile(new URL("../../index.html",import.meta.url),"utf8");
  assert.match(labo,/href="atelier-des-recits\/"/);
  const app=await readFile(new URL("../index.html",import.meta.url),"utf8");
  assert.match(app,/id="access-form"/);
  assert.match(app,/src="access.mjs/);
  assert.doesNotMatch(app,/<iframe/);
});
