import { isValidId, normalizeId, prepareLibrary } from "./library.mjs?v=20261027-2";

// Même format que les sauvegardes du fichier Atelier des récits fourni.
export const ATELIER_KEY = "atelier-recits-v1";
const clone = value => JSON.parse(JSON.stringify(value));
export const makeEntry = (id, title = "", body = "", choices = []) =>
  ({ id, title, body, choices, tags: "", notes: "", status: "Brouillon" });

export function validLibrary(library) {
  return Boolean(library && typeof library.id === "string" && library.id &&
    typeof library.name === "string" && typeof library.description === "string" &&
    Array.isArray(library.entries) && library.entries.length <= 20000 &&
    library.entries.every(e => e && typeof e.id === "string" && e.id.trim() &&
      typeof e.title === "string" && typeof e.body === "string" &&
      ["tags", "notes", "links", "status"].every(key => e[key] == null || typeof e[key] === "string") &&
      Array.isArray(e.choices) && e.choices.every(c => c && typeof c.label === "string" && typeof c.target === "string")) &&
    new Set(library.entries.map(e => e.id)).size === library.entries.length);
}

export function validDB(db) {
  return Boolean(db && db.version === 1 && Array.isArray(db.libraries) &&
    db.libraries.every(validLibrary) && new Set(db.libraries.map(l => l.id)).size === db.libraries.length);
}

export function readDrafts(storage = globalThis.localStorage) {
  const raw = storage.getItem(ATELIER_KEY);
  if (!raw) return { version: 1, libraries: [] };
  let db;
  try {
    db = JSON.parse(raw);
    if (!validDB(db)) throw new Error("format");
  } catch {
    const error = new Error("La sauvegarde de l’atelier est illisible. Elle n’a pas été modifiée.");
    error.invalidDrafts = true;
    throw error;
  }
  return db;
}

export function fromNarrator(data, { id = crypto.randomUUID(), name } = {}) {
  prepareLibrary(data);
  const entries = data.passages.map(p => ({
    ...makeEntry(p.id, p.title || "", p.text, clone(p.editor?.choices || [])),
    tags: p.editor?.tags || "", notes: p.editor?.notes || "", status: p.editor?.status || "Brouillon",
    links: p.editor?.links ?? [...new Set((p.references || []).map(r => r.target_id || r.raw_id).filter(Boolean))].join(", "),
    sourcePassage: clone(p),
  }));
  const metadata = clone(data);
  delete metadata.passages;
  const library = { id, name: name || data.title || data.name || data.game_id,
    description: data.description || "Copie de travail locale du Narrateur.", color: "", language: data.language || "fr",
    updated: new Date().toISOString(), sourceMetadata: metadata, entries };
  if (!validLibrary(library)) throw new Error("Les identifiants des passages doivent être uniques pour être édités.");
  return library;
}

export function normalizeImport(data) {
  if (validDB(data)) return data;
  return { version: 1, libraries: [fromNarrator(data)] };
}

// Les offsets sont comptés en points Unicode, comme ceux des bibliothèques du lecteur.
export function detectedReferences(text) {
  const refs = [];
  const pattern = /(?:\[livre\]|📖|(?:allez|aller|rendez-vous|retournez|go|return)(?:\s+(?:au|à|to|paragraphe|paragraph|section|passage|l’entrée|l’entrée))*|(?:paragraphe|paragraph|passage)|→)\s+([A-Z0-9]+(?:[.,][A-Z0-9]+)*)/giu;
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    const target = normalizeId(raw);
    if (!isValidId(target)) continue;
    const start = match.index + match[0].lastIndexOf(raw);
    // Les titres « Passage 1 — … » ne sont pas des renvois.
    if (/^passage\b/i.test(match[0]) && /^\s*[—–]/.test(text.slice(start + raw.length)) &&
        !text.slice(text.lastIndexOf("\n", match.index - 1) + 1, match.index).trim()) continue;
    refs.push({ raw_id: raw, target_id: target, detection: "explicit", text_offset: Array.from(text.slice(0, start)).length });
  }
  return refs;
}

export function entryReferences(entry) {
  return [...new Set([
    ...detectedReferences(entry.body).map(r => r.target_id),
    ...(entry.links || "").split(",").map(s => s.trim()).filter(Boolean),
    ...entry.choices.map(c => c.target).filter(Boolean),
  ])];
}

export function toNarrator(library) {
  if (!validLibrary(library)) throw new Error("Cette bibliothèque d’édition est invalide.");
  const ids = new Set(library.entries.map(e => normalizeId(e.id)));
  if (ids.size !== library.entries.length) throw new Error("Plusieurs identifiants correspondent au même numéro dans le Narrateur.");
  const metadata = clone(library.sourceMetadata || {});
  const passages = library.entries.map(e => {
    const id = normalizeId(e.id);
    if (!isValidId(id)) throw new Error(`L’identifiant « ${e.id} » n’est pas compatible avec le Narrateur. Utilisez par exemple 1, 9.2, F17 ou 12.2A.`);
    if (!e.body.trim()) throw new Error(`Le passage ${e.id} est vide. Ajoutez son texte avant de le lire ou de l’exporter pour le Narrateur.`);
    const source = clone(e.sourcePassage || {});
    // Les choix restent structurés pour l’édition et sont rendus séparément par le lecteur.
    const unchanged = source.text === e.body;
    const references = unchanged && Array.isArray(source.references) ? source.references : detectedReferences(e.body);
    const result = { ...source, id, key: id, title: e.title, text: e.body, references,
      editor: { choices: clone(e.choices), tags: e.tags || "", notes: e.notes || "", links: e.links || "", status: e.status || "Brouillon" } };
    if (!unchanged) { delete result.narration_text; result.narration_verified = false; }
    return result;
  });
  const aliases = Object.fromEntries(Object.entries(metadata.aliases || {}).filter(([alias, target]) => !ids.has(alias) && ids.has(target)));
  const result = { ...metadata, schema_version: 1, game_id: metadata.game_id || library.name,
    title: library.name, description: library.description, language: library.language || metadata.language || "fr", aliases, passages };
  prepareLibrary(result);
  return result;
}

export function validateEntryId(library, value, entry = null) {
  const id = normalizeId(value);
  if (!isValidId(id) || library.entries.some(e => e !== entry && normalizeId(e.id) === id)) {
    throw new Error("Identifiant invalide ou déjà utilisé. Exemples : 1, 9.2, F17 ou 12.2A.");
  }
  return id;
}

export function renameEntry(library, entry, value) {
  const id = validateEntryId(library, value, entry);
  const old = entry.id;
  entry.id = id;
  for (const e of library.entries) {
    for (const c of e.choices) if (normalizeId(c.target) === normalizeId(old)) c.target = id;
    e.links = (e.links || "").split(",").map(s => normalizeId(s) === normalizeId(old) ? id : s.trim()).filter(Boolean).join(", ");
    const original = e.sourcePassage?.text === e.body ? e.sourcePassage.references || [] : [];
    const refs = [...new Map([...original, ...detectedReferences(e.body)]
      .filter(r => r.target_id === normalizeId(old) && Number.isInteger(r.text_offset) &&
        Array.from(e.body).slice(r.text_offset, r.text_offset + Array.from(r.raw_id).length).join("") === r.raw_id)
      .map(r => [r.text_offset, r])).values()].sort((a, b) => b.text_offset - a.text_offset);
    for (const ref of refs) {
      const chars = Array.from(e.body);
      chars.splice(ref.text_offset, Array.from(ref.raw_id).length, ...id);
      e.body = chars.join("");
    }
    // Invalider les offsets d’origine pour les recalculer après le renommage.
    if (e.sourcePassage?.references) {
      e.sourcePassage.references = e.sourcePassage.references.map(r => r.target_id === old ? { ...r, target_id: id } : r);
    }
    if (e.sourcePassage?.parent_id === old) e.sourcePassage.parent_id = id;
  }
  const aliases = library.sourceMetadata?.aliases;
  if (aliases) for (const key of Object.keys(aliases)) if (aliases[key] === old) aliases[key] = id;
  return id;
}
