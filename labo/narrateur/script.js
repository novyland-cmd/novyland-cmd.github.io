import { prepareLibrary, findPassage, passageParts, libraryLabel, reflowText } from "./library.mjs?v=20261025-5";
import { SpeechReader } from "./speech.mjs?v=20261023-9";
import { RemoteAudioReader, ELEVENLABS_VOICES, audioEndpoint } from "./remote-audio.mjs?v=20261024-2";
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
let spokenPassage = null;
let availableVoices = [];
const deviceSpeech = new SpeechReader(window.speechSynthesis, window.SpeechSynthesisUtterance, () => updateSpeechControls());
const remoteSpeech = new RemoteAudioReader({ getToken: requestGenerationCode, onState: () => updateSpeechControls() });
let speech = deviceSpeech;
let generationCode = "";
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
  spokenPassage = null;
  deviceSpeech.stop();
  remoteSpeech.stop();
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
  if (Array.isArray(passage.printed_pages) && passage.printed_pages.length) {
    $("passage-source").textContent += ` · Page ${passage.printed_pages.join(", ")} du livret`;
  }
  if (passage.conversion_note) $("passage-source").textContent += ` · Note de conversion : ${passage.conversion_note}`;
  renderPassageText(passage);
  $("reading-placeholder").hidden = true;
  $("passage").hidden = false;
  $("hide-passage").disabled = false;
  spokenPassage = passage;
  $("speech-mode").value = "full";
  $("speech-mode").querySelector('[value="narration"]').disabled = speech === remoteSpeech || !hasNarration();
  refreshSelect($("speech-mode"));
  $("speech-mode-help").hidden = speech !== remoteSpeech && hasNarration();
  updateSpeechControls();
  feedback(`Paragraphe ${passage.id} affiché.`);
  $("passage-title").focus({ preventScroll: true });
  $("reading-area").scrollIntoView({ block: "start", behavior: "instant" });
}

function renderPassageText(passage) {
  const fragment = document.createDocumentFragment();
  let links = 0;
  for (const part of passageParts(passage, { reflow: library.language.split(/[-_]/)[0] === "fr" })) {
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
  refreshVoices();
  feedback();
  const name = libraryLabel(library);
  $("library-title").textContent = name;
  $("library-status").textContent = `${library.passages.size.toLocaleString("fr-CA")} passages prêts à lire.${library.partial ? " Bibliothèque partielle de test." : ""}`;
  $("game-name").textContent = name;
  $("game-name").hidden = false;
  activeCatalogId = catalogId;
  $("library-select").value = catalogId;
  refreshSelect($("library-select"));
  $("library-help").textContent = library.partial
    ? "Extrait de test : certains passages et renvois sont absents. Les mentions « sur cette page » désignent le livret physique ; les autocollants ne sont pas suivis par l’application."
    : "Choisissez un numéro pour commencer. Aucun passage ne s’affiche automatiquement.";
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
  if (event.key === "Escape" && !dialog.open && !$("audio-access-dialog").open && !$("passage").hidden) {
    conceal({ manual: true });
    feedback("Texte masqué.");
    input.focus({ preventScroll: true });
  }
});
input.addEventListener("focus", () => {
  input.value = "";
  feedback();
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

function hasNarration() {
  return spokenPassage?.narration_verified === true &&
    typeof spokenPassage.narration_text === "string" && spokenPassage.narration_text.trim().length > 0;
}

function updateSpeechControls() {
  const active = ["playing", "paused", "loading"].includes(speech.state);
  const ready = speech.supported && spokenPassage && availableVoices.length > 0;
  const playing = speech.state === "playing";
  const action = playing ? "Mettre en pause" : speech.state === "paused" ? "Reprendre" : "Lire";
  $("speech-toggle").disabled = speech.state === "loading" || (!ready && !active);
  $("speech-toggle").setAttribute("aria-label", action);
  $("speech-toggle").title = action;
  $("speech-play-icon").toggleAttribute("hidden", playing);
  $("speech-pause-icon").toggleAttribute("hidden", !playing);
  $("speech-stop").disabled = !active;
  $("speech-voice").disabled = !speech.supported || !availableVoices.length || active;
  $("speech-rate").disabled = !speech.supported || active;
  $("speech-mode").disabled = !speech.supported || !spokenPassage || active;
  for (const id of ["speech-voice", "speech-rate", "speech-mode"]) refreshSelect($(id));
  $("speech-status").textContent = !speech.supported ? "La lecture vocale n’est pas disponible dans ce navigateur." :
    !spokenPassage ? "Affichez un passage pour démarrer la lecture." :
    !availableVoices.length ? "Aucune voix disponible dans la langue de ce livret. Ajoutez une voix dans les réglages de votre appareil, puis revenez ici." :
    ({ loading: "Préparation de l’audio… Un nouvel enregistrement peut prendre quelques secondes.",
       ready: "L’audio est prêt. Appuyez sur Lire pour l’écouter.",
       playing: "Lecture en cours…", paused: "Lecture en pause.", finished: "Lecture terminée.",
       error: speech === remoteSpeech ? remoteSpeech.message : "La lecture a été interrompue par l’appareil. Réessayez ou choisissez une autre voix." })[speech.state] || "Prêt à lire le passage affiché.";
  if (remoteSpeech.accessDenied) { generationCode = ""; remoteSpeech.accessDenied = false; }
}

function refreshVoices() {
  const previous = availableVoices[Number($("speech-voice").value)];
  const lang = (library?.language || "fr").split(/[-_]/)[0].toLowerCase();
  availableVoices = deviceSpeech.supported ? deviceSpeech.synth.getVoices()
    .filter(voice => voice.lang.split(/[-_]/)[0].toLowerCase() === lang)
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name, "fr")) : [];
  if (remoteSpeech.supported) availableVoices.unshift(...ELEVENLABS_VOICES.map(voice => ({ ...voice, lang })));
  const select = $("speech-voice");
  select.replaceChildren();
  availableVoices.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = voice.provider === "elevenlabs" ? voice.name : `${voice.name} (${voice.lang})${voice.localService ? "" : " · en ligne"}`;
    select.append(option);
  });
  if (!availableVoices.length) {
    const option = document.createElement("option");
    option.textContent = "Aucune voix disponible";
    select.append(option);
  } else {
    const index = availableVoices.findIndex(voice => voice.voiceURI === previous?.voiceURI && voice.lang === previous?.lang);
    select.value = String(Math.max(0, index));
  }
  selectSpeechEngine();
}

$("speech-toggle").addEventListener("click", () => {
  if (speech.state === "playing") { speech.pause(); return; }
  if (speech.state === "paused") { speech.resume(); return; }
  if (speech.state === "ready") { remoteSpeech.playReady(); return; }
  if (!spokenPassage) return;
  const voice = availableVoices[Number($("speech-voice").value)];
  if (!voice) return;
  if (voice.provider === "elevenlabs") {
    remoteSpeech.start({ library: activeCatalogId, passage: spokenPassage.id, voice: voice.alias }, Number($("speech-rate").value), reflowText(spokenPassage.text));
    return;
  }
  const text = $("speech-mode").value === "narration" && hasNarration() ? spokenPassage.narration_text : spokenPassage.text;
  speech.start(reflowText(text), { voice, lang: library.language, rate: Number($("speech-rate").value) });
});
$("speech-stop").addEventListener("click", () => speech.stop());
$("speech-voice").addEventListener("change", () => { speech.stop(); selectSpeechEngine(); });
for (const id of ["speech-rate", "speech-mode"]) $(id).addEventListener("change", () => speech.stop());
window.addEventListener("pagehide", () => { speech.stop(); generationCode = ""; });
window.addEventListener("beforeunload", () => speech.stop());
window.addEventListener("focus", refreshVoices);
deviceSpeech.synth?.addEventListener("voiceschanged", refreshVoices);
refreshVoices();

function selectSpeechEngine() {
  const selected = availableVoices[Number($("speech-voice").value)];
  const engine = selected?.provider === "elevenlabs" ? remoteSpeech : deviceSpeech;
  if (engine !== speech) { speech.stop(); speech = engine; }
  $("speech-mode").value = "full";
  $("speech-mode").querySelector('[value="narration"]').disabled = speech === remoteSpeech || !hasNarration();
  updateSpeechControls();
}

function requestGenerationCode(signal) {
  if (signal.aborted) return Promise.resolve(null);
  if (generationCode) return Promise.resolve(generationCode);
  const access = $("audio-access-dialog");
  const code = $("audio-access-code");
  return new Promise(resolve => {
    const cancel = () => { if (access.open) access.close("cancel"); };
    access.addEventListener("close", () => {
      signal.removeEventListener("abort", cancel);
      const result = access.returnValue === "generate" && !signal.aborted ? code.value.trim() : "";
      code.value = "";
      if (result) generationCode = result;
      resolve(result || null);
    }, { once: true });
    code.value = "";
    access.returnValue = "";
    signal.addEventListener("abort", cancel, { once: true });
    access.showModal();
    code.focus();
  });
}

fetch("./audio-config.json", { cache: "no-store" })
  .then(response => { if (!response.ok) throw new Error("configuration"); return response.json(); })
  .then(config => {
    remoteSpeech.endpoint = audioEndpoint(config.endpoint);
    if (remoteSpeech.supported) {
      $("elevenlabs-note").textContent = "Patrick et Anna : les enregistrements existants sont réutilisés. Un code privé autorise les nouvelles générations.";
      refreshVoices();
    }
  })
  .catch(() => { /* Les voix de l'appareil restent utilisables. */ });
