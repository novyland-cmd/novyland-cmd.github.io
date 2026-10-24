import { test } from "node:test";
import assert from "node:assert/strict";
import { SpeechReader, speechChunks } from "../speech.mjs";

function setup() {
  const calls = [];
  const synth = { cancel: () => calls.push("cancel"), pause: () => calls.push("pause"),
    resume: () => calls.push("resume"), speak: utterance => calls.push(utterance) };
  class Utterance { constructor(text) { this.text = text; } }
  const reader = new SpeechReader(synth, Utterance);
  return { reader, calls };
}

test("les longs passages sont découpés sans perte de mots", () => {
  const text = "Une longue phrase 🧠 avec un choix.\n".repeat(150);
  const chunks = speechChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(c => c.length <= 220));
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.trim().replace(/\s+/g, " "));
});

test("lire, pause, reprendre, arrêter et événements de fin tardifs", () => {
  const { reader, calls } = setup();
  reader.start("Bonjour.", { voice: { lang: "fr-CA" }, rate: 1.3 });
  const utterance = reader.current;
  assert.equal(utterance.lang, "fr-CA");
  assert.equal(utterance.rate, 1.3);
  reader.pause(); assert.equal(reader.state, "paused");
  reader.resume(); assert.equal(reader.state, "playing");
  assert.deepEqual(calls.filter(c => typeof c === "string"), ["cancel", "resume", "pause", "resume"]);
  reader.stop(); assert.equal(reader.state, "idle");
  const length = calls.length;
  utterance.onend();
  assert.equal(calls.length, length);
});

test("changer de passage annule l'ancien récit sans relancer sa file", () => {
  const { reader } = setup();
  reader.start("ancien texte ".repeat(200));
  const old = reader.current;
  reader.stop();
  reader.start("Nouveau passage.");
  old.onend(); old.onerror();
  assert.equal(reader.current.text, "Nouveau passage.");
  reader.current.onend();
  assert.equal(reader.state, "finished");
});

test("une pause en fin de segment ne lance pas le suivant avant reprise", () => {
  const { reader } = setup();
  reader.start("mot ".repeat(200));
  reader.pause();
  reader.current.onend();
  assert.equal(reader.current, null);
  assert.equal(reader.state, "paused");
  reader.resume();
  assert.ok(reader.current);
});

test("erreurs et absence de synthèse ne bloquent pas le lecteur", () => {
  const { reader } = setup();
  reader.start("Bonjour."); reader.current.onerror();
  assert.equal(reader.state, "error");
  const unavailable = new SpeechReader(undefined, undefined);
  unavailable.start("Bonjour."); unavailable.stop();
  assert.equal(unavailable.supported, false);
  assert.equal(unavailable.state, "idle");
});
