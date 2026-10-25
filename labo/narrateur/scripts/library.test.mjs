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
  assert.equal(libraryLabel(prepareLibrary({ ...source, game_id: "cozy-sticker-ville", language: "fr" })), "Cozy Sticker Ville · Français");
});

const cozy = JSON.parse(await readFile(new URL("../libraries/cozy-sticker-ville-fr.json", import.meta.url), "utf8"));
const cozyLibrary = prepareLibrary(cozy);
const cozyPassage = id => findPassage(cozyLibrary, id).passage;

test("Cozy Sticker Ville : 236 entrées principales et 293 résultats autonomes", () => {
  assert.equal(cozyLibrary.partial, false);
  assert.equal(cozyLibrary.passages.size, 529);
  const roots = cozy.passages.filter(p => !p.parent_id);
  const results = cozy.passages.filter(p => p.parent_id);
  assert.equal(roots.length, 236);
  assert.equal(results.length, 293);
  assert.equal(cozy.source.pdf_page_count, 31);
  for (const p of cozy.passages) {
    assert.equal(p.choices, undefined);
    assert.equal(p.choice_references, undefined);
    assert.ok(p.text.trim());
    if (p.parent_id) {
      assert.ok(cozyPassage(p.parent_id));
      assert.ok(!/^([A-D]\. |• )/.test(p.text), p.id);
    }
    const page = Number((p.parent_id ?? p.id).split(".")[0]);
    assert.deepEqual(p.source_pages, (p.parent_id ?? p.id) === "18.7" ? [13, 14] : [page - 5]);
  }
});

test("un résultat ne répète ni la question ni les autres résultats", () => {
  const parent = cozyPassage("12.2");
  const a = cozyPassage("12.2A");
  const b = cozyPassage("12.2B");
  assert.match(parent.text, /Lors du mariage/);
  assert.ok(!parent.text.includes("embrasser la mariée"));
  assert.ok(!parent.text.includes("Alex est dévasté"));
  assert.match(a.text, /^« Vous pouvez maintenant embrasser/);
  assert.ok(!a.text.includes("Lors du mariage"));
  assert.ok(!a.text.includes("Alex est dévasté"));
  assert.match(b.text, /^Denise se jette/);
  assert.ok(!b.text.includes("Lors du mariage"));
  assert.deepEqual(passageParts(parent).filter(p => p.target), [
    { text: "A", target: "12.2A" }, { text: "B", target: "12.2B" },
  ]);
  assert.equal(findPassage(cozyLibrary, "12,2a").passage, a);
  assert.equal(findPassage(cozyLibrary, "15.10").status, "found");
  assert.notEqual(cozyPassage("15.1").text, cozyPassage("15.10").text);
});

test("tous les renvois utilisent la même mécanique, sans destination absente", () => {
  let links = 0;
  for (const passage of cozy.passages) {
    const parts = passageParts(passage, { reflow: true });
    assert.equal(parts.map(p => p.text).join(""), reflowText(passage.text), passage.id);
    assert.equal(parts.filter(p => p.target).length, passage.references.length, passage.id);
    for (const ref of passage.references) {
      links++;
      assert.equal(findPassage(cozyLibrary, ref.target_id).status, "found", ref.target_id);
      assert.equal(ref.status, "resolved");
    }
  }
  assert.equal(links, 355);
  assert.deepEqual(passageParts(cozyPassage("16.7")).filter(p => p.target).map(p => p.target), ["9.9A", "9.9B", "9.9C", "9.9"]);
  assert.match(cozyPassage("18.7B").text, /vieux Bosco/);
  assert.ok(!cozyPassage("18.7B").text.includes("Sauveur d’animaux"));
  assert.deepEqual(passageParts(cozyPassage("8.6B")).filter(p => p.target).map(p => p.target), ["8.6A"]);
});

test("les groupes de la Loge et les choix Oui/Non ont des identifiants distincts", () => {
  const lodge = passageParts(cozyPassage("7.2")).filter(p => p.target).map(p => p.target);
  assert.deepEqual(lodge, ["7.2G1C", "7.2G1D", "7.2G2A", "7.2G2B", "7.2G4A", "7.2G4B"]);
  assert.match(cozyPassage("7.2G2A").text, /ouvrir votre esprit/);
  assert.ok(!cozyPassage("7.2G2A").text.includes("poignée de main"));
  assert.deepEqual(passageParts(cozyPassage("14.4")).filter(p => p.target), [
    { text: "Oui", target: "14.4OUI" }, { text: "Non", target: "14.4NON" },
  ]);
  assert.match(cozyPassage("14.4OUI").text, /injection est faite/);
  assert.ok(!cozyPassage("14.4OUI").text.includes("testerai sur mon mari"));
});

test("les quantités et plages de dés ouvrent leur seul résultat", () => {
  for (const id of ["13.2", "13.4"]) {
    const parent = cozyPassage(id);
    assert.deepEqual(passageParts(parent).filter(p => p.target).map(p => p.target), [0, 1, 2, 3].map(n => `${id}N${n}`));
    assert.ok(!parent.text.includes("Recevez"));
    for (let n = 0; n <= 3; n++) {
      const result = cozyPassage(`${id}N${n}`);
      assert.ok(!result.text.includes("Combien pouvons"));
      const reward = [null, "2 pièces d’or", "3 pièces d’or", "5 pièces d’or"][n];
      if (reward) assert.ok(result.text.includes(`Recevez ${reward}`));
      else assert.match(result.text, /Effectuez une autre action/);
    }
  }
  assert.ok(!cozyPassage("26.6").text.includes("brownies"));
  assert.match(cozyPassage("26.6R1A3").text, /brownies/);
  assert.match(cozyPassage("35.1").text, /Dé 6 : 1 nourriture → Raie pastenague/);
  assert.match(cozyPassage("36.1").text, /Dé 6 : 1 nourriture → Poisson-zèbre/);
  assert.match(cozyPassage("31.1").text, /Au moins 3 icônes Hache/);
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
