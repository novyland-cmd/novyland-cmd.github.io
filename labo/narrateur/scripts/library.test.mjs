import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareLibrary, findPassage, normalizeId, passageParts, libraryLabel, reflowText } from "../library.mjs";

const passage = (id, extra = {}) => ({ id, key: id, text: "Un passage de test.", title: null, ...extra });
const data = passages => ({ schema_version: 1, game_id: "test", passages });

test("la lecture fluide rassemble les phrases sans mélanger choix et consignes", () => {
  const text = "La porte est en fer massif, haute comme deux étages, sans\nserrure ni ouverture visible.\n— Capitaine ! On pourrait la faire sauter\navec le canon !\nA. Utiliser le canon pour ouvrir\nla porte.\n→ Allez au paragraphe\n9.2\nB. Partir.\nObtenir : 2 XP\n\nLa suite.";
  const p = passage("1", { text, references: [{ detection: "explicit", raw_id: "9.2", text_offset: Array.from(text.slice(0, text.indexOf("9.2"))).length }] });
  const parts = passageParts(p, { reflow: true });
  assert.match(reflowText(text), /sans serrure ni ouverture visible/);
  assert.match(reflowText(text), /\n— Capitaine/);
  assert.match(reflowText(text), /\nA\. Utiliser le canon pour ouvrir la porte/);
  assert.match(reflowText(text), /\nB\. Partir\.\nObtenir/);
  assert.match(reflowText(text), /\n\nLa suite/);
  assert.equal(parts.map(p => p.text).join(""), reflowText(text));
  assert.deepEqual(parts.filter(p => p.target), [{ text: "9.2", target: "9.2" }]);
  assert.equal(reflowText(text).length, text.length);
});

test("le libellé suit la langue sélectionnée sans supposer le français", () => {
  const source = { ...data([passage("1")]), game_id: "sleeping-gods" };
  assert.equal(libraryLabel(prepareLibrary({ ...source, language: "en" })), "Sleeping Gods · Anglais");
  assert.equal(libraryLabel(prepareLibrary({ ...source, language: "fr" })), "Sleeping Gods · Français");
  assert.equal(libraryLabel(prepareLibrary(source)), "Sleeping Gods");
});

test("virgule, espaces autour du séparateur et identifiants textuels", () => {
  assert.equal(normalizeId(" 9 , 2 "), "9.2");
  const library = prepareLibrary(data([passage("9.2"), passage("30.1"), passage("30.10")]));
  assert.equal(findPassage(library, "9,2").id, "9.2");
  assert.equal(findPassage(library, "30.10").passage.id, "30.10");
  assert.equal(findPassage(library, "30.1").passage.id, "30.1");
  assert.equal(findPassage(library, "9 2").status, "invalid");
  assert.equal(findPassage(library, "").status, "invalid");
  assert.equal(findPassage(library, "999").status, "missing");
});

test("les doublons ne révèlent jamais un passage choisi arbitrairement", () => {
  const library = prepareLibrary(data([passage("9.2", { key: "a" }), passage("9.2", { key: "b" })]));
  assert.equal(findPassage(library, "9.2").status, "ambiguous");
  assert.equal(findPassage(library, "9.2").passage, undefined);
  assert.throws(() => prepareLibrary(data([passage("9.2"), passage("9.2")])));
});

test("les alias sont validés et ne remplacent jamais une destination existante", () => {
  const library = prepareLibrary({ ...data([passage("D.I.7")]), aliases: { "D1.7": "D.I.7" } });
  assert.equal(findPassage(library, "d1,7").id, "D.I.7");
  assert.throws(() => prepareLibrary({ ...data([passage("1")]), aliases: { "2": "3" } }));
  assert.throws(() => prepareLibrary({ ...data([passage("1")]), aliases: { "1": "1" } }));
});

test("les renvois non explicites ou mal positionnés restent du texte", () => {
  const p = passage("1", { text: "Aller à 9.2. Carte 30.10.", references: [
    { detection: "explicit", raw_id: "9.2", text_offset: 8 },
    { detection: "identifier_in_text", raw_id: "30.10", text_offset: 19 },
    { detection: "explicit", raw_id: "9.2", text_offset: 0 },
    { detection: "explicit", raw_id: "9.2", text_offset: 8 },
  ] });
  const parts = passageParts(p);
  assert.equal(parts.map(p => p.text).join(""), p.text);
  assert.deepEqual(parts.filter(p => p.target).map(p => p.target), ["9.2"]);
});

test("les bibliothèques incompatibles sont refusées", () => {
  for (const value of [null, {}, data([]), data([passage(9.2)]), data([passage("1", { text: "" })])]) {
    assert.throws(() => prepareLibrary(value));
  }
});

test("les symboles avant un renvoi ne décalent pas sa position Unicode", () => {
  const p = passage("1", { text: "🧠 → 9.2", references: [
    { detection: "explicit", raw_id: "9.2", text_offset: 4 },
  ] });
  assert.deepEqual(passageParts(p).filter(p => p.target), [{ text: "9.2", target: "9.2" }]);
  assert.equal(passageParts(p).map(p => p.text).join(""), p.text);
});

// La bibliothèque réelle reste facultative et exclue de Git.
const file = new URL("../.local/sleeping-gods-fr/passages.json", import.meta.url);
let source;
try { source = JSON.parse(await readFile(file, "utf8")); } catch (error) {
  if (error.code !== "ENOENT") throw error;
}
test("bibliothèque complète : aucun contenu perdu dans le rendu des renvois", { skip: !source }, () => {
  const library = prepareLibrary(source);
  assert.equal(library.passages.size, 1000);
  assert.equal(findPassage(library, "9,2").status, "found");
  assert.equal(findPassage(library, "D1.7").id, "D.I.7");
  assert.deepEqual(passageParts(findPassage(library, "9.1").passage).filter(p => p.target).map(p => p.target), ["9.2", "9.3"]);
  for (const id of ["159", "159.1", "159.2", "159.3", "159.4", "70.8", "F13"]) {
    assert.equal(findPassage(library, id).status, "missing");
  }
  for (const p of library.passages.values()) {
    const parts = passageParts(p);
    assert.equal(parts.map(part => part.text).join(""), p.text, p.id);
    assert.equal(parts.filter(part => part.target).length, p.references.filter(r => r.detection === "explicit").length, p.id);
    const flowing = passageParts(p, { reflow: true });
    assert.equal(flowing.map(part => part.text).join("").replace(/\s/g, ""), p.text.replace(/\s/g, ""), p.id);
    assert.deepEqual(flowing.filter(part => part.target), parts.filter(part => part.target), p.id);
  }
});
