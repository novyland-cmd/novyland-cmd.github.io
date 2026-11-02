import { emptyState, canStart, chooseWinner, cleanState, roundLabel, normalizeCode, validCode, displayCode, randomCode, randomToken } from './model.mjs';
import { availableModes, MODE_INFO, startFormat, roundTitle, standings, champions } from './formats.mjs';
const titleOfRound = (state, index) => state.engineVersion === 2 ? roundTitle(state, index) : roundLabel(index, state.rounds.length);

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LOCAL_KEY = 'novytournoi.v1', OWNER_KEY = 'novytournoi.cloud.v1';
let draft = emptyState(), owners = {}, state = draft, page = 'home', mode = 'local', code = '', endpoint = '';
let busy = false, refreshing = false, conflict = false, pollTimer, requestGeneration = 0;
let syncMessage = '', syncError = false, savedMessage = '', configReady;
const owner = () => mode === 'owner' ? owners[code] : null;
const hide = (id, hidden) => $(id).classList.toggle('hidden', hidden);
const controlsLocked = () => busy || !!owner()?.pending || !!owner()?.creating || conflict;
function storageSave(ownerCode = mode === 'owner' ? code : '') {
  try {
    if (mode === 'local') localStorage.setItem(LOCAL_KEY, JSON.stringify(draft));
    if (ownerCode) {
      // A spectator or an older tab must not overwrite another tournament's access.
      const latest = JSON.parse(localStorage.getItem(OWNER_KEY) || '{}');
      localStorage.setItem(OWNER_KEY, JSON.stringify({ ...latest, [ownerCode]: owners[ownerCode] }));
    }
    savedMessage = 'Copie conservée sur cet appareil.';
    return true;
  } catch {
    savedMessage = 'Sauvegarde sur cet appareil impossible. Exportez vos données avant de fermer la page.';
    return false;
  }
}
function persistCurrent() {
  if (mode === 'local') draft = state;
  else if (mode === 'owner') owner().state = state;
  if (mode !== 'viewer') storageSave();
}
function notice(message, failed = false) { syncMessage = message; syncError = failed; renderStatus(); }
function renderStatus() {
  $('syncStatus').textContent = syncMessage;
  $('syncStatus').classList.toggle('error', syncError);
  $('storageStatus').textContent = mode === 'viewer' ? '' : savedMessage;
}
function shareURL() {
  const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('code', displayCode(code)); return url.href;
}
function setURL(value = '') {
  const url = new URL(location.href); url.searchParams.delete('code');
  if (value) url.searchParams.set('code', displayCode(value));
  history.replaceState(null, '', url);
}
function stopPolling() { clearTimeout(pollTimer); pollTimer = null; requestGeneration++; }
function goHome() {
  if (busy) return;
  persistCurrent(); stopPolling(); page = 'home'; mode = 'local'; code = ''; state = draft; setURL(); render();
}
function openLocal() {
  stopPolling(); page = 'workspace'; mode = 'local'; code = ''; state = draft; conflict = false; syncMessage = ''; setURL(); render();
}
function renderHome() {
  const items = [];
  const item = (id, title, detail) => `<li><button class="secondary resume-button" data-resume="${id}">${esc(title)} · ${detail}</button><button class="danger tiny forget-button" data-forget="${id}" aria-label="Retirer ${esc(title)} de cet appareil">Retirer de cet appareil</button></li>`;
  if (draft.players.length || draft.name || draft.started) items.push(item('local', draft.name || 'Configuration en cours', 'Sur cet appareil'));
  for (const [c, entry] of Object.entries(owners)) items.push(item(c, entry.state.name, `${displayCode(c)}${entry.pending || entry.creating ? ' · Enregistrement à terminer' : ''}`));
  $('resumeList').innerHTML = items.join(''); hide('resumePanel', !items.length);
}
function forgetTournament(id) {
  if (page !== 'home' || busy) return;
  const entry = id === 'local' ? null : owners[id];
  if (id !== 'local' && !entry) return;
  const title = id === 'local' ? draft.name || 'Configuration en cours' : entry.state.name;
  const message = id === 'local'
    ? `Retirer « ${title} » de cet appareil ? La copie locale sera effacée. Exportez-la d’abord si vous souhaitez la conserver.`
    : `Retirer « ${title} » de cet appareil ? La copie locale et l’accès organisateur seront effacés. Sauvegardez d’abord votre accès organisateur pour pouvoir gérer ce tournoi à nouveau. Les résultats déjà partagés sur Cloudflare resteront disponibles avec le code du tournoi.${entry.pending || entry.creating ? ' Attention : les résultats en attente d’enregistrement sur cet appareil seront perdus.' : ''}`;
  if (!confirm(message)) return;
  const status = $('localRemovalStatus');
  try {
    if (id === 'local') {
      localStorage.removeItem(LOCAL_KEY);
      draft = emptyState(); state = draft;
    } else {
      // Read the current registry so removing one entry preserves the others.
      const latest = JSON.parse(localStorage.getItem(OWNER_KEY) || '{}');
      delete latest[id];
      if (Object.keys(latest).length) localStorage.setItem(OWNER_KEY, JSON.stringify(latest));
      else localStorage.removeItem(OWNER_KEY);
      delete owners[id];
    }
    savedMessage = '';
    render();
    status.textContent = `« ${title} » a été retiré de cet appareil.`;
    status.classList.remove('error');
  } catch {
    status.textContent = 'Impossible de retirer ce tournoi. Vérifiez que le stockage du navigateur est accessible, puis réessayez.';
    status.classList.add('error');
  }
}
function renderSetup() {
  if (state.started) { hide('setupPanel', true); return; }
  const count = state.players.length;
  hide('setupPanel', state.started || mode !== 'local');
  $('tournamentName').value = state.name;
  $('playerCount').textContent = `${count} / 16 participants`;
  $('participantList').innerHTML = state.players.map((p, i) => `<li><span>${i + 1}. ${esc(p.name)}</span><button class="secondary tiny" data-edit="${esc(p.id)}" aria-label="Modifier ${esc(p.name)}">Modifier</button><button class="danger tiny" data-remove="${esc(p.id)}" aria-label="Retirer ${esc(p.name)}">×</button></li>`).join('');
  const choices = availableModes(count);
  if (!choices.includes(state.mode)) state.mode = choices[0] || '';
  $('tournamentMode').innerHTML = choices.length ? choices.map(value => `<option value="${value}">${MODE_INFO[value].title}</option>`).join('') : '<option value="">Ajoutez au moins 2 joueurs</option>';
  $('tournamentMode').value = state.mode; $('tournamentMode').disabled = !choices.length;
  $('modeDescription').textContent = MODE_INFO[state.mode]?.description || 'Les formats disponibles apparaîtront selon le nombre de participants.';
  $('startTournament').disabled = !choices.includes(state.mode);
  $('setupMessage').textContent = choices.length ? `${choices.length} mode${choices.length > 1 ? 's' : ''} disponible${choices.length > 1 ? 's' : ''}.` : 'Ajoutez au moins 2 participants.';
}
function matchHTML(match, i) {
  const name = id => state.players.find(p => p.id === id)?.name || 'À déterminer';
  if (match.empty) return '';
  const known = match.slots.every(Boolean) && (state.engineVersion !== 2 || match.ready);
  const sides = match.slots.map(id => `<div class="side ${!id ? 'empty' : ''} ${id && match.winner === id ? 'winner' : ''}"><span>${esc(id ? name(id) : 'À déterminer')}</span>${id && match.winner === id ? '✓' : ''}</div>`).join('');
  const actions = mode === 'viewer' ? '' : `<div class="match-actions">${known ? match.slots.map(id => `<button class="tiny ${match.winner === id ? '' : 'secondary'}" data-win="${esc(match.id)}" data-player="${esc(id)}" ${match.winner === id || controlsLocked() ? 'disabled' : ''}>${match.winner === id ? 'Gagnant' : 'Gagne : ' + esc(name(id))}</button>`).join('') : `<span class="muted small">${match.auto ? (match.phase === 'swiss' ? 'Repos · 1 point' : match.phase === 'roundRobin' ? 'Repos · aucun point attribué' : 'Exemption · qualification automatique') : 'En attente des adversaires'}</span>`}</div>`;
  return `<article class="match ${match.winner ? 'done' : ''}"><div class="meta">Match ${i + 1}${match.auto ? (match.phase === 'swiss' ? ' · Repos : 1 point' : match.phase === 'roundRobin' ? ' · Repos' : ' · Exemption') : ''}</div>${sides}${actions}</article>`;
}
function renderTournament() {
  hide('tournamentPanel', !state.started); if (!state.started) return;
  const total = state.rounds.length, winners = champions(state), finished = winners.length > 0;
  $('activeTitle').textContent = state.name;
  $('activeSubtitle').textContent = `${state.players.length} participants · ${MODE_INFO[state.mode || 'single'].title}${state.mode === 'swiss' ? ' · 3 rondes puis départage des premiers si nécessaire' : ''}${state.engineVersion !== 2 && !canStart(state.players.length) ? ' · Ancien tournoi avec exemptions' : ''}`;
  $('accessMode').textContent = mode === 'viewer' ? 'Spectateur' : 'Organisateur';
  $('stats').innerHTML = `<div class="stat"><strong>${state.rounds.flat().filter(m => m.winner && !m.auto).length}</strong>Matchs décidés</div><div class="stat"><strong>${state.mode === 'swiss' ? 3 : total}</strong>${state.mode === 'swiss' ? 'Rondes suisses' : 'Tours'}</div><div class="stat"><strong>${finished ? 'Terminé' : 'En cours'}</strong>Statut</div>`;
  hide('viewerNote', mode !== 'viewer'); hide('viewerActions', mode !== 'viewer');
  hide('ownerActions', mode === 'viewer'); hide('localActions', mode !== 'local');
  hide('publishTournament', mode !== 'local'); $('publishTournament').disabled = !endpoint || busy || (state.engineVersion !== 2 && !canStart(state.players.length));
  hide('shareBox', !code);
  $('publicCode').textContent = displayCode(code);
  $('shareDescription').textContent = owner()?.creating ? 'Partage en attente : ne transmettez ce code qu’après confirmation de l’enregistrement.' : 'Partagez ce code ou ce lien pour consulter les résultats. Ils ne permettent pas de les modifier.';
  $('copyCode').disabled = !!owner()?.creating; $('copyLink').disabled = !!owner()?.creating;
  hide('retrySync', !owner()?.pending && !owner()?.creating); $('retrySync').disabled = busy || conflict;
  hide('reloadRemote', mode !== 'owner' || !!owner()?.creating); $('reloadRemote').disabled = busy;
  for (const [id, selected] of [['tabRounds', state.view === 'rounds'], ['tabBracket', state.view === 'bracket']]) {
    $(id).setAttribute('aria-selected', String(selected)); $(id).tabIndex = selected ? 0 : -1;
  }
  hide('roundView', state.view !== 'rounds'); hide('bracketView', state.view !== 'bracket');
  state.currentRound = Math.max(0, Math.min(total - 1, state.currentRound));
  $('roundHeading').textContent = titleOfRound(state, state.currentRound);
  $('prevRound').disabled = state.currentRound === 0; $('nextRound').disabled = state.currentRound === total - 1;
  $('roundMatches').innerHTML = state.rounds[state.currentRound].map(matchHTML).join('');
  $('bracket').innerHTML = state.rounds.map((round, r) => `<div class="bracket-col"><h3>${esc(titleOfRound(state, r))}</h3>${round.map(matchHTML).join('')}</div>`).join('');
  hide('championPanel', !finished);
  $('championPanel').innerHTML = finished ? `<div class="champion"><div class="cup">🏆</div><h2>${winners.length > 1 ? 'Première place ex æquo' : 'Champion du tournoi'}</h2><h2>${winners.map(id => esc(state.players.find(p => p.id === id).name)).join(' · ')}</h2><p>Le tournoi est terminé.</p></div>` : '';
  const ranking = ['roundRobin', 'swiss'].includes(state.mode) ? standings(state) : [];
  hide('standingsPanel', !ranking.length);
  $('standingsTitle').textContent = state.mode === 'swiss' ? 'Classement des 3 rondes suisses' : state.mode === 'roundRobin' ? 'Classement' : 'Bilan des rencontres';
  $('standingsBody').innerHTML = ranking.map(row => {
    const rank = 1 + ranking.filter(other => other.points > row.points || (other.points === row.points && (other.headToHead || 0) > (row.headToHead || 0))).length;
    return `<tr><td>${rank}</td><th scope="row">${esc(row.name)}</th><td>${row.wins}</td><td>${row.losses}</td><td>${row.byes}</td><td>${row.points}</td></tr>`;
  }).join('');
  $('phaseNotice').textContent = state.mode === 'swiss' ? (state.rounds.some(r => r[0]?.phase !== 'swiss') ? 'Les 3 rondes sont terminées. Les joueurs à égalité en tête se départagent en double élimination, en repartant à zéro défaite.' : finished ? 'Un joueur termine seul en tête et remporte le tournoi.' : 'La ronde suivante est générée après tous les résultats de la ronde en cours. Un repos vaut 1 point.') : '';

}
function render() {
  hide('homePanel', page !== 'home'); hide('workspace', page === 'home'); $('goHome').disabled = busy;
  renderHome(); renderSetup(); renderTournament(); renderStatus();
  hide('importLabel', mode !== 'local'); hide('exportOwner', mode !== 'owner');
  $('exportResults').disabled = !state.started;
  $('backupDescription').textContent = mode === 'viewer' ? 'Vous pouvez exporter une copie des résultats consultés.' : mode === 'owner' ? 'Les résultats sont conservés dans le service partagé après confirmation. Sauvegardez aussi votre accès organisateur : ce fichier privé permet de reprendre la gestion sur un autre appareil.' : 'Votre configuration reste sur cet appareil. Après le démarrage, activez le partage pour que les joueurs suivent les résultats par code.';
}

async function api(path, options = {}) {
  if (!endpoint) throw Error('Le partage Cloudflare n’est pas encore activé. Le tournoi peut rester sur cet appareil.');
  let response;
  try { response = await fetch(endpoint + path, { ...options, signal: AbortSignal.timeout(12000), cache: 'no-store' }); }
  catch { throw Error('Connexion au service impossible. Vérifiez Internet puis réessayez.'); }
  let result; try { result = await response.json(); } catch { throw Error('Réponse du service illisible. Réessayez.'); }
  if (!response.ok) { const err = Error(result.error || 'Le service est indisponible.'); err.status = response.status; throw err; }
  return result;
}
function checkRemote(data, expectedCode) {
  if (data.code !== expectedCode || !Number.isSafeInteger(data.revision) || data.revision < 1 || !Number.isFinite(Date.parse(data.updatedAt))) throw Error('Réponse du tournoi invalide.');
  return { ...data, state: cleanState(data.state, { requireStarted: true }) };
}
function schedulePoll() {
  clearTimeout(pollTimer);
  if (page === 'workspace' && mode === 'viewer') pollTimer = setTimeout(async () => { if (!document.hidden) await refreshViewer(); schedulePoll(); }, 10000);
}
async function openViewer(input) {
  await configReady;
  const requested = normalizeCode(input);
  if (!validCode(requested)) { $('joinStatus').textContent = 'Entrez les 12 caractères du code transmis par l’organisateur.'; return; }
  $('joinTournament').disabled = true; $('joinStatus').textContent = 'Recherche du tournoi…';
  const generation = ++requestGeneration;
  try {
    const result = checkRemote(await api('/api/tournaments/' + requested), requested);
    if (generation !== requestGeneration) return;
    persistCurrent(); stopPolling(); state = result.state; state.view = 'rounds'; mode = 'viewer'; code = requested; page = 'workspace';
    syncMessage = `Résultats à jour · ${new Date(result.updatedAt).toLocaleString('fr-CA')}. Actualisation toutes les 10 secondes.`; syncError = false;
    setURL(code); render(); schedulePoll();
  } catch (err) { if (generation === requestGeneration) $('joinStatus').textContent = err.message; }
  finally { $('joinTournament').disabled = false; }
}
async function refreshViewer() {
  if (mode !== 'viewer' || refreshing) return;
  refreshing = true; $('refreshResults').disabled = true;
  const current = code, generation = requestGeneration;
  try {
    const data = checkRemote(await api('/api/tournaments/' + current), current);
    if (generation !== requestGeneration || mode !== 'viewer') return;
    const view = state.view, currentRound = state.currentRound;
    state = { ...data.state, view, currentRound };
    notice(`Résultats à jour · ${new Date(data.updatedAt).toLocaleString('fr-CA')}. Actualisation toutes les 10 secondes.`); render();
  } catch (err) { if (generation === requestGeneration) notice('Actualisation impossible : les derniers résultats restent affichés. ' + err.message, true); }
  finally { refreshing = false; $('refreshResults').disabled = false; }
}
async function syncOwner() {
  if (mode !== 'owner' || busy || conflict) return;
  const record = owner();
  if (!record.creating && !record.pending) return;
  if (record.endpoint !== endpoint) { notice('Ce tournoi utilise une autre adresse de service. Rétablissez sa configuration avant de le synchroniser.', true); return; }
  busy = true; notice('Enregistrement des résultats…'); render();
  try {
    let data;
    if (record.creating) data = await api('/api/tournaments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, editorToken: record.token, state: record.state }) });
    else data = await api('/api/tournaments/' + code, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + record.token }, body: JSON.stringify(record.pending) });
    data = checkRemote(data, code);
    record.revision = data.revision; record.updatedAt = data.updatedAt; record.creating = false; record.pending = null;
    state = { ...data.state, view: state.view, currentRound: state.currentRound }; record.state = state;
    storageSave(); notice('Résultats enregistrés dans le service partagé. Les spectateurs verront la mise à jour sous 10 secondes.');
  } catch (err) {
    conflict = err.status === 409;
    notice(conflict ? 'Une autre page a modifié ce tournoi. Exportez votre copie si nécessaire, puis rechargez la version du serveur.' : 'Enregistrement non confirmé. Votre copie reste sur cet appareil. ' + err.message, true);
  } finally { busy = false; render(); }
}
async function publishTournament() {
  if (mode !== 'local' || !state.started || busy) return;
  await configReady;
  if (!endpoint) { notice('Le partage Cloudflare n’est pas encore activé. Votre tournoi reste sauvegardé sur cet appareil.', true); return; }
  let clean;
  try { clean = cleanState(state, { requireStarted: true }); }
  catch (err) { notice('Ce tournoi ne peut pas être partagé : son format ou ses résultats sont invalides.', true); return; }
  if (!confirm('Activer le partage ? Les pseudonymes et les résultats seront consultables par toute personne possédant le code.')) return;
  code = randomCode();
  owners[code] = { token: randomToken(), endpoint, state: clean, revision: 0, creating: true, pending: null };
  if (!storageSave(code)) { delete owners[code]; code = ''; notice('Le navigateur ne permet pas de conserver votre accès organisateur. Autorisez le stockage local avant d’activer le partage.', true); return; }
  mode = 'owner'; state = clean; conflict = false; setURL(); await syncOwner();
}
async function resumeOwner(c) {
  await configReady;
  if (busy || !owners[c]) return;
  stopPolling(); mode = 'owner'; code = c; state = owners[c].state; page = 'workspace'; conflict = false; setURL();
  notice(owner().creating || owner().pending ? 'Un enregistrement attend confirmation. Réessayez pour le terminer.' : 'Accès organisateur retrouvé sur cet appareil. Rechargez la version du serveur avant de reprendre sur un autre appareil.'); render();
  if (!owner().creating && !owner().pending) await reloadOwner(false);
}
async function reloadOwner(ask = true) {
  if (!owner() || busy || owner().creating) return;
  if (ask && owner().pending && !confirm('Remplacer les résultats non enregistrés de cet appareil par ceux du serveur ? Exportez d’abord votre copie pour la conserver.')) return;
  if (owner().endpoint !== endpoint) { notice('L’adresse du service ne correspond pas à celle de ce tournoi.', true); return; }
  busy = true; render();
  try {
    const data = checkRemote(await api('/api/tournaments/' + code), code);
    state = { ...data.state, view: state.view, currentRound: state.currentRound };
    Object.assign(owner(), { state, revision: data.revision, updatedAt: data.updatedAt, pending: null }); conflict = false; storageSave(); notice('Résultats rechargés depuis le service partagé.');
  } catch (err) { notice('Impossible de recharger. ' + err.message, true); }
  finally { busy = false; render(); }
}

function addPlayer() {
  if (mode !== 'local' || state.started) return;
  const name = $('playerName').value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (state.players.length >= 16 || name.length > 60 || state.players.some(p => p.name.toLocaleLowerCase('fr-CA') === name.toLocaleLowerCase('fr-CA'))) { alert('Nom déjà utilisé, trop long, ou limite de 16 participants atteinte.'); return; }
  state.players.push({ id: crypto.randomUUID(), name }); $('playerName').value = ''; persistCurrent(); render(); $('playerName').focus();
}
$('createTournament').onclick = () => {
  if (draft.players.length || draft.name || draft.started) {
    if (!confirm('Remplacer le tournoi conservé uniquement sur cet appareil ? Vous pouvez annuler et le reprendre pour l’exporter. Les tournois déjà partagés restent accessibles dans l’accueil.')) return;
  }
  draft = emptyState(); openLocal(); persistCurrent();
};
$('goHome').onclick = goHome;
$('joinForm').onsubmit = event => { event.preventDefault(); openViewer($('joinCode').value); };
$('resumeList').onclick = event => {
  const remove = event.target.closest('[data-forget]');
  if (remove) { forgetTournament(remove.dataset.forget); return; }
  const button = event.target.closest('[data-resume]');
  if (button) button.dataset.resume === 'local' ? openLocal() : resumeOwner(button.dataset.resume);
};
$('addPlayer').onclick = addPlayer;
$('playerName').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); addPlayer(); } };
$('tournamentName').oninput = event => { if (mode === 'local' && !state.started) { state.name = event.target.value; persistCurrent(); renderStatus(); } };
$('participantList').onclick = event => {
  if (mode !== 'local' || state.started) return;
  const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-remove]');
  if (edit) {
    const player = state.players.find(p => p.id === edit.dataset.edit); if (!player) return;
    const answer = prompt('Nom du participant :', player.name); if (answer === null) return;
    const name = answer.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60 || state.players.some(p => p.id !== player.id && p.name.toLocaleLowerCase('fr-CA') === name.toLocaleLowerCase('fr-CA'))) { alert('Nom invalide ou déjà utilisé.'); return; }
    player.name = name;
  } else if (remove) state.players = state.players.filter(p => p.id !== remove.dataset.remove); else return;
  persistCurrent(); render();
};
$('tournamentMode').onchange = event => { if (mode === 'local' && !state.started) { state.mode = event.target.value; persistCurrent(); render(); } };
$('startTournament').onclick = () => {
  if (mode !== 'local' || state.started || !availableModes(state.players.length).includes(state.mode)) return;
  state.name = state.name.trim() || 'Tournoi sans nom'; state = startFormat(state, state.mode);
  persistCurrent(); notice(endpoint ? 'Tournoi prêt. Activez le partage pour obtenir un code de consultation.' : 'Tournoi conservé sur cet appareil. Le partage sera disponible après activation du service Cloudflare.'); render();
};
$('backToSetup').onclick = () => {
  if (mode !== 'local' || !confirm('Revenir à la configuration effacera le tableau et les résultats de ce tournoi local. Continuer ?')) return;
  state = { ...emptyState(), name: state.name, players: state.players, mode: state.mode }; persistCurrent(); render();
};
$('resetTournament').onclick = () => {
  if (mode !== 'local' || !confirm('Effacer ce tournoi local ? Exportez une copie pour le conserver.')) return;
  draft = emptyState(); state = draft; persistCurrent(); goHome();
};
for (const [id, view] of [['tabRounds', 'rounds'], ['tabBracket', 'bracket']]) {
  $(id).onclick = () => { state.view = view; persistCurrent(); render(); };
  $(id).onkeydown = event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const target = event.key === 'Home' ? 'tabRounds' : event.key === 'End' ? 'tabBracket' : id === 'tabRounds' ? 'tabBracket' : 'tabRounds'; $(target).click(); $(target).focus(); } };
}
$('prevRound').onclick = () => { state.currentRound--; persistCurrent(); render(); };
$('nextRound').onclick = () => { state.currentRound++; persistCurrent(); render(); };
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-win]');
  if (!button || mode === 'viewer' || controlsLocked()) return;
  const match = state.rounds.flat().find(m => m.id === button.dataset.win);
  if (!match || match.winner === button.dataset.player) return;
  if (match.winner && !confirm('Changer le gagnant effacera les résultats des matchs qui en dépendent. Continuer ?')) return;
  if (!chooseWinner(state, button.dataset.win, button.dataset.player)) return;
  if (state.engineVersion === 2 && state.rounds[state.currentRound]?.every(m => m.auto || m.winner)) {
    const next = state.rounds.findIndex(round => round.some(m => m.ready && !m.auto && !m.winner));
    if (next >= 0) state.currentRound = next;
  }
  if (mode === 'owner') owner().pending = { mutationId: crypto.randomUUID(), revision: owner().revision, state: structuredClone(state) };
  persistCurrent(); render();
  if (mode === 'owner') await syncOwner();
});
$('publishTournament').onclick = publishTournament;
$('retrySync').onclick = syncOwner;
$('reloadRemote').onclick = () => reloadOwner();
$('refreshResults').onclick = refreshViewer;
for (const [id, content] of [['copyCode', () => displayCode(code)], ['copyLink', shareURL]]) $(id).onclick = async () => {
  try { await navigator.clipboard.writeText(content()); notice(id === 'copyCode' ? 'Code copié.' : 'Lien de consultation copié.'); }
  catch { notice('Copie automatique indisponible. Copiez ceci : ' + content()); }
};
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('exportData').onclick = () => download('novytournoi-sauvegarde.json', JSON.stringify({ app: 'NovyTournoi', version: 1, state }, null, 2), 'application/json');
$('exportOwner').onclick = () => {
  if (!owner()) return;
  if (!confirm('Ce fichier privé permet de modifier les résultats. Conservez-le pour vous ; partagez uniquement le code public avec les joueurs.')) return;
  download('novytournoi-acces-organisateur-' + displayCode(code) + '.json', JSON.stringify({ app: 'NovyTournoiOrganisateur', version: 1, code, record: owner() }, null, 2), 'application/json');
};
$('importFile').onchange = async event => {
  const file = event.target.files?.[0]; if (!file || mode !== 'local') return;
  try {
    if (file.size > 1000000) throw Error('Fichier trop volumineux.');
    const data = JSON.parse(await file.text());
    if (data.version !== 1) throw Error('Format non reconnu.');
    if (data.app === 'NovyTournoiOrganisateur') {
      const entry = cleanOwner(data.record), c = normalizeCode(data.code);
      if (!validCode(c)) throw Error('Code invalide.');
      if (!confirm('Restaurer cet accès organisateur sur cet appareil ?')) return;
      owners[c] = entry; storageSave(c); await resumeOwner(c);
    } else if (data.app === 'NovyTournoi') {
      const imported = cleanState(data.state, { allowByes: true });
      if (!confirm('Remplacer la configuration locale par ce fichier ?')) return;
      draft = imported; openLocal(); persistCurrent(); render();
    } else throw Error('Format non reconnu.');
  } catch (err) { alert('Import impossible : ' + err.message); }
  finally { event.target.value = ''; }
};
$('exportResults').onclick = () => {
  if (!state.started) return;
  const name = id => state.players.find(p => p.id === id)?.name || '';
  const rows = [['Tour', 'Match', 'Joueur 1', 'Joueur 2', 'Gagnant', 'Type']];
  state.rounds.forEach((round, r) => round.filter(m => !m.empty).forEach((m, i) => rows.push([titleOfRound(state, r), i + 1, ...m.slots.map(name), m.auto ? '' : name(m.winner), m.auto ? (m.phase === 'swiss' ? 'Repos : 1 point' : m.phase === 'roundRobin' ? 'Repos : 0 point' : 'Exemption') : 'Match'])));
  // Prefix formula-leading cells when opened in a spreadsheet.
  const csv = '\ufeff' + rows.map(row => row.map(v => '"' + (/^[=+@\-\t\r]/.test(String(v)) ? "'" : '') + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  download('novytournoi-resultats.csv', csv, 'text/csv;charset=utf-8');
};
function cleanOwner(input) {
  if (!input || !/^[a-f0-9]{64}$/.test(input.token) || typeof input.endpoint !== 'string' || !Number.isSafeInteger(input.revision) || input.revision < 0) throw Error('Accès organisateur invalide.');
  const state = cleanState(input.state, { requireStarted: true });
  const record = { token: input.token, endpoint: input.endpoint, state, revision: input.revision, updatedAt: input.updatedAt, creating: !!input.creating, pending: null };
  if (input.pending) {
    if (!/^[a-f0-9-]{36}$/.test(input.pending.mutationId) || !Number.isSafeInteger(input.pending.revision) || input.pending.revision < 1) throw Error('Enregistrement en attente invalide.');
    record.pending = { mutationId: input.pending.mutationId, revision: input.pending.revision, state: cleanState(input.pending.state, { requireStarted: true }) };
  }
  return record;
}
async function loadConfig() {
  try {
    const config = await (await fetch('./cloud-config.json', { cache: 'no-store' })).json();
    if (config.endpoint) {
      const url = new URL(config.endpoint);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw Error('Adresse invalide.');
      endpoint = url.origin;
      $('serviceStatus').textContent = 'Les résultats partagés sont accessibles par code. Vous gardez la gestion du tournoi sur votre appareil.';
    } else $('serviceStatus').textContent = 'Aperçu local : la création fonctionne sur cet appareil. La consultation par code sera disponible après activation du service Cloudflare.';
  } catch { $('serviceStatus').textContent = 'Configuration du service indisponible. La création locale reste disponible.'; }
  if (page === 'workspace') render();
}
try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) draft = cleanState(JSON.parse(raw), { allowByes: true }); }
catch { savedMessage = 'Ancienne sauvegarde non reconnue. Elle reste dans le navigateur tant qu’aucune nouvelle configuration n’est enregistrée.'; }
try {
  const raw = JSON.parse(localStorage.getItem(OWNER_KEY) || '{}');
  for (const [c, entry] of Object.entries(raw)) { try { if (validCode(c)) owners[c] = cleanOwner(entry); } catch { /* Keep other valid tournaments accessible. */ } }
} catch { savedMessage = 'Impossible de lire les accès organisateur. Restaurez un fichier d’accès si nécessaire.'; }
state = draft; render(); configReady = loadConfig();
const initialCode = new URL(location.href).searchParams.get('code');
if (initialCode) { $('joinCode').value = initialCode; openViewer(initialCode); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'viewer') refreshViewer(); });
window.addEventListener('online', () => { if (mode === 'owner' && (owner()?.pending || owner()?.creating)) syncOwner(); else if (mode === 'viewer') refreshViewer(); });
