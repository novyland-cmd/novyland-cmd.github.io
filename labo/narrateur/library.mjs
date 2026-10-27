// Contrat de données indépendant du DOM. Les identifiants restent des chaînes.
export function normalizeId(value) {
  return String(value).trim().replace(/\s*[.,]\s*/g, ".").toUpperCase();
}

export function isValidId(id) {
  return /^(?:\d+(?:\.\d+)?(?:[A-Z][A-Z0-9]*)?|[A-Z]\d+|D\d+\.\d+|D\.I\.\d+)$/.test(id);
}

export function prepareLibrary(data) {
  if (!data || data.schema_version !== 1 || typeof data.game_id !== "string" ||
      !Array.isArray(data.passages) || !data.passages.length) {
    throw new Error("Ce fichier ne contient pas une bibliothèque compatible avec Narrateur.");
  }
  const passages = new Map();
  const lookup = new Map();
  for (const passage of data.passages) {
    if (!passage || typeof passage.id !== "string" || !isValidId(passage.id) ||
        typeof passage.key !== "string" || !passage.key || passages.has(passage.key) ||
        typeof passage.text !== "string" || !passage.text.trim() ||
        !(passage.title == null || typeof passage.title === "string")) {
      throw new Error("Un passage de cette bibliothèque est incomplet ou possède une clé répétée.");
    }
    passages.set(passage.key, passage);
    const keys = lookup.get(passage.id) ?? [];
    keys.push(passage.key);
    lookup.set(passage.id, keys);
  }
  const aliases = new Map(Object.entries(data.aliases ?? {}));
  for (const [alias, target] of aliases) {
    if (!isValidId(alias) || typeof target !== "string" || !lookup.has(target) || lookup.has(alias)) {
      throw new Error("Les variantes de numérotation de cette bibliothèque sont incohérentes.");
    }
  }
  return { gameId: data.game_id, language: typeof data.language === "string" ? data.language.trim() : "", partial: data.partial === true, passages, lookup, aliases };
}

export function libraryLabel(library) {
  const name = { "novyland": "Novyland", "sleeping-gods": "Sleeping Gods", "cozy-sticker-ville": "Cozy Sticker Ville" }[library.gameId] ?? library.gameId;
  if (!library.language) return name;
  let language = library.language;
  try {
    language = new Intl.DisplayNames(["fr"], { type: "language" }).of(library.language.replaceAll("_", "-"));
  } catch { /* Conserver le code de langue si celui-ci n'est pas reconnu. */ }
  return `${name} · ${language.charAt(0).toLocaleUpperCase("fr")}${language.slice(1)}`;
}

export function findPassage(library, input) {
  const id = normalizeId(input);
  if (!isValidId(id)) return { status: "invalid", id };
  const target = library.aliases.get(id) ?? id;
  const keys = library.lookup.get(target) ?? [];
  if (!keys.length) return { status: "missing", id };
  if (keys.length !== 1) return { status: "ambiguous", id };
  return { status: "found", id: target, passage: library.passages.get(keys[0]) };
}

// Seuls les renvois explicites et correctement positionnés sont interactifs.
// Les candidats sans verbe restent du texte. Aucune chaîne importée n'est du HTML.
export function reflowText(text) {
  const lines = text.split("\n");
  const startsBlock = /^(?:[—–]|-\s|[«“]|[A-Z]\.[ \t]|\d+[.)][ \t]|[•→➡]|\p{Extended_Pictographic}|(?:Obtenir|Obtenez|Gagner|Gagnez|Gagne|Perdre|Perdez|Perte|Retirez|Remove|Échec|Succès|Réussite|Nécessite|Indisponible|Si\b|Sinon\b|Choix\b|Retournez|Retourne)\s*[:：]?)/u;
  return lines.map((line, i) => {
    if (i === lines.length - 1) return line;
    const next = lines[i + 1].trim();
    const keepBreak = !line.trim() || !next || /[.!?…:;»”]$/.test(line.trim()) || startsBlock.test(next);
    return line + (keepBreak ? "\n" : " ");
  }).join("");
}

export function passageParts(passage, { reflow = false } = {}) {
  // Remplacer un retour par une espace conserve les positions des renvois.
  const text = reflow ? reflowText(passage.text) : passage.text;
  // Les offsets Python comptent les points Unicode ; JavaScript compte les
  // unités UTF-16. Les symboles comme 🧠 occupent deux unités dans le navigateur.
  const offsets = [0];
  for (const char of passage.text) offsets.push(offsets[offsets.length - 1] + char.length);
  const references = (Array.isArray(passage.references) ? passage.references : [])
    .filter(ref => ref && ref.detection === "explicit" && typeof ref.raw_id === "string" && ref.raw_id.length > 0 &&
      isValidId(ref.target_id ?? ref.raw_id) && Number.isInteger(ref.text_offset) && ref.text_offset >= 0 &&
      ref.text_offset < offsets.length)
    .map(ref => ({ ...ref, start: offsets[ref.text_offset] }))
    .filter(ref => passage.text.slice(ref.start, ref.start + ref.raw_id.length) === ref.raw_id)
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  const parts = [];
  for (const ref of references) {
    if (ref.start < cursor) continue;
    parts.push({ text: text.slice(cursor, ref.start) });
    parts.push({ text: ref.raw_id, target: ref.target_id ?? ref.raw_id });
    cursor = ref.start + ref.raw_id.length;
  }
  parts.push({ text: text.slice(cursor) });
  return parts;
}
