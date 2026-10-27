import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ATELIER_KEY, fromNarrator, toNarrator, normalizeImport, readDrafts, renameEntry, detectedReferences } from "../data.mjs";
import { prepareLibrary, findPassage, passageParts } from "../library.mjs";

const source = () => ({ schema_version: 1, game_id: "test", language: "fr", aliases: { "D1.1": "D.I.1" },
  source: { filename: "livret.pdf" }, passages: [
    { id: "1", key: "1", title: "Départ", text: "🧭 Allez au paragraphe D.I.1.", source_pages: [2], references: [
      { raw_id: "D.I.1", target_id: "D.I.1", detection: "explicit", text_offset: 22 },
    ], narration_text: "Ancienne narration", narration_verified: true },
    { id: "D.I.1", key: "D.I.1", title: "Arrivée", text: "La suite.", references: [] },
  ] });

test("une copie locale et son export conservent les données d’origine sans modifier le livret", () => {
  const data = source();
  const before = structuredClone(data);
  const draft = fromNarrator(data, { id: "draft", name: "Mon récit" });
  draft.entries[0].title = "Nouveau titre";
  draft.entries[0].notes = "À vérifier";
  draft.entries[0].tags = "forêt";
  draft.entries[0].status = "À relire";
  draft.entries[0].choices.push({ label: "Avancer", target: "D.I.1" });
  const exported = toNarrator(draft);
  assert.deepEqual(data, before);
  assert.deepEqual(exported.source, before.source);
  assert.deepEqual(exported.passages[0].source_pages, [2]);
  assert.deepEqual(exported.passages[0].references, before.passages[0].references);
  assert.equal(exported.passages[0].text, before.passages[0].text);
  const restored = fromNarrator(exported);
  assert.deepEqual(restored.entries[0].choices, draft.entries[0].choices);
  assert.equal(restored.entries[0].notes, "À vérifier");
  assert.equal(restored.entries[0].status, "À relire");
  assert.equal(findPassage(prepareLibrary(exported), "D1.1").status, "found");
});

test("une modification recalcule les renvois Unicode et invalide l’ancienne narration", () => {
  const draft = fromNarrator(source());
  draft.entries[0].body = "🧭 Un nouveau début. Allez au paragraphe D.I.1.\n📖 1";
  const exported = toNarrator(draft);
  const passage = exported.passages[0];
  assert.equal(passage.narration_verified, false);
  assert.equal(passage.narration_text, undefined);
  assert.deepEqual(passageParts(passage).filter(p => p.target).map(p => p.target), ["D.I.1", "1"]);
  assert.deepEqual(detectedReferences("Passage 1 — Le fleuve.\nRevenir. (passage 114).").map(r => r.target_id), ["114"]);
  assert.deepEqual(detectedReferences("Go to paragraph 9.2. Retournez au paragraphe F17. → 12.2A").map(r => r.target_id), ["9.2", "F17", "12.2A"]);
});

test("renommer un passage corrige choix, texte, renvois et alias sans remplacer d’autres nombres", () => {
  const draft = fromNarrator(source());
  draft.entries[0].body += " Coût : 1 pièce. [livre] D.I.1";
  draft.entries[0].choices.push({ label: "Suivre", target: "D.I.1" });
  renameEntry(draft, draft.entries[1], "F17");
  assert.equal(draft.entries[1].id, "F17");
  assert.equal(draft.entries[0].choices[0].target, "F17");
  assert.match(draft.entries[0].body, /Coût : 1 pièce/);
  assert.ok(!draft.entries[0].body.includes("D.I.1"));
  const exported = toNarrator(draft);
  assert.equal(exported.aliases["D1.1"], "F17");
  assert.equal(findPassage(prepareLibrary(exported), "D1.1").passage.id, "F17");
  assert.throws(() => renameEntry(draft, draft.entries[1], "1"));
  assert.throws(() => renameEntry(draft, draft.entries[1], "introduction"));
});

test("import et stockage refusent les sauvegardes malformées sans écrasement", () => {
  const draft = fromNarrator(source(), { id: "draft" });
  const backup = { version: 1, libraries: [draft] };
  assert.deepEqual(normalizeImport(backup), backup);
  assert.equal(normalizeImport(source()).libraries.length, 1);
  assert.deepEqual(readDrafts({ getItem: key => { assert.equal(key, ATELIER_KEY); return JSON.stringify(backup); } }), backup);
  assert.throws(() => readDrafts({ getItem: () => "not-json" }), error => error.invalidDrafts === true);
  assert.throws(() => readDrafts({ getItem: () => { throw new Error("storage unavailable"); } }), error => !error.invalidDrafts);
  assert.throws(() => normalizeImport({ passages: [{ id: "1" }] }));
  const invalid = structuredClone(backup);
  invalid.libraries[0].entries[0].choices = [{ target: "2" }];
  assert.throws(() => readDrafts({ getItem: () => JSON.stringify(invalid) }));
  draft.entries[0].body = "";
  assert.throws(() => toNarrator(draft), /vide/);
});

test("les quatre livrets réels peuvent être copiés, exportés et relus sans perte de texte", async () => {
  for (const file of ["sleeping-gods-fr", "sleeping-gods-en", "cozy-sticker-ville-fr", "novyland-quete1-fr"]) {
    const data = JSON.parse(await readFile(new URL(`../../narrateur/libraries/${file}.json`, import.meta.url)));
    const exported = toNarrator(fromNarrator(data));
    assert.deepEqual(exported.passages.map(p => p.text), data.passages.map(p => p.text), file);
    assert.equal(prepareLibrary(exported).passages.size, data.passages.length);
  }
});
