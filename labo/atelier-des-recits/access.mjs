import { authorizationEndpoint, authorizationKey, verifyAuthorization } from "./authorization.mjs?v=20261027-2";

const $ = id => document.getElementById(id);
let endpoint = "";
let attempt = 0;
let loading = false;

const configuration = fetch("./audio-config.json", { cache: "no-store" })
  .then(async response => {
    if (!response.ok) throw new Error("Le service d’autorisation est indisponible.");
    endpoint = authorizationEndpoint((await response.json()).endpoint);
    if (!endpoint) throw new Error("Le service d’autorisation n’est pas configuré.");
  });

function lock(message = "L’atelier est verrouillé. Vos brouillons sont conservés.") {
  attempt++;
  for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  $("atelier-app").hidden = true;
  $("atelier-gate").hidden = false;
  $("access-code").value = "";
  $("access-status").textContent = message;
  $("access-code").focus({ preventScroll: true });
}

async function unlock(code, remember) {
  if (loading) return;
  loading = true;
  const currentAttempt = ++attempt;
  $("unlock-access").disabled = true;
  $("access-status").textContent = "Vérification de l’autorisation…";
  try {
    await configuration;
    await verifyAuthorization(endpoint, code);
    if (currentAttempt !== attempt) return;
    let remembered = false;
    try {
      if (remember) { localStorage.setItem(authorizationKey(endpoint), code); remembered = true; }
      else localStorage.removeItem(authorizationKey(endpoint));
    } catch { /* L’édition reste possible pour la session sans stockage. */ }
    $("access-code").value = "";
    await import("./script.mjs?v=20261027-2");
    if (currentAttempt !== attempt) return;
    $("session-status").textContent = remembered ? "Autorisation conservée sur cet appareil" : "Autorisation pour cette session";
    $("atelier-gate").hidden = true;
    $("atelier-app").hidden = false;
    $("access-status").textContent = "";
    if (remember && !remembered) $("session-status").textContent = "Autorisation pour cette session · mémorisation indisponible";
  } catch (error) {
    if (currentAttempt !== attempt) return;
    if (error.accessDenied) {
      try { localStorage.removeItem(authorizationKey(endpoint)); } catch { /* Facultatif. */ }
    }
    $("access-code").value = "";
    $("access-status").textContent = error.message || "Impossible d’ouvrir l’atelier. Réessayez.";
  } finally {
    loading = false;
    $("unlock-access").disabled = false;
  }
}

$("access-form").addEventListener("submit", event => {
  event.preventDefault();
  unlock($("access-code").value.trim(), $("remember-access").checked);
});
$("lock-access").addEventListener("click", () => lock());
$("forget-access").addEventListener("click", () => {
  try { localStorage.removeItem(authorizationKey(endpoint)); }
  catch { lock("Le navigateur ne permet pas d’effacer l’autorisation enregistrée. Effacez les données du site dans ses réglages."); return; }
  $("remember-access").checked = false;
  lock("Autorisation effacée sur cet appareil. Vos brouillons sont conservés.");
});
window.addEventListener("storage", event => {
  if (event.key === authorizationKey(endpoint) || event.key === null) lock("L’autorisation a changé dans un autre onglet. Ouvrez à nouveau l’atelier pour la vérifier.");
});
window.addEventListener("pagehide", () => lock());

try {
  await configuration;
  let saved = "";
  try { saved = localStorage.getItem(authorizationKey(endpoint)) || ""; } catch { /* Saisie manuelle. */ }
  if (saved) { $("remember-access").checked = true; await unlock(saved, true); }
} catch (error) { $("access-status").textContent = error.message; }
