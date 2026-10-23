import { prepareLibrary, findPassage, passageParts, libraryLabel } from "./library.mjs?v=20261023-4";
import { refreshSelect } from "../../assets/js/select.js?v=20260905";

const $ = id => document.getElementById(id);
const input = $("paragraph-id");
const dialog = $("reference-dialog");
let library = null;
let pendingReference = null;
let loadVersion = 0;
let libraryLoading = false;
let activeCatalogId = "";
const catalog = new Map();
let fontSize = 20;
try {
  const saved = Number(localStorage.getItem("narrateur-font-size"));
  if (Number.isInteger(saved) && saved >= 16 && saved <= 32) fontSize = saved;
} catch { /* Le lecteur reste utilisable sans stockage. */ }

function feedback(text = "", error = false) {
  $("search-feedback").textContent = text;
  $("search-feedback").classList.toggle("error", error);
  if (error) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function conceal({ manual = false } = {}) {
  if (dialog.open) dialog.close("cancel");
  pendingReference = null;
  $("passage").hidden = true;
  $("passage-text").replaceChildren();
  $("passage-title").textContent = "";
  $("passage-number").textContent = "";
  $("passage-source").textContent = "";
  $("reference-note").hidden = true;
  $("reading-placeholder").hidden = false;
  $("placeholder-title").textContent = manual ? "Le passage est masqué." : "L’histoire attend votre numéro.";
  $("placeholder-text").textContent = manual ? "Appuyez sur Afficher pour le relire." : "Seul le passage demandé apparaîtra ici.";
  $("hide-passage").disabled = true;
}

function displayPassage(value) {
  if (libraryLoading) {
    feedback("Votre bibliothèque est en cours de chargement.");
    return;
  }
  conceal();
  if (!library) {
    feedback("Choisissez d’abord une bibliothèque de jeu.", true);
    return;
  }
  const result = findPassage(library, value);
  if (result.status !== "found") {
    const message = result.status === "invalid" ? "Saisissez un numéro de paragraphe, par exemple 9.2." :
      result.status === "ambiguous" ? `Plusieurs passages portent le numéro ${result.id}. Impossible de choisir sans vérification du livret.` :
        `Le paragraphe ${result.id} n’existe pas dans cette bibliothèque. Vérifiez le numéro dans votre livret.`;
    feedback(message, true);
    input.focus();
    return;
  }
  const passage = result.passage;
  input.value = result.id;
  $("passage-number").textContent = `Paragraphe ${passage.id}`;
  $("passage-title").textContent = passage.title || `Passage ${passage.id}`;
  const pages = Array.isArray(passage.source_pages) ? passage.source_pages.filter(Number.isInteger) : [];
  $("passage-source").textContent = pages.length ? `Livret d’aventure · ${pages.length > 1 ? "Pages" : "Page"} ${pages.join(", ")} du PDF` : "";
  const fragment = document.createDocumentFragment();
  let links = 0;
  for (const part of passageParts(passage)) {
    if (part.target) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reference-link";
      button.textContent = part.text;
      button.setAttribute("aria-label", `Ouvrir le paragraphe ${part.target} après confirmation`);
      button.addEventListener("click", () => confirmReference(part.target));
      fragment.append(button);
      links++;
    } else fragment.append(document.createTextNode(part.text));
  }
  $("passage-text").replaceChildren(fragment);
  $("reference-note").hidden = !links;
  $("reading-placeholder").hidden = true;
  $("passage").hidden = false;
  $("hide-passage").disabled = false;
  feedback(`Paragraphe ${passage.id} affiché.`);
  $("passage-title").focus({ preventScroll: true });
  $("passage").scrollIntoView({ block: "start", behavior: "instant" });
}

function confirmReference(id) {
  // Ni le titre ni le contenu de la destination ne sont rendus avant confirmation.
  const result = findPassage(library, id);
  const found = result.status === "found";
  pendingReference = found ? result.id : null;
  $("dialog-title").textContent = found ? `Ouvrir le paragraphe ${id} ?` : "Ce passage est indisponible";
  $("dialog-description").textContent = found ?
    "Le passage actuel sera remplacé. Continuez seulement si votre choix dans le jeu vous conduit à ce numéro." :
    result.status === "ambiguous" ? `Le numéro ${id} correspond à plusieurs passages. Consultez votre livret pour poursuivre.` :
      `Le paragraphe ${id} est absent de cette bibliothèque. Consultez votre livret pour poursuivre.`;
  $("confirm-reference").hidden = !found;
  dialog.returnValue = "";
  dialog.showModal();
}

dialog.addEventListener("close", () => {
  const id = pendingReference;
  pendingReference = null;
  if (dialog.returnValue === "open" && id) displayPassage(id);
});

function installLibrary(data, catalogId) {
  const prepared = prepareLibrary(data);
  library = prepared;
  conceal();
  feedback();
  const name = libraryLabel(library);
  $("library-title").textContent = name;
  $("library-status").textContent = `${library.passages.size.toLocaleString("fr-CA")} passages prêts à lire.`;
  $("game-name").textContent = name;
  $("game-name").hidden = false;
  activeCatalogId = catalogId;
  $("library-select").value = catalogId;
  refreshSelect($("library-select"));
  $("library-help").textContent = "Choisissez un numéro pour commencer. Aucun passage ne s’affiche automatiquement.";
  $("library-error").hidden = true;
  $("show-passage").disabled = false;
}

$("passage-form").addEventListener("submit", event => {
  event.preventDefault();
  displayPassage(input.value);
});
$("hide-passage").addEventListener("click", () => {
  conceal({ manual: true });
  feedback("Texte masqué.");
  input.focus({ preventScroll: true });
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !dialog.open && !$("passage").hidden) {
    conceal({ manual: true });
    feedback("Texte masqué.");
    input.focus({ preventScroll: true });
  }
});
input.addEventListener("input", () => feedback());

function updateFontSize(delta = 0) {
  fontSize = Math.min(32, Math.max(16, fontSize + delta));
  $("passage-text").style.setProperty("--passage-font-size", `${fontSize}px`);
  $("font-size").textContent = `${fontSize} px`;
  $("font-smaller").disabled = fontSize === 16;
  $("font-larger").disabled = fontSize === 32;
  try { localStorage.setItem("narrateur-font-size", String(fontSize)); } catch { /* facultatif */ }
}
$("font-smaller").addEventListener("click", () => updateFontSize(-2));
$("font-larger").addEventListener("click", () => updateFontSize(2));
updateFontSize();

$("library-select").addEventListener("change", async event => {
  const entry = catalog.get(event.target.value);
  if (!entry) return;
  const version = ++loadVersion;
  libraryLoading = true;
  conceal();
  feedback();
  $("show-passage").disabled = true;
  $("library-status").textContent = "Chargement du livret…";
  $("library-error").hidden = true;
  try {
    const response = await fetch(`./libraries/${entry.file}`);
    if (!response.ok) throw new Error("Livret indisponible");
    const data = await response.json();
    if (version === loadVersion) installLibrary(data, entry.id);
  } catch {
    if (version !== loadVersion) return;
    $("library-status").textContent = library ? "La bibliothèque précédente reste disponible." : "Aucune bibliothèque chargée.";
    $("library-select").value = activeCatalogId;
    refreshSelect($("library-select"));
    $("library-error").textContent = "Impossible de charger ce livret. Réessayez ou choisissez une autre bibliothèque.";
    $("library-error").hidden = false;
    $("show-passage").disabled = !library;
  } finally {
    if (version === loadVersion) libraryLoading = false;
  }
});

fetch("./libraries/catalog.json", { cache: "no-store" })
  .then(response => { if (!response.ok) throw new Error("Catalogue indisponible"); return response.json(); })
  .then(entries => {
    if (!Array.isArray(entries)) throw new Error("Catalogue incompatible");
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string" ||
          typeof entry.label !== "string" || !/^[a-z0-9-]+\.json$/.test(entry.file)) continue;
      catalog.set(entry.id, entry);
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      $("library-select").append(option);
    }
    $("library-select").disabled = catalog.size === 0;
  })
  .catch(() => {
    $("library-help").textContent = "La liste des livrets est indisponible. Réessayez en rechargeant la page.";
  });
